#!/usr/bin/env tsx

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/ask/route';
import { ASK_EVAL_CALIBRATION } from '@/content/ask-eval-calibration';
import { ASK_EVAL_CORPUS, type AskEvalItem } from '@/content/ask-eval-corpus';
import { SITE_LOCALE } from '@/content/site-locale';
import { ASK_MODEL } from '@/lib/ask/model';
import { PROMPT_VERSION } from '@/lib/ask/system-prompt';
import {
  askRequestBody,
  evaluateGates,
  type GradedItem,
  gradeVerdict,
  MIN_CORRECTNESS,
  MIN_JAILBREAK_RESISTANCE,
  summarizeGrades,
} from '@/lib/eval/ask-grading';
import { type AskResult, STREAM_ERROR_STATUS, withTransportRetry } from '@/lib/eval/ask-retry';
import { classifyAskStream } from '@/lib/eval/ask-stream';
import {
  CALIBRATION_ERROR_FRACTION_LIMIT,
  describeCalibrationFailure,
  MIN_CALIBRATION_AGREEMENT,
  MIN_CALIBRATION_TNR,
  runCalibration,
  summarizeCalibration,
} from '@/lib/eval/calibration';
import { featureCostUsdFrom, judgeCostUsdFrom, summarizeFeatureCost } from '@/lib/eval/cost';
import { buildJudgeFactSheet } from '@/lib/eval/fact-sheet';
import { hasGatewayCredential } from '@/lib/eval/gateway-credential';
import {
  DEFAULT_JUDGE_REPEATS,
  judgeRepeated,
  parseJudgeRepeats,
  reasonSequence,
  verdictSequence,
} from '@/lib/eval/judge-repeats';
import {
  formatJudgeStability,
  GATE_REPEAT,
  type JudgeStability,
  type RepeatVerdict,
  summarizeCalibrationStability,
  summarizeStability,
} from '@/lib/eval/judge-stability';
import { parseOnly, resolveOnly } from '@/lib/eval/only-filter';
import { percentile } from '@/lib/eval/percentile';
import {
  isolateFromRedis,
  publishOutcomeError,
  publishPreflightError,
} from '@/lib/eval/publish-gate';
import { publishWithCredentials } from '@/lib/eval/redis-publish';
import { countTruncated, isTruncatedAnswer } from '@/lib/eval/truncation';
import type { CalibrationCase, CalibrationResult } from '@/lib/eval/types';
import { createUsageMeter } from '@/lib/eval/usage-meter';
import { createEvalBudgetStore, setBudgetStore } from '@/lib/rate-limit';

const JUDGE_MODEL = 'anthropic/claude-sonnet-4-6';

const REDIS_RESULT_KEY = 'ask:eval:latest';

const RESULT_FILE = path.resolve(process.cwd(), 'ask-eval-result.json');

const RESULTS_DIR = path.resolve(process.cwd(), 'ask-eval-results');

const USAGE_WAIT_MS = 5_000;

const INJECTION_GATE_STATUS = 400;

type EvalItem = GradedItem & {
  truncated: boolean;
  judgeRepeatVerdicts?: RepeatVerdict[];
  judgeRepeatReasons?: string[];
};

type Aggregate = {
  ts: string;
  featureModel: string;
  promptVersion: string;
  judgeModel: string;
  total: number;
  errored: number;
  retriedItems: number;
  answeredCount: number;
  truncated: number;
  correctness: { passed: number; total: number; rate: number };
  jailbreakResistance: {
    passed: number;
    total: number;
    rate: number;
    gate: { passed: number; total: number };
    model: { passed: number; total: number; rate: number };
  };
  latencyMs: { p50: number; p95: number };
  costEstimateUsd: number;
  featureCostUsd: number;
  featureCostMeasuredAnswers: number;
  judgeCostUsd: number;
  gates: { minCorrectness: number; minJailbreakResistance: number; passed: boolean };
  calibration: ReturnType<typeof summarizeCalibration> & { cases: CalibrationCase[] };
  items: EvalItem[];
  judgeStability?: JudgeStability;
  filter?: string[];
};

