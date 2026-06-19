#!/usr/bin/env tsx
/**
 * scripts/agent-eval.ts — Monte-Carlo prompt-regression harness for the
 * PLATFORM's own prompts/rules/agents. Distinct from scripts/ask-eval.ts, which
 * evals the /api/ask PRODUCT. Shares the lib/eval/ core (one judge prompt, one
 * cost model) but a separate corpus (evals/agents/), result file
 * (agent-eval-result.json), and Redis key (agent-eval:latest).
 *
 * WHAT IT DOES
 *   1. Calibration FIRST: runs evals/agents/calibration.ts through the shared
 *      judge and gates on MIN_CALIBRATION_AGREEMENT (0.85). A drifted judge
 *      fails BEFORE the corpus spends Gateway tokens.
 *   2. Cost pre-flight: projects the job cost and aborts if it exceeds
 *      MAX_JOB_COST_USD (2.0) — no model call happens over budget.
 *   3. Monte-Carlo loop: each case × N runs → runTarget (tiered model) →
 *      gradeRun (code-first / judge) → aggregateCase (pass@k / pass^k /
 *      variance). N is EVAL_RUNS (default 3, hard-clamped to <=5).
 *   4. Writes agent-eval-result.json and (env-gated) publishes agent-eval:latest.
 *
 * FIDELITY NOTE: runTarget is a single generateText call with the rule as
 * systemText — a PROXY for "the agent given this rule", not a full agent loop.
 * The harness measures prompt-adherence, not end-to-end agent behavior.
 *
 * Run via: pnpm eval:agents  (TSX_TSCONFIG_PATH=scripts/tsconfig.eval.json).
 */

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

// Tiered models. Mechanical cases → haiku; judgment cases → sonnet. The judge
// must be >= the model it grades, so it is sonnet regardless of tier.
export const MODELS = {
  mechanical: 'anthropic/claude-haiku-4-5',
  judgment: 'anthropic/claude-sonnet-4-6',
  judge: 'anthropic/claude-sonnet-4-6',
} as const;

// Redis key the aggregate publishes under. DISTINCT from ask:eval:latest — the
// two harnesses must never collide on one key (C-d.1 pins this with a dedicated
// test; the runner needs the constant now for the publishAggregate call).
export const AGENT_EVAL_REDIS_KEY = 'agent-eval:latest';

// Local artifact path — the JSON CI uploads for the run.
const RESULT_FILE = path.resolve(process.cwd(), 'agent-eval-result.json');

// Per-run count. EVAL_RUNS overrides the default 3; HARD-clamped to <=5 (and
// >=1) so a typo can never blow the cost ceiling via an unbounded N.
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
  // Present only on an --ab run: the control-vs-treatment success-rate delta.
  ab?: AbResult;
};

/**
 * Pure aggregate assembler. Folds the calibration result, per-case Monte-Carlo
 * stats, the cost estimate, and the budget verdict into the published shape and
 * computes the run-level gate: the run PASSES only when calibration passed AND
 * the projection was within budget. `ts` is injected by the caller (not read
 * from the clock here) so this stays pure and unit-testable against an exact
 * timestamp.
 */
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
    // Only fold the A/B block when present; a single-arm run omits the key
    // entirely rather than emitting a null/empty placeholder.
    ...(args.ab ? { ab: args.ab } : {}),
  };
}

/**
 * Runs the control + treatment arms for a set of A/B cases and computes the
 * delta. Each case is executed twice per run (once with the control systemText,
 * once with the treatment systemText), swapping only the rule under test. The
 * per-arm Monte-Carlo stats feed abDelta(). Uses the same runTarget/gradeRun
 * seam as the single-arm loop, so the `ai` SDK mock at the module boundary
 * covers both. Impure ONLY through the injected SDK calls (no clock / no random
 * read here); the caller injects the run timestamp into buildAggregate.
 */
