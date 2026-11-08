import { describe, expect, it } from 'vitest';
import type { CaseStats } from '@/lib/eval/montecarlo';
import type { CalibrationResult } from '@/lib/eval/types';
import { AGENT_EVAL_REDIS_KEY, buildAggregate, describeGate, MODELS } from '@/scripts/agent-eval';

function calibration(passed: boolean): CalibrationResult {
  return {
    cases: [],
    total: 8,
    agreed: passed ? 8 : 4,
    agreement: passed ? 1.0 : 0.5,
    positives: 4,
    negatives: 4,
    truePositives: passed ? 4 : 2,
    trueNegatives: passed ? 4 : 2,
    tpr: passed ? 1 : 0.5,
    tnr: passed ? 1 : 0.5,
    agreementPassed: passed,
    tnrPassed: passed,
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
    expect(agg.ts).toBe(TS);
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

  it('gate.passed needs calibration, budget, passing cases and a non-degraded A/B', () => {
    const base = {
      ts: TS,
      runs: 3,
      calibration: calibration(true),
      caseStats,
      costEstimateUsd: 0.42,
      withinBudget: true,
    };
    const ok = buildAggregate(base);
    expect(ok.gate).toEqual({
      calibrationPassed: true,
      withinBudget: true,
      harnessPassed: true,
      casesPassed: true,
      failedCaseIds: [],
      abDegraded: false,
      passed: true,
    });

    const calFail = buildAggregate({ ...base, calibration: calibration(false) });
    expect(calFail.gate.passed).toBe(false);
    expect(calFail.gate.calibrationPassed).toBe(false);
    expect(calFail.gate.harnessPassed).toBe(false);

    const overBudget = buildAggregate({ ...base, costEstimateUsd: 9.0, withinBudget: false });
    expect(overBudget.gate.passed).toBe(false);
    expect(overBudget.gate.withinBudget).toBe(false);
  });

  it('a healthy harness does not read as a pass when a case never passed', () => {
    const agg = buildAggregate({
      ts: TS,
      runs: 3,
      calibration: calibration(true),
      caseStats,
      costEstimateUsd: 0.42,
      withinBudget: true,
      failedCaseIds: ['b'],
    });
    expect(agg.gate.harnessPassed).toBe(true);
    expect(agg.gate.casesPassed).toBe(false);
    expect(agg.gate.failedCaseIds).toEqual(['b']);
    expect(agg.gate.passed).toBe(false);
    expect(describeGate(agg.gate)).toEqual(['cases that never passed: b']);
  });

  it('a degraded A/B delta fails the gate', () => {
    const agg = buildAggregate({
      ts: TS,
      runs: 3,
      calibration: calibration(true),
      caseStats,
      costEstimateUsd: 0.42,
      withinBudget: true,
      ab: {
        controlMean: 1,
        treatmentMean: 0.4,
        deltaMean: -0.6,
        deltaStddev: 0.3,
        deltaStderr: 0.1,
        degraded: true,
      },
    });
    expect(agg.gate.abDegraded).toBe(true);
    expect(agg.gate.passed).toBe(false);
    expect(describeGate(agg.gate)).toEqual(['the treatment arm degraded against the control']);
  });

  it('describes every failing part of the gate', () => {
    expect(
      describeGate({
        calibrationPassed: false,
        withinBudget: false,
        harnessPassed: false,
        casesPassed: true,
        failedCaseIds: [],
        abDegraded: false,
        passed: false,
      }),
    ).toEqual(['judge calibration failed', 'cost cap exceeded']);
  });

  it('records whether the cost is measured from token usage or only projected', () => {
    const measured = buildAggregate({
      ts: TS,
      runs: 3,
      calibration: calibration(true),
      caseStats,
      costEstimateUsd: 0.42,
      costBasis: 'measured-tokens',
      withinBudget: true,
    });
    expect(measured.costBasis).toBe('measured-tokens');
  });
});
