// __tests__/agent-eval-runner.test.ts
// Unit test for the runner's PURE aggregation (scripts/agent-eval.ts
// buildAggregate). The main() I/O loop is exercised by the integration check
// (C-b.8); here we assert only that buildAggregate assembles the
// AgentEvalAggregate shape correctly and computes the gate from its inputs.

import { describe, expect, it } from 'vitest';
import type { CaseStats } from '@/lib/eval/montecarlo';
import type { CalibrationResult } from '@/lib/eval/types';
import { AGENT_EVAL_REDIS_KEY, buildAggregate, MODELS } from '@/scripts/agent-eval';

function calibration(passed: boolean): CalibrationResult {
  return {
    cases: [],
    total: 8,
    agreed: passed ? 8 : 4,
    agreement: passed ? 1.0 : 0.5,
    errored: 0,
    passed,
    judgeInputTokens: 100,
    judgeOutputTokens: 40,
  };
}

const caseStats: CaseStats[] = [
  { id: 'a', runs: 3, passes: 3, passAtK: 1, passHatK: 1, mean: 1, variance: 0, stddev: 0 },
  {
    id: 'b',
    runs: 3,
    passes: 1,
    passAtK: 1,
    passHatK: 0,
    mean: 1 / 3,
    variance: 0.2222,
    stddev: 0.4714,
  },
];

// Fixed timestamp injected into buildAggregate (now pure) so the `ts` field is
// asserted exactly, not just typeof-checked.
const TS = '2026-06-19T12:00:00.000Z';

describe('scripts/agent-eval buildAggregate', () => {
  it('exposes the pinned distinct Redis key and the tiered models', () => {
    expect(AGENT_EVAL_REDIS_KEY).toBe('agent-eval:latest');
    expect(MODELS.mechanical).toContain('haiku');
    expect(MODELS.judgment).toContain('sonnet');
    expect(MODELS.judge).toContain('sonnet');
  });

  it('assembles the full aggregate shape', () => {
    const agg = buildAggregate({
      ts: TS,
      runs: 3,
      calibration: calibration(true),
      caseStats,
      costEstimateUsd: 0.42,
      withinBudget: true,
    });
    expect(agg.ts).toBe(TS); // injected verbatim — buildAggregate is now pure
    expect(agg.targetModelMechanical).toBe(MODELS.mechanical);
    expect(agg.targetModelJudgment).toBe(MODELS.judgment);
    expect(agg.judgeModel).toBe(MODELS.judge);
    expect(agg.runs).toBe(3);
    expect(agg.calibration.agreement).toBe(1.0);
    expect(agg.calibration.passed).toBe(true);
    expect(agg.calibration.minAgreement).toBe(0.85);
    expect(agg.cases).toHaveLength(2);
    expect(agg.costEstimateUsd).toBe(0.42);
    expect(agg.maxJobCostUsd).toBe(2.0);
  });

  it('gate.passed is true only when calibration passed AND within budget', () => {
    const ok = buildAggregate({
      ts: TS,
      runs: 3,
      calibration: calibration(true),
      caseStats,
      costEstimateUsd: 0.42,
      withinBudget: true,
    });
    expect(ok.gate).toEqual({ calibrationPassed: true, withinBudget: true, passed: true });

    const calFail = buildAggregate({
      ts: TS,
      runs: 3,
      calibration: calibration(false),
      caseStats,
      costEstimateUsd: 0.42,
      withinBudget: true,
    });
    expect(calFail.gate.passed).toBe(false);
    expect(calFail.gate.calibrationPassed).toBe(false);

    const overBudget = buildAggregate({
      ts: TS,
      runs: 3,
      calibration: calibration(true),
      caseStats,
      costEstimateUsd: 9.0,
      withinBudget: false,
    });
    expect(overBudget.gate.passed).toBe(false);
    expect(overBudget.gate.withinBudget).toBe(false);
  });
});