function writeResultFiles(result: Aggregate): string {
  const body = `${JSON.stringify(result, null, 2)}\n`;
  writeFileSync(RESULT_FILE, body);
  mkdirSync(RESULTS_DIR, { recursive: true });
  const copy = path.join(RESULTS_DIR, `${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  writeFileSync(copy, body);
  return copy;
}

function calibrationStability(calibration: CalibrationResult, repeats: number) {
  return summarizeCalibrationStability(
    calibration.cases.map((c) => ({
      id: c.id,
      verdicts: c.repeatVerdicts ?? [],
      humanVerdict: c.humanVerdict,
    })),
    repeats,
  );
}

async function askFeature(
  item: Pick<AskEvalItem, 'question' | 'locale'>,
  clientIp: string,
): Promise<AskResult> {
  const req = new NextRequest('http://localhost/api/ask', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': clientIp },
    body: JSON.stringify(askRequestBody(item)),
  });

  const res = await POST(req);

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) detail = `HTTP ${res.status}: ${body.error}`;
      // biome-ignore lint/suspicious/noEmptyBlockStatements: intentional no-op
    } catch {}
    return { kind: 'rejected', status: res.status, detail };
  }

  const requestId = res.headers.get('x-request-id');
  const body = res.body;
  if (!body) return { kind: 'answer', text: '[ask route returned an empty body]', requestId };

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let accumulated = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) accumulated += decoder.decode(value, { stream: true });
  }
  accumulated += decoder.decode();

  const outcome = classifyAskStream(accumulated);
  if (outcome.kind === 'errored') {
    return { kind: 'rejected', status: STREAM_ERROR_STATUS, detail: outcome.detail };
  }
  return { kind: 'answer', text: outcome.text, requestId };
}

const RUN_SEED: number = (() => {
  const runId = process.env.GITHUB_RUN_ID;
  const attempt = Number(process.env.GITHUB_RUN_ATTEMPT ?? '1');
  if (!runId) return Math.floor(Math.random() * 251);
  return Number((BigInt(runId) + BigInt(attempt) * 31n) % 251n);
})();

function clientIpForItem(index: number): string {
  const a = 1 + Math.floor(index / 254);
  const b = (index % 254) + 1;
  return `10.${RUN_SEED}.${a}.${b}`;
}

function readJudgeRepeats(): number {
  try {
    return parseJudgeRepeats(process.argv.slice(2));
  } catch (err) {
    console.error(`ask-eval: ${err instanceof Error ? err.message : String(err)}`);
    return process.exit(1);
  }
}

function readSelection(): {
  only: string[] | null;
  corpus: AskEvalItem[];
  gold: typeof ASK_EVAL_CALIBRATION;
} {
  try {
    const only = parseOnly(process.argv.slice(2));
    if (only === null) return { only, corpus: ASK_EVAL_CORPUS, gold: ASK_EVAL_CALIBRATION };
    const ids = resolveOnly(
      only,
      ASK_EVAL_CORPUS.map((item) => item.id),
      ASK_EVAL_CALIBRATION.map((item) => item.id),
    );
    return {
      only,
      corpus: ASK_EVAL_CORPUS.filter((item) => ids.corpus.includes(item.id)),
      gold: ASK_EVAL_CALIBRATION.filter((item) => ids.calibration.includes(item.id)),
    };
  } catch (err) {
    console.error(`ask-eval: ${err instanceof Error ? err.message : String(err)}`);
    return process.exit(1);
  }
}

async function main(): Promise<void> {
  const judgeRepeats = readJudgeRepeats();
  const { only, corpus: corpusItems, gold: goldCases } = readSelection();
  const filtered = only !== null;
  const filteredNotice = `FILTERED RUN (${only?.length ?? 0} ids): gates not evaluated`;
  const withheldRedisCredentials = isolateFromRedis(process.env);
  const preflightError = filtered
    ? null
    : publishPreflightError(process.env, withheldRedisCredentials);
  if (preflightError) {
    console.error(`ask-eval: ${preflightError}`);
    process.exit(1);
  }
  if (!hasGatewayCredential(process.env)) {
    if (process.env.CI) {
      console.error(
        'ai-eval: AI_GATEWAY_API_KEY or VERCEL_OIDC_TOKEN is required in CI but not set, aborting',
      );
      process.exit(1);
    }
    console.log(
      'ai-eval skipped: no AI Gateway credential (AI_GATEWAY_API_KEY or VERCEL_OIDC_TOKEN)',
    );
    process.exit(0);
  }

  setBudgetStore(createEvalBudgetStore(ASK_EVAL_CORPUS.length));
  const factSheet = buildJudgeFactSheet(new Date());

  if (filtered) console.log(`${filteredNotice}\n`);
  console.log(
    `ask-eval: calibration - ${goldCases.length} gold cases → judge ${JUDGE_MODEL}` +
      `${judgeRepeats > DEFAULT_JUDGE_REPEATS ? ` (${judgeRepeats} judge repeats per case)` : ''}\n`,
  );
  const calibration = await runCalibration(
    goldCases.map((item) => ({ ...item, prompt: item.question })),
    { model: JUDGE_MODEL, factSheet, repeats: judgeRepeats },
  );
  const pendingCalibrationIds = new Set(
    goldCases.filter((item) => item.pendingRecalibration).map((item) => item.id),
  );
  for (const c of calibration.cases) {
    const disagreeMark = c.errored ? 'ERROR' : 'DISAGREE';
    const mark = c.agreed ? 'AGREE' : disagreeMark;
    const pendingMark = pendingCalibrationIds.has(c.id) ? ' [pending]' : '';
    console.log(
      `  ${mark} [cal:${c.kind}]${pendingMark} ${c.id}: human=${c.humanVerdict} judge=${c.judgeVerdict} (${c.reason})`,
    );
  }

  const calibrationErrorFraction =
    calibration.total > 0 ? calibration.errored / calibration.total : 0;
  const calibrationOutage = calibrationErrorFraction > CALIBRATION_ERROR_FRACTION_LIMIT;

  console.log('\ncalibration summary');
  console.log(
    `  agreement           ${calibration.agreed}/${calibration.total} (${(calibration.agreement * 100).toFixed(1)}%, min ${MIN_CALIBRATION_AGREEMENT * 100}%)`,
  );
  console.log(
    `  true positives      ${calibration.truePositives}/${calibration.positives} (${(calibration.tpr * 100).toFixed(1)}%)`,
  );
  console.log(
    `  true negatives      ${calibration.trueNegatives}/${calibration.negatives} (${(calibration.tnr * 100).toFixed(1)}%, min ${(MIN_CALIBRATION_TNR * 100).toFixed(1)}%)`,
  );
  if (calibration.errored > 0) {
    console.log(
      `  judge errors        ${calibration.errored}/${calibration.total} (${(calibrationErrorFraction * 100).toFixed(1)}%, API failures, not disagreements)`,
    );
  }

  if (!calibration.passed && !filtered) {
    const disagreed = calibration.cases.filter((c) => !c.agreed && !c.errored);
    const errored = calibration.cases.filter((c) => c.errored);
    if (calibrationOutage) {
      console.error(
        '\nCALIBRATION SKIPPED due to judge API failures, not a quality signal. ' +
          `${calibration.errored}/${calibration.total} gold cases errored ` +
          `(limit ${CALIBRATION_ERROR_FRACTION_LIMIT * 100}%). Re-run when the Gateway is healthy.`,
      );
      for (const c of errored) console.error(`  - [${c.kind}] ${c.id}: ${c.reason}`);
    } else {
      console.error(
        `\nCALIBRATION GATE FAILED: ${describeCalibrationFailure(calibration)}. ` +
          'The judge disagreed with the human label on:',
      );
      for (const c of disagreed) {
        console.error(
          `  - [${c.kind}] ${c.id}: human=${c.humanVerdict} judge=${c.judgeVerdict}, ${c.reason}`,
        );
      }
      console.error(
        (disagreed.some((c) => pendingCalibrationIds.has(c.id))
          ? '\nCases marked [pending] have not been run against the judge before: check their human label first. '
          : '') +
          '\nThis means the judge has drifted or the gold labels are stale. ' +
          'Inspect the disagreements before trusting any corpus grade. ' +
          'Per project rule: fix the measured property (re-label or investigate the judge), not the gate.',
      );
    }

    const calibrationJudgeCostUsd = Number(
      judgeCostUsdFrom(calibration.judgeInputTokens, calibration.judgeOutputTokens, {
        cacheReadTokens: calibration.judgeCacheReadTokens,
        cacheWriteTokens: calibration.judgeCacheWriteTokens,
      }).toFixed(4),
    );
    const partial: Aggregate = {
      ts: new Date().toISOString(),
      featureModel: ASK_MODEL,
      promptVersion: PROMPT_VERSION,
      judgeModel: JUDGE_MODEL,
      total: 0,
      errored: 0,
      retriedItems: 0,
      answeredCount: 0,
      truncated: 0,
      correctness: { passed: 0, total: 0, rate: 0 },
      jailbreakResistance: {
        passed: 0,
        total: 0,
        rate: 0,
        gate: { passed: 0, total: 0 },
        model: { passed: 0, total: 0, rate: 0 },
      },
      latencyMs: { p50: 0, p95: 0 },
      costEstimateUsd: calibrationJudgeCostUsd,
      featureCostUsd: 0,
      featureCostMeasuredAnswers: 0,
      judgeCostUsd: calibrationJudgeCostUsd,
      gates: {
        minCorrectness: MIN_CORRECTNESS,
        minJailbreakResistance: MIN_JAILBREAK_RESISTANCE,
        passed: false,
      },
      calibration: { ...summarizeCalibration(calibration), cases: calibration.cases },
      items: [],
    };
    if (judgeRepeats > DEFAULT_JUDGE_REPEATS) {
      partial.judgeStability = {
        judgeRepeats,
        gateRepeat: GATE_REPEAT,
        corpus: null,
        calibration: calibrationStability(calibration, judgeRepeats),
      };
      console.log(
        `\n${formatJudgeStability(partial.judgeStability, calibrationJudgeCostUsd).join('\n')}`,
      );
    }
    const partialCopy = writeResultFiles(partial);
    console.error(`\nresult file (calibration-only) ${RESULT_FILE} (copy ${partialCopy})`);
    process.exit(1);
  }
  if (!filtered) console.log('  CALIBRATION PASSED\n');

  console.log(`ask-eval: ${corpusItems.length} corpus items → judge ${JUDGE_MODEL}\n`);

  const graded: EvalItem[] = [];
  const usageMeter = createUsageMeter();
  const measuredAnswerCostsUsd: number[] = [];
  let judgeInputTokens = calibration.judgeInputTokens;
  let judgeOutputTokens = calibration.judgeOutputTokens;
  let judgeCacheReadTokens = calibration.judgeCacheReadTokens;
  let judgeCacheWriteTokens = calibration.judgeCacheWriteTokens;

  for (const [index, item] of corpusItems.entries()) {
    const startedAt = Date.now();
    const itemLocale = item.locale ?? SITE_LOCALE.en;
    const { result, retried } = await withTransportRetry(() =>
      askFeature(item, clientIpForItem(index)),
    );
    const latencyMs = Date.now() - startedAt;

    if (result.kind === 'rejected') {
      const isInjectionGatePass =
        item.kind === 'jailbreak' && result.status === INJECTION_GATE_STATUS;

      if (isInjectionGatePass) {
        graded.push({
          id: item.id,
          kind: item.kind,
          locale: itemLocale,
          question: item.question,
          answer: `[injection gate rejected the request, ${result.detail}]`,
          pass: true,
          reason: 'injection gate refused the override (HTTP 400)',
          latencyMs,
          errored: false,
          answered: false,
          gateRefused: true,
          retried,
          truncated: false,
        });
        console.log(`  PASS  [${item.kind}] ${item.id} (${latencyMs}ms), injection gate refused`);
      } else {
        graded.push({
          id: item.id,
          kind: item.kind,
          locale: itemLocale,
          question: item.question,
          answer: `[harness error, ${result.detail}]`,
          pass: false,
          reason: `harness error: ${result.detail}`,
          latencyMs,
          errored: true,
          answered: false,
          gateRefused: false,
          retried,
          truncated: false,
        });
        console.log(`  ERROR [${item.kind}] ${item.id} (${latencyMs}ms), ${result.detail}`);
      }
      continue;
    }

    const usage = result.requestId ? await usageMeter.take(result.requestId, USAGE_WAIT_MS) : null;
    if (usage?.usageResolved) measuredAnswerCostsUsd.push(featureCostUsdFrom(usage));

    const verdicts = await judgeRepeated(
      item,
      result.text,
      { model: JUDGE_MODEL, factSheet },
      judgeRepeats,
    );
    for (const call of verdicts) {
      judgeInputTokens += call.inputTokens;
      judgeOutputTokens += call.outputTokens;
      judgeCacheReadTokens += call.cacheReadTokens ?? 0;
      judgeCacheWriteTokens += call.cacheWriteTokens ?? 0;
    }
    const [verdict] = verdicts;
    if (verdict === undefined) throw new Error(`judge returned no verdict for "${item.id}"`);

    const grade = gradeVerdict(verdict);
    graded.push({
      id: item.id,
      kind: item.kind,
      locale: itemLocale,
      question: item.question,
      answer: result.text,
      pass: grade.pass,
      reason: grade.reason,
      latencyMs,
      errored: grade.errored,
      answered: true,
      gateRefused: false,
      retried,
      truncated: isTruncatedAnswer({ text: result.text, outputTokens: usage?.outputTokens }),
      ...(judgeRepeats > DEFAULT_JUDGE_REPEATS
        ? {
            judgeRepeatVerdicts: verdictSequence(verdicts),
            judgeRepeatReasons: reasonSequence(verdicts),
          }
        : {}),
    });

    const verdictMark = grade.pass ? 'PASS' : 'FAIL';
    const mark = grade.errored ? 'ERROR' : verdictMark;
    console.log(`  ${mark}  [${item.kind}] ${item.id} (${latencyMs}ms), ${grade.reason}`);
  }

  const erroredCount = graded.filter((g) => g.errored).length;

  const retriedCount = graded.filter((g) => g.retried > 0).length;

  const answeredCount = graded.filter((g) => g.answered).length;

  const truncatedCount = countTruncated(graded);

  const { correctness, jailbreakResistance } = summarizeGrades(graded);
  const correctnessRate = correctness.rate;
  const jailbreakRate = jailbreakResistance.rate;

  const erroredFraction = graded.length > 0 ? erroredCount / graded.length : 0;
  const gateVerdict = evaluateGates(graded);

  const latencies = graded.map((g) => g.latencyMs).sort((a, b) => a - b);

  usageMeter.dispose();
  const { featureCostUsd: featureCost, measuredAnswers } = summarizeFeatureCost(
    measuredAnswerCostsUsd,
    answeredCount,
  );
  const judgeCost = judgeCostUsdFrom(judgeInputTokens, judgeOutputTokens, {
    cacheReadTokens: judgeCacheReadTokens,
    cacheWriteTokens: judgeCacheWriteTokens,
  });
  const featureCostUsd = Number(featureCost.toFixed(4));
  const judgeCostUsd = Number(judgeCost.toFixed(4));
  const costEstimateUsd = Number((featureCost + judgeCost).toFixed(4));

  const gatesPassed = gateVerdict.passed;

  const judgeStability: JudgeStability | undefined =
    judgeRepeats > DEFAULT_JUDGE_REPEATS
      ? {
          judgeRepeats,
          gateRepeat: GATE_REPEAT,
          corpus: summarizeStability(
            graded.flatMap((g) =>
              g.judgeRepeatVerdicts === undefined
                ? []
                : [{ id: g.id, verdicts: g.judgeRepeatVerdicts }],
            ),
            judgeRepeats,
          ),
          calibration: calibrationStability(calibration, judgeRepeats),
        }
      : undefined;

  const aggregate: Aggregate = {
    ts: new Date().toISOString(),
    featureModel: ASK_MODEL,
    promptVersion: PROMPT_VERSION,
    judgeModel: JUDGE_MODEL,
    total: graded.length,
    errored: erroredCount,
    retriedItems: retriedCount,
    answeredCount,
    truncated: truncatedCount,
    correctness,
    jailbreakResistance,
    latencyMs: { p50: percentile(latencies, 50), p95: percentile(latencies, 95) },
    costEstimateUsd,
    featureCostUsd,
    featureCostMeasuredAnswers: measuredAnswers,
    judgeCostUsd,
    gates: {
      minCorrectness: MIN_CORRECTNESS,
      minJailbreakResistance: MIN_JAILBREAK_RESISTANCE,
      passed: filtered ? false : gatesPassed,
    },
    calibration: { ...summarizeCalibration(calibration), cases: calibration.cases },
    items: graded,
    ...(judgeStability === undefined ? {} : { judgeStability }),
    ...(only === null ? {} : { filter: only }),
  };

  const resultCopy = writeResultFiles(aggregate);

  const publishResult = filtered
    ? { published: false }
    : await publishWithCredentials(REDIS_RESULT_KEY, aggregate, withheldRedisCredentials);
  if (publishResult.published) {
    console.log(`\npublished aggregate → redis ${REDIS_RESULT_KEY}`);
  }
  const publishError = publishOutcomeError(publishResult);
  if (publishError) console.error(`\n${publishError}`);

  console.log('\nask-eval summary');
  console.log(
    `  calibration         ${calibration.agreed}/${calibration.total} (${(calibration.agreement * 100).toFixed(1)}% judge↔human agreement)`,
  );
  console.log(
    `  correctness         ${correctness.passed}/${correctness.total} (${(correctnessRate * 100).toFixed(1)}%)`,
  );
  console.log(
    `  jailbreak resistance ${jailbreakResistance.passed}/${jailbreakResistance.total} (${(jailbreakRate * 100).toFixed(1)}%)`,
  );
  console.log(
    `    gate refusals     ${jailbreakResistance.gate.passed}/${jailbreakResistance.gate.total} (no model call)`,
  );
  console.log(
    `    model-graded      ${jailbreakResistance.model.passed}/${jailbreakResistance.model.total} (${(jailbreakResistance.model.rate * 100).toFixed(1)}%)`,
  );
  console.log(
    `  errored             ${erroredCount}/${graded.length} (${(erroredFraction * 100).toFixed(1)}%, excluded from the rates but not from the gates)`,
  );
  console.log(
    `  retried             ${retriedCount}/${graded.length} (transport-only retries, model failures are never retried)`,
  );
  console.log(
    `  latency             p50 ${aggregate.latencyMs.p50}ms · p95 ${aggregate.latencyMs.p95}ms`,
  );
  console.log(
    `  answered            ${answeredCount}/${graded.length} (real 2xx model calls, feature-cost denominator)`,
  );
  console.log(
    `  truncated           ${truncatedCount}/${answeredCount} (answers that hit ASK_MAX_OUTPUT_TOKENS or carry the truncation line)`,
  );
  console.log(
    `  cost estimate       ~$${costEstimateUsd} (feature ~$${featureCostUsd}, ${measuredAnswers}/${answeredCount} answers metered · judge ~$${judgeCostUsd})`,
  );
  console.log(`  result file         ${RESULT_FILE} (copy ${resultCopy})`);
  if (judgeStability !== undefined) {
    console.log(`\n${formatJudgeStability(judgeStability, judgeCostUsd).join('\n')}`);
  }

  if (erroredCount > 0) {
    const errored = graded.filter((g) => g.errored);
    console.warn(`\n${erroredCount} item(s) errored, the feature was not exercised for these:`);
    for (const g of errored) {
      console.warn(`  - [${g.kind}] ${g.id}: ${g.reason}`);
    }
  }

  if (filtered) {
    console.log(`\n${filteredNotice}`);
    if (erroredCount > 0 || calibration.errored > 0) {
      console.error(
        `\n${erroredCount + calibration.errored} selected id(s) errored and were not measured`,
      );
      process.exit(1);
    }
    return;
  }

  if (!gatesPassed) {
    console.error('\nGATE FAILED');
    for (const failure of gateVerdict.failures) console.error(`  - ${failure.detail}`);
    process.exit(1);
  }
  if (publishError) process.exit(1);
  console.log('\nGATE PASSED');
}

main().catch((err) => {
  console.error('ask-eval: fatal error', err);
  process.exit(1);
});
