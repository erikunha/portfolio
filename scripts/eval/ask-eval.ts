#!/usr/bin/env tsx

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
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
import { createEvalBudgetStore, setBudgetStore } from '@/lib/eval/budget-store';
import { runCalibration, summarizeCalibration } from '@/lib/eval/calibration';
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
import { ASK_EVAL_RESULT_KEY } from '@/lib/eval/result-key';
import { countTruncated, isTruncatedAnswer } from '@/lib/eval/truncation';
import type { CalibrationCase, CalibrationResult } from '@/lib/eval/types';
import { createUsageMeter } from '@/lib/eval/usage-meter';
import {
  calibrationErrorFraction,
  calibrationFailureLines,
  calibrationSummaryLines,
  decideExit,
  decideStartup,
  formatArgumentError,
  formatCalibrationCaseLine,
  formatFilteredNotice,
  formatItemLine,
  isCalibrationOutage,
  itemMark,
  type ReportLine,
  shouldAbortOnCalibration,
  summaryLines,
} from './ask-eval-report';

const JUDGE_MODEL = 'anthropic/claude-sonnet-4-6';

const FULL_RESULT_FILE = path.resolve(process.cwd(), 'ask-eval-result.json');

const FILTERED_RESULT_FILE = path.resolve(process.cwd(), 'ask-eval-result.filtered.json');

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
  filtered?: true;
};

function emit(lines: readonly ReportLine[]): void {
  for (const { stream, text } of lines) {
    if (stream === 'log') console.log(text);
    else if (stream === 'warn') console.warn(text);
    else console.error(text);
  }
}

function writeResultFiles(result: Aggregate): string {
  const body = `${JSON.stringify(result, null, 2)}\n`;
  writeFileSync(result.filtered ? FILTERED_RESULT_FILE : FULL_RESULT_FILE, body);
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

  const { POST } = await import('@/app/api/ask/route');
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
    console.error(formatArgumentError(err));
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
    console.error(formatArgumentError(err));
    return process.exit(1);
  }
}

async function main(): Promise<void> {
  const judgeRepeats = readJudgeRepeats();
  const { only, corpus: corpusItems, gold: goldCases } = readSelection();
  const filtered = only !== null;
  const filteredNotice = formatFilteredNotice(only?.length ?? 0);
  const withheldRedisCredentials = isolateFromRedis(process.env);
  const preflightError = filtered
    ? null
    : publishPreflightError(process.env, withheldRedisCredentials);
  const startup = decideStartup({
    preflightError,
    hasGatewayCredential: hasGatewayCredential(process.env),
    ci: Boolean(process.env.CI),
  });
  if (startup) {
    emit(startup.lines);
    process.exit(startup.exitCode);
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
    console.log(formatCalibrationCaseLine(c, pendingCalibrationIds));
  }

  const errorFraction = calibrationErrorFraction(calibration);
  emit(calibrationSummaryLines(calibration, errorFraction));

  if (shouldAbortOnCalibration(calibration, filtered)) {
    emit(
      calibrationFailureLines(
        calibration,
        pendingCalibrationIds,
        isCalibrationOutage(errorFraction),
      ),
    );

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
    console.error(`\nresult file (calibration-only) ${FULL_RESULT_FILE} (copy ${partialCopy})`);
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
        console.log(formatItemLine('PASS', item, latencyMs, 'injection gate refused'));
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
        console.log(formatItemLine('ERROR', item, latencyMs, result.detail));
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

    console.log(formatItemLine(itemMark(grade), item, latencyMs, grade.reason));
  }

  const erroredCount = graded.filter((g) => g.errored).length;

  const retriedCount = graded.filter((g) => g.retried > 0).length;

  const answeredCount = graded.filter((g) => g.answered).length;

  const truncatedCount = countTruncated(graded);

  const { correctness, jailbreakResistance } = summarizeGrades(graded);
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
    ...(only === null ? {} : { filter: only, filtered: true as const }),
  };

  const resultCopy = writeResultFiles(aggregate);

  const publishResult = filtered
    ? { published: false }
    : await publishWithCredentials(ASK_EVAL_RESULT_KEY, aggregate, withheldRedisCredentials);
  if (publishResult.published) {
    console.log(`\npublished aggregate → redis ${ASK_EVAL_RESULT_KEY}`);
  }
  const publishError = publishOutcomeError(publishResult);
  if (publishError) console.error(`\n${publishError}`);

  emit(
    summaryLines({
      calibration,
      correctness,
      jailbreakResistance,
      erroredCount,
      total: graded.length,
      retriedCount,
      latencyMs: aggregate.latencyMs,
      answeredCount,
      truncatedCount,
      costEstimateUsd,
      featureCostUsd,
      measuredAnswers,
      judgeCostUsd,
      resultFile: filtered ? FILTERED_RESULT_FILE : FULL_RESULT_FILE,
      resultCopy,
    }),
  );
  if (judgeStability !== undefined) {
    console.log(`\n${formatJudgeStability(judgeStability, judgeCostUsd).join('\n')}`);
  }

  const exit = decideExit({
    filtered,
    filteredNotice,
    gatesPassed,
    gateFailures: gateVerdict.failures,
    erroredItems: graded.filter((g) => g.errored),
    calibrationErrored: calibration.errored,
    publishError,
  });
  emit(exit.lines);
  if (exit.exitCode !== 0) process.exit(exit.exitCode);
}

main().catch((err) => {
  console.error('ask-eval: fatal error', err);
  process.exit(1);
});
