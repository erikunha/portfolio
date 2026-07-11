#!/usr/bin/env tsx

import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { AGENT_EVAL_CALIBRATION } from '@/evals/agents/calibration';
import { type LoadedCase, loadCases } from '@/evals/agents/load';
import { type AbCase, selectAbCases } from '@/evals/agents/schema';
import { type AbResult, abDelta } from '@/lib/eval/ab';
import { assertWithinBudget, MAX_JOB_COST_USD } from '@/lib/eval/budget';
import {
  CALIBRATION_ERROR_FRACTION_LIMIT,
  MIN_CALIBRATION_AGREEMENT,
  runCalibration,
} from '@/lib/eval/calibration';
import {
  APPROX_FEATURE_INPUT_TOKENS,
  APPROX_FEATURE_OUTPUT_TOKENS,
  estimateJobCostUsd,
  judgeCostUsdFrom,
} from '@/lib/eval/cost';
import { gradeRun } from '@/lib/eval/grade';
import { aggregateCase, type CaseStats } from '@/lib/eval/montecarlo';
import { publishAggregate } from '@/lib/eval/redis-publish';
import { runTarget } from '@/lib/eval/run-target';
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
  calibration: {
    total: number;
    agreed: number;
    agreement: number;
    passed: boolean;
    minAgreement: number;
    errored: number;
  };
  cases: CaseStats[];
  costEstimateUsd: number;
  maxJobCostUsd: number;
  gate: { calibrationPassed: boolean; withinBudget: boolean; passed: boolean };
  ab?: AbResult;
};

export function buildAggregate(args: {
  ts: string;
  runs: number;
  calibration: CalibrationResult;
  caseStats: CaseStats[];
  costEstimateUsd: number;
  withinBudget: boolean;
  ab?: AbResult;
}): AgentEvalAggregate {
  const calibrationPassed = args.calibration.passed;
  return {
    ts: args.ts,
    targetModelMechanical: MODELS.mechanical,
    targetModelJudgment: MODELS.judgment,
    judgeModel: MODELS.judge,
    runs: args.runs,
    calibration: {
      total: args.calibration.total,
      agreed: args.calibration.agreed,
      agreement: args.calibration.agreement,
      passed: calibrationPassed,
      minAgreement: MIN_CALIBRATION_AGREEMENT,
      errored: args.calibration.errored,
    },
    cases: args.caseStats,
    costEstimateUsd: args.costEstimateUsd,
    maxJobCostUsd: MAX_JOB_COST_USD,
    gate: {
      calibrationPassed,
      withinBudget: args.withinBudget,
      passed: calibrationPassed && args.withinBudget,
    },
    ...(args.ab ? { ab: args.ab } : {}),
  };
}

export async function runAbArms(
  abCases: Array<AbCase<LoadedCase>>,
  opts: { runs: number; judgeModel: string },
): Promise<{ control: CaseStats[]; treatment: CaseStats[]; ab: AbResult }> {
  const control: CaseStats[] = [];
  const treatment: CaseStats[] = [];

  for (const c of abCases) {
    const model = targetModelFor(c.tier);
    const runArm = async (systemText: string): Promise<CaseStats> => {
      const armCase = { ...c, target: { ...c.target, systemText } };
      const runResults: boolean[] = [];
      for (let i = 0; i < opts.runs; i++) {
        const target = await runTarget(armCase, { model });
        if (target.errored) {
          console.log(
            `  ERROR (A/B) [${c.tier}] ${c.id} run ${i + 1}/${opts.runs} — ${target.detail}`,
          );
          runResults.push(false);
          continue;
        }
        const verdict = await gradeRun(armCase, target.output, { judgeModel: opts.judgeModel });
        runResults.push(verdict.pass);
      }
      return aggregateCase(c.id, runResults);
    };

    control.push(await runArm(c.control.systemText));
    treatment.push(await runArm(c.treatment.systemText));
  }

  return { control, treatment, ab: abDelta(control, treatment) };
}

function targetModelFor(tier: 'mechanical' | 'judgment'): string {
  return tier === 'mechanical' ? MODELS.mechanical : MODELS.judgment;
}

