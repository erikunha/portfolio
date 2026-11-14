#!/usr/bin/env tsx

import { realpathSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { AGENT_EVAL_CALIBRATION } from '@/evals/agents/calibration';
import { type LoadedCase, loadCases } from '@/evals/agents/load';
import { type AbCase, selectAbCases } from '@/evals/agents/schema';
import { type AbResult, abDelta } from '@/lib/eval/ab';
import {
  assertWithinBudget,
  createSpendMeter,
  MAX_JOB_COST_USD,
  type SpendMeter,
} from '@/lib/eval/budget';
import {
  CALIBRATION_ERROR_FRACTION_LIMIT,
  describeCalibrationFailure,
  MIN_CALIBRATION_AGREEMENT,
  runCalibration,
  summarizeCalibration,
} from '@/lib/eval/calibration';
import {
  APPROX_AGENT_EVAL_INPUT_TOKENS,
  APPROX_FEATURE_OUTPUT_TOKENS,
  estimateJobCostUsd,
  judgeCostUsdFrom,
} from '@/lib/eval/cost';
import { hasGatewayCredential } from '@/lib/eval/gateway-credential';
import { gradeRun } from '@/lib/eval/grade';
import { aggregateCase, type CaseStats, failedCaseIds } from '@/lib/eval/montecarlo';
import {
  isolateFromRedis,
  publishOutcomeError,
  publishPreflightError,
} from '@/lib/eval/publish-gate';
import { publishWithCredentials } from '@/lib/eval/redis-publish';
import { MONTE_CARLO_TEMPERATURE, runTarget } from '@/lib/eval/run-target';
import type { CalibrationResult } from '@/lib/eval/types';

export const MODELS = {
  mechanical: 'anthropic/claude-haiku-4-5',
  judgment: 'anthropic/claude-sonnet-4-6',
  judge: 'anthropic/claude-sonnet-4-6',
} as const;

export const AGENT_EVAL_REDIS_KEY = 'agent-eval:latest';

const RESULT_FILE = path.resolve(process.cwd(), 'agent-eval-result.json');

const DEFAULT_RUNS = 3;
const MAX_RUNS = 5;
export function resolveRuns(raw: string | undefined): number {
  const parsed = Number(raw);
  if (!raw || !Number.isFinite(parsed) || parsed < 1) return DEFAULT_RUNS;
  return Math.min(MAX_RUNS, Math.floor(parsed));
}

export type AgentEvalAggregate = {
  ts: string;
  targetModelMechanical: string;
  targetModelJudgment: string;
  judgeModel: string;
  runs: number;
  calibration: ReturnType<typeof summarizeCalibration>;
  cases: CaseStats[];
  costEstimateUsd: number;
  costBasis: CostBasis;
  maxJobCostUsd: number;
  gate: AgentEvalGate;
  ab?: AbResult;
};

export type CostBasis = 'measured-tokens' | 'projection';

export type AgentEvalGate = {
  calibrationPassed: boolean;
  withinBudget: boolean;
  harnessPassed: boolean;
  casesPassed: boolean;
  failedCaseIds: string[];
  abDegraded: boolean;
  passed: boolean;
};

export function describeGate(gate: AgentEvalGate): string[] {
  const reasons: string[] = [];
  if (!gate.calibrationPassed) reasons.push('judge calibration failed');
  if (!gate.withinBudget) reasons.push('cost cap exceeded');
  if (!gate.casesPassed) reasons.push(`cases that never passed: ${gate.failedCaseIds.join(', ')}`);
  if (gate.abDegraded) reasons.push('the treatment arm degraded against the control');
  return reasons;
}

export function buildAggregate(args: {
  ts: string;
  runs: number;
  calibration: CalibrationResult;
  caseStats: CaseStats[];
  costEstimateUsd: number;
  costBasis?: CostBasis;
  withinBudget: boolean;
  failedCaseIds?: string[];
  ab?: AbResult;
}): AgentEvalAggregate {
  const calibrationPassed = args.calibration.passed;
  const harnessPassed = calibrationPassed && args.withinBudget;
  const failedCases = args.failedCaseIds ?? [];
  const casesPassed = failedCases.length === 0;
  const abDegraded = args.ab?.degraded === true;
  return {
    ts: args.ts,
    targetModelMechanical: MODELS.mechanical,
    targetModelJudgment: MODELS.judgment,
    judgeModel: MODELS.judge,
    runs: args.runs,
    calibration: summarizeCalibration(args.calibration),
    cases: args.caseStats,
    costEstimateUsd: args.costEstimateUsd,
    costBasis: args.costBasis ?? 'projection',
    maxJobCostUsd: MAX_JOB_COST_USD,
    gate: {
      calibrationPassed,
      withinBudget: args.withinBudget,
      harnessPassed,
      casesPassed,
      failedCaseIds: failedCases,
      abDegraded,
      passed: harnessPassed && casesPassed && !abDegraded,
    },
    ...(args.ab ? { ab: args.ab } : {}),
  };
}

export async function sampleRuns(
  c: LoadedCase,
  opts: { runs: number; judgeModel: string; meter: SpendMeter; label?: string },
): Promise<{ results: boolean[]; budgetExceeded: boolean }> {
  const model = targetModelFor(c.tier);
  const results: boolean[] = [];
  for (let i = 0; i < opts.runs; i++) {
    if (opts.meter.exceeded()) return { results, budgetExceeded: true };
    const target = await runTarget(c, { model, temperature: MONTE_CARLO_TEMPERATURE });
    opts.meter.addTarget(c.tier, target);
    if (target.errored) {
      results.push(false);
      console.log(
        `  ERROR${opts.label ?? ''} [${c.tier}] ${c.id} run ${i + 1}/${opts.runs}: ${target.detail}`,
      );
      continue;
    }
    const verdict = await gradeRun(c, target.output, { judgeModel: opts.judgeModel });
    opts.meter.addJudge(verdict);
    results.push(verdict.pass);
    console.log(
      `  ${verdict.pass ? 'PASS' : 'FAIL'}${opts.label ?? ''} [${c.tier}] ${c.id} run ${i + 1}/${opts.runs}: ${verdict.reason}`,
    );
  }
  return { results, budgetExceeded: false };
}

export async function runAbArms(
  abCases: Array<AbCase<LoadedCase>>,
  opts: { runs: number; judgeModel: string; meter?: SpendMeter },
): Promise<{
  control: CaseStats[];
  treatment: CaseStats[];
  ab: AbResult;
  budgetExceeded: boolean;
}> {
  const meter = opts.meter ?? createSpendMeter(Number.POSITIVE_INFINITY);
  const control: CaseStats[] = [];
  const treatment: CaseStats[] = [];
  let budgetExceeded = false;

  for (const c of abCases) {
    for (const [arm, stats] of [
      [c.control, control],
      [c.treatment, treatment],
    ] as const) {
      if (budgetExceeded) break;
      const armCase = { ...c, target: { ...c.target, systemText: arm.systemText } };
      const sampled = await sampleRuns(armCase, {
        runs: opts.runs,
        judgeModel: opts.judgeModel,
        meter,
        label: ' (A/B)',
      });
      budgetExceeded = sampled.budgetExceeded;
      if (!budgetExceeded) stats.push(aggregateCase(c.id, sampled.results));
    }
    if (budgetExceeded) break;
  }

  return { control, treatment, ab: abDelta(control, treatment), budgetExceeded };
}

function targetModelFor(tier: 'mechanical' | 'judgment'): string {
  return tier === 'mechanical' ? MODELS.mechanical : MODELS.judgment;
}

async function main(): Promise<void> {
  const withheldRedisCredentials = isolateFromRedis(process.env);
  const preflightError = publishPreflightError(process.env, withheldRedisCredentials);
  if (preflightError) {
    console.error(`agent-eval: ${preflightError}`);
    process.exit(1);
  }
  if (!hasGatewayCredential(process.env)) {
    if (process.env.CI) {
      console.error(
        'agent-eval: AI_GATEWAY_API_KEY or VERCEL_OIDC_TOKEN is required in CI but not set, aborting',
      );
      process.exit(1);
    }
    console.log(
      'agent-eval skipped: no AI Gateway credential (AI_GATEWAY_API_KEY or VERCEL_OIDC_TOKEN)',
    );
    process.exit(0);
  }

  const ts = new Date().toISOString();
  const runs = resolveRuns(process.env.EVAL_RUNS);
  const abMode = process.argv.includes('--ab');
  const cases = await loadCases();

  console.log(
    `agent-eval: calibration: ${AGENT_EVAL_CALIBRATION.length} gold cases → judge ${MODELS.judge}\n`,
  );
  const calibration = await runCalibration(AGENT_EVAL_CALIBRATION, { model: MODELS.judge });

  const calErrorFraction = calibration.total > 0 ? calibration.errored / calibration.total : 0;
  const calibrationOutage = calErrorFraction > CALIBRATION_ERROR_FRACTION_LIMIT;
  console.log(
    `  agreement ${calibration.agreed}/${calibration.total} ` +
      `(${(calibration.agreement * 100).toFixed(1)}%, min ${MIN_CALIBRATION_AGREEMENT * 100}%)`,
  );

  if (!calibration.passed) {
    const calibrationJudgeCostUsd = Number(
      judgeCostUsdFrom(calibration.judgeInputTokens, calibration.judgeOutputTokens, {
        cacheReadTokens: calibration.judgeCacheReadTokens,
        cacheWriteTokens: calibration.judgeCacheWriteTokens,
      }).toFixed(4),
    );
    const partial = buildAggregate({
      ts,
      runs,
      calibration,
      caseStats: [],
      costEstimateUsd: calibrationJudgeCostUsd,
      costBasis: 'measured-tokens',
      withinBudget: true,
    });
    writeFileSync(RESULT_FILE, `${JSON.stringify(partial, null, 2)}\n`);
    if (calibrationOutage) {
      console.error(
        `\nCALIBRATION SKIPPED due to judge API failures (${calibration.errored}/${calibration.total} errored, ` +
          `limit ${CALIBRATION_ERROR_FRACTION_LIMIT * 100}%), an outage, not drift. Re-run when the Gateway is healthy.`,
      );
    } else {
      console.error(
        `\nCALIBRATION GATE FAILED: ${describeCalibrationFailure(calibration)}. ` +
          'Inspect the disagreements before trusting any grade.',
      );
    }
    console.error(`result file (calibration-only) ${RESULT_FILE}`);
    process.exit(1);
  }
  console.log('  CALIBRATION PASSED\n');

  const abCases = abMode ? selectAbCases(cases) : [];
  if (abMode && abCases.length === 0) {
    console.error(
      '\nagent-eval --ab: no A/B cases declare both control + treatment arms (nothing to run)',
    );
    process.exit(1);
  }
  const billableCases = abMode ? abCases.length * 2 : cases.length;

  const projectedUsd = Number(
    estimateJobCostUsd({
      cases: billableCases,
      runs,
      approxTargetInputTokens: APPROX_AGENT_EVAL_INPUT_TOKENS,
      approxTargetOutputTokens: APPROX_FEATURE_OUTPUT_TOKENS,
      approxJudgeInputTokens: APPROX_AGENT_EVAL_INPUT_TOKENS,
      approxJudgeOutputTokens: APPROX_FEATURE_OUTPUT_TOKENS,
    }).toFixed(4),
  );
  const budget = assertWithinBudget({ projectedUsd, doubled: abMode });
  if (!budget.ok) {
    const aborted = buildAggregate({
      ts,
      runs,
      calibration,
      caseStats: [],
      costEstimateUsd: projectedUsd,
      withinBudget: false,
    });
    writeFileSync(RESULT_FILE, `${JSON.stringify(aborted, null, 2)}\n`);
    console.error(`\nCOST CEILING EXCEEDED: ${budget.reason}`);
    console.error(`result file (aborted) ${RESULT_FILE}`);
    process.exit(1);
  }
  const effectiveCap = abMode ? MAX_JOB_COST_USD * 2 : MAX_JOB_COST_USD;
  console.log(
    `agent-eval${abMode ? ' --ab' : ''}: ${billableCases} ${abMode ? 'arm-cases' : 'cases'} × ${runs} runs ` +
      `(projected ~$${projectedUsd}, cap $${effectiveCap} enforced on measured token usage)\n`,
  );

  const meter = createSpendMeter(effectiveCap);
  meter.addJudge({
    inputTokens: calibration.judgeInputTokens,
    outputTokens: calibration.judgeOutputTokens,
    cacheReadTokens: calibration.judgeCacheReadTokens,
    cacheWriteTokens: calibration.judgeCacheWriteTokens,
  });
  const knownHard = new Set(cases.filter((c) => c.knownHard).map((c) => c.id));

  let caseStats: CaseStats[] = [];
  let ab: AbResult | undefined;
  let budgetExceeded = false;

  if (abMode) {
    const arms = await runAbArms(abCases, { runs, judgeModel: MODELS.judge, meter });
    budgetExceeded = arms.budgetExceeded;
    caseStats = arms.treatment;
    ab = arms.ab;
    for (let i = 0; i < arms.treatment.length; i++) {
      const id = arms.treatment[i]?.id ?? '?';
      const cm = arms.control[i]?.mean ?? 0;
      const tm = arms.treatment[i]?.mean ?? 0;
      console.log(`  ${id}: control mean ${cm.toFixed(2)} → treatment mean ${tm.toFixed(2)}`);
    }
    console.log(
      `\n  A/B delta ${arms.ab.deltaMean >= 0 ? '+' : ''}${arms.ab.deltaMean.toFixed(3)} ` +
        `(control ${arms.ab.controlMean.toFixed(2)} → treatment ${arms.ab.treatmentMean.toFixed(2)}, ` +
        `stderr ${arms.ab.deltaStderr.toFixed(3)}${arms.ab.degraded ? ', DEGRADED' : ''})\n`,
    );
  } else {
    for (const c of cases) {
      const sampled = await sampleRuns(c, { runs, judgeModel: MODELS.judge, meter });
      if (sampled.budgetExceeded) {
        budgetExceeded = true;
        break;
      }
      const stats = aggregateCase(c.id, sampled.results);
      caseStats.push(stats);
      console.log(
        `  ${c.id}: pass@k=${stats.passAtK} pass^k=${stats.passHatK} mean=${stats.mean.toFixed(2)} var=${stats.variance.toFixed(3)}\n`,
      );
    }
  }

  const measuredUsd = Number(meter.spentUsd.toFixed(4));
  const aggregate = buildAggregate({
    ts,
    runs,
    calibration,
    caseStats,
    costEstimateUsd: measuredUsd,
    costBasis: 'measured-tokens',
    withinBudget: !budgetExceeded,
    failedCaseIds: failedCaseIds(caseStats, knownHard),
    ...(ab ? { ab } : {}),
  });

  writeFileSync(RESULT_FILE, `${JSON.stringify(aggregate, null, 2)}\n`);

  const publishResult = await publishWithCredentials(
    AGENT_EVAL_REDIS_KEY,
    aggregate,
    withheldRedisCredentials,
  );
  if (publishResult.published) {
    console.log(`\npublished aggregate → redis ${AGENT_EVAL_REDIS_KEY}`);
  }
  const publishError = publishOutcomeError(publishResult);
  if (publishError) console.error(`\n${publishError}`);

  console.log('\nagent-eval summary');
  for (const s of caseStats) {
    console.log(
      `  ${s.id.padEnd(28)} pass@k ${s.passAtK} · pass^k ${s.passHatK} · var ${s.variance.toFixed(3)}`,
    );
  }
  console.log(
    `  cost measured       ~$${aggregate.costEstimateUsd} from token usage (cap $${effectiveCap})`,
  );
  console.log(`  result file         ${RESULT_FILE}`);

  if (!aggregate.gate.passed) {
    console.error('\nGATE FAILED');
    for (const reason of describeGate(aggregate.gate)) console.error(`  - ${reason}`);
    process.exit(1);
  }
  if (publishError) process.exit(1);
  console.log('\nGATE PASSED');
}

const invokedDirectly =
  typeof process.argv[1] === 'string' &&
  import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;

if (invokedDirectly) {
  main().catch((err) => {
    console.error('agent-eval: fatal error', err);
    process.exit(1);
  });
}