export async function runAbArms(
  abCases: Array<AbCase<LoadedCase>>,
  opts: { runs: number; judgeModel: string },
): Promise<{ control: CaseStats[]; treatment: CaseStats[]; ab: AbResult }> {
  const control: CaseStats[] = [];
  const treatment: CaseStats[] = [];

  for (const c of abCases) {
    const model = targetModelFor(c.tier);
    // Run one arm: swap the case's systemText for the arm variant, keep the
    // prompt + grader identical so the ONLY difference is the rule under test.
    const runArm = async (systemText: string): Promise<CaseStats> => {
      const armCase = { ...c, target: { ...c.target, systemText } };
      const runResults: boolean[] = [];
      for (let i = 0; i < opts.runs; i++) {
        const target = await runTarget(armCase, { model });
        if (target.errored) {
          // Surface the failure detail (as the single-arm loop does) so an arm
          // error is diagnosable, not silently counted as a fail.
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

// Tiered target model for a case.
function targetModelFor(tier: 'mechanical' | 'judgment'): string {
  return tier === 'mechanical' ? MODELS.mechanical : MODELS.judgment;
}

async function main(): Promise<void> {
  // Guard: AI_GATEWAY_API_KEY drives both the target and the judge. In CI a
  // missing key is a hard failure (a silent exit 0 would let the job pass
  // without running any eval); locally the key is often absent — exit 0.
  if (!process.env.AI_GATEWAY_API_KEY) {
    if (process.env.CI) {
      console.error('agent-eval: AI_GATEWAY_API_KEY is required in CI but not set — aborting');
      process.exit(1);
    }
    console.log('agent-eval skipped: AI_GATEWAY_API_KEY not configured');
    process.exit(0);
  }

  // Single run timestamp, read from the clock once here (the only impure read)
  // and injected into every buildAggregate() call so the assembler stays pure.
  const ts = new Date().toISOString();
  const runs = resolveRuns(process.env.EVAL_RUNS);
  // --ab runs control + treatment over the A/B-eligible cases; its cost cap is
  // doubled (2 × MAX_JOB_COST_USD) because both arms run.
  const abMode = process.argv.includes('--ab');
  const cases = await loadCases();

  // ── Calibration FIRST ────────────────────────────────────────────────────
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
    // Write a calibration-only result so CI uploads an inspectable artifact even
    // though the corpus never ran. The corpus is intentionally skipped (cases
    // empty), and the calibration judge spend is the only cost incurred.
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

  // In --ab mode only the A/B-eligible cases run, each over BOTH arms; the
  // billable case-count is therefore 2 × the A/B case count, and the cap is the
  // doubled cap. A single-arm run bills the whole corpus once at the single cap.
  const abCases = abMode ? selectAbCases(cases) : [];
  if (abMode && abCases.length === 0) {
    console.error(
      '\nagent-eval --ab: no A/B cases declare both control + treatment arms (nothing to run)',
    );
    process.exit(1);
  }
  const billableCases = abMode ? abCases.length * 2 : cases.length;

  // ── Cost pre-flight ──────────────────────────────────────────────────────
  // Project the corpus cost BEFORE any target/judge call and abort over the cap.
  // The target side is approximated from the feature token constants; the judge
  // side from the same approximation (judge graders read a comparable payload).
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

  // ── A/B path: run control + treatment arms and compute the delta ──────────
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
    // The treatment stats are the per-case stats of record for an A/B run.
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

  // ── Monte-Carlo loop ─────────────────────────────────────────────────────
  const caseStats: CaseStats[] = [];
  for (const c of cases) {
    const targetModel = targetModelFor(c.tier);
    const runResults: boolean[] = [];
    for (let i = 0; i < runs; i++) {
      const target = await runTarget(c, { model: targetModel });
      if (target.errored) {
        // A target invocation failure is a non-passing run, recorded not dropped.
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

// Entrypoint guard: run main() ONLY when this file is the process entrypoint
// (pnpm eval:agents), never when it is imported by a unit test for buildAggregate
// / the exported constants. Without this, importing the module would launch the
// full I/O loop under Vitest.
const invokedDirectly =
  typeof process.argv[1] === 'string' && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  main().catch((err) => {
    console.error('agent-eval: fatal error', err);
    process.exit(1);
  });
}