async function main(): Promise<void> {
  if (!process.env.AI_GATEWAY_API_KEY) {
    if (process.env.CI) {
      console.error('agent-eval: AI_GATEWAY_API_KEY is required in CI but not set — aborting');
      process.exit(1);
    }
    console.log('agent-eval skipped: AI_GATEWAY_API_KEY not configured');
    process.exit(0);
  }

  const ts = new Date().toISOString();
  const runs = resolveRuns(process.env.EVAL_RUNS);
  const abMode = process.argv.includes('--ab');
  const cases = await loadCases();

  console.log(
    `agent-eval: calibration — ${AGENT_EVAL_CALIBRATION.length} gold cases → judge ${MODELS.judge}\n`,
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
      judgeCostUsdFrom(calibration.judgeInputTokens, calibration.judgeOutputTokens).toFixed(4),
    );
    const partial = buildAggregate({
      ts,
      runs,
      calibration,
      caseStats: [],
      costEstimateUsd: calibrationJudgeCostUsd,
      withinBudget: true,
    });
    writeFileSync(RESULT_FILE, `${JSON.stringify(partial, null, 2)}\n`);
    if (calibrationOutage) {
      console.error(
        `\nCALIBRATION SKIPPED due to judge API failures (${calibration.errored}/${calibration.total} errored, ` +
          `limit ${CALIBRATION_ERROR_FRACTION_LIMIT * 100}%) — an outage, not drift. Re-run when the Gateway is healthy.`,
      );
    } else {
      console.error(
        `\nCALIBRATION GATE FAILED — judge agreement ${(calibration.agreement * 100).toFixed(1)}% ` +
          `(min ${MIN_CALIBRATION_AGREEMENT * 100}%). Inspect the disagreements before trusting any grade.`,
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
      approxTargetInputTokens: APPROX_FEATURE_INPUT_TOKENS,
      approxTargetOutputTokens: APPROX_FEATURE_OUTPUT_TOKENS,
      approxJudgeInputTokens: APPROX_FEATURE_INPUT_TOKENS,
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
    console.error(`\nCOST CEILING EXCEEDED — ${budget.reason}`);
    console.error(`result file (aborted) ${RESULT_FILE}`);
    process.exit(1);
  }
  const effectiveCap = abMode ? MAX_JOB_COST_USD * 2 : MAX_JOB_COST_USD;
  console.log(
    `agent-eval${abMode ? ' --ab' : ''}: ${billableCases} ${abMode ? 'arm-cases' : 'cases'} × ${runs} runs ` +
      `(projected ~$${projectedUsd}, cap $${effectiveCap})\n`,
  );

  if (abMode) {
    const { control, treatment, ab } = await runAbArms(abCases, {
      runs,
      judgeModel: MODELS.judge,
    });
    for (let i = 0; i < abCases.length; i++) {
      const id = abCases[i]?.id ?? '?';
      const cm = control[i]?.mean ?? 0;
      const tm = treatment[i]?.mean ?? 0;
      console.log(`  ${id}: control mean ${cm.toFixed(2)} → treatment mean ${tm.toFixed(2)}`);
    }
    console.log(
      `\n  A/B delta ${ab.deltaMean >= 0 ? '+' : ''}${ab.deltaMean.toFixed(3)} ` +
        `(control ${ab.controlMean.toFixed(2)} → treatment ${ab.treatmentMean.toFixed(2)}, ` +
        `stddev ${ab.deltaStddev.toFixed(3)}${ab.degraded ? ', DEGRADED' : ''})\n`,
    );
    const aggregate = buildAggregate({
      ts,
      runs,
      calibration,
      caseStats: treatment,
      costEstimateUsd: projectedUsd,
      withinBudget: true,
      ab,
    });
    writeFileSync(RESULT_FILE, `${JSON.stringify(aggregate, null, 2)}\n`);
    const published = await publishAggregate(AGENT_EVAL_REDIS_KEY, aggregate);
    if (published.published) console.log(`published aggregate → redis ${AGENT_EVAL_REDIS_KEY}`);
    else if (published.error) console.error(`redis publish failed (non-fatal): ${published.error}`);
    console.log(`  result file         ${RESULT_FILE}`);
    console.log('\nGATE PASSED');
    return;
  }

  const caseStats: CaseStats[] = [];
  for (const c of cases) {
    const targetModel = targetModelFor(c.tier);
    const runResults: boolean[] = [];
    for (let i = 0; i < runs; i++) {
      const target = await runTarget(c, { model: targetModel });
      if (target.errored) {
        runResults.push(false);
        console.log(`  ERROR [${c.tier}] ${c.id} run ${i + 1}/${runs} — ${target.detail}`);
        continue;
      }
      const verdict = await gradeRun(c, target.output, { judgeModel: MODELS.judge });
      runResults.push(verdict.pass);
      console.log(
        `  ${verdict.pass ? 'PASS' : 'FAIL'} [${c.tier}] ${c.id} run ${i + 1}/${runs} — ${verdict.reason}`,
      );
    }
    const stats = aggregateCase(c.id, runResults);
    caseStats.push(stats);
    console.log(
      `  ${c.id}: pass@k=${stats.passAtK} pass^k=${stats.passHatK} mean=${stats.mean.toFixed(2)} var=${stats.variance.toFixed(3)}\n`,
    );
  }

  const aggregate = buildAggregate({
    ts,
    runs,
    calibration,
    caseStats,
    costEstimateUsd: projectedUsd,
    withinBudget: true,
  });

  writeFileSync(RESULT_FILE, `${JSON.stringify(aggregate, null, 2)}\n`);

  const publishResult = await publishAggregate(AGENT_EVAL_REDIS_KEY, aggregate);
  if (publishResult.published) {
    console.log(`\npublished aggregate → redis ${AGENT_EVAL_REDIS_KEY}`);
  } else if (publishResult.error) {
    console.error(`\nredis publish failed (non-fatal): ${publishResult.error}`);
  }

  console.log('\nagent-eval summary');
  for (const s of caseStats) {
    console.log(
      `  ${s.id.padEnd(28)} pass@k ${s.passAtK} · pass^k ${s.passHatK} · var ${s.variance.toFixed(3)}`,
    );
  }
  console.log(`  cost estimate       ~$${aggregate.costEstimateUsd} (cap $${MAX_JOB_COST_USD})`);
  console.log(`  result file         ${RESULT_FILE}`);
  console.log('\nGATE PASSED');
}

const invokedDirectly =
  typeof process.argv[1] === 'string' && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  main().catch((err) => {
    console.error('agent-eval: fatal error', err);
    process.exit(1);
  });
}
