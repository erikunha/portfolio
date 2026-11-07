import { describe, expect, it } from 'vitest';
import {
  estimateJobCostUsd,
  featureCostUsdFrom,
  judgeCostUsdFrom,
  PRICING_USD_PER_MTOK,
  summarizeFeatureCost,
} from '@/lib/eval/cost';

describe('lib/eval/cost', () => {
  it('judgeCostUsdFrom prices 1M in + 1M out at sonnet rates = 3.0 + 15.0', () => {
    expect(judgeCostUsdFrom(1_000_000, 1_000_000)).toBe(18.0);
  });

  it('judgeCostUsdFrom returns 0 for a zero-token call', () => {
    expect(judgeCostUsdFrom(0, 0)).toBe(0);
  });

  it('PRICING_USD_PER_MTOK has the documented feature + judge shape', () => {
    expect(PRICING_USD_PER_MTOK.feature).toEqual({ input: 1.0, output: 5.0 });
    expect(PRICING_USD_PER_MTOK.judge).toEqual({ input: 3.0, output: 15.0 });
  });

  it('estimateJobCostUsd projects cases × runs × (target + judge) spend', () => {
    const projected = estimateJobCostUsd({
      cases: 2,
      runs: 1,
      approxTargetInputTokens: 1_000_000,
      approxTargetOutputTokens: 1_000_000,
      approxJudgeInputTokens: 1_000_000,
      approxJudgeOutputTokens: 1_000_000,
    });
    expect(projected).toBe(48.0);
  });

  it('estimateJobCostUsd returns 0 for a zero-run projection', () => {
    expect(
      estimateJobCostUsd({
        cases: 5,
        runs: 0,
        approxTargetInputTokens: 100,
        approxTargetOutputTokens: 100,
        approxJudgeInputTokens: 100,
        approxJudgeOutputTokens: 100,
      }),
    ).toBe(0);
  });

  it('featureCostUsdFrom prices cache reads at 0.1x and cache writes at 1.25x', () => {
    const cost = featureCostUsdFrom({
      billedInputTokens: 1_000_000,
      cacheReadTokens: 400_000,
      cacheWriteTokens: 100_000,
      outputTokens: 100_000,
    });
    expect(cost).toBeCloseTo(0.5 + 0.04 + 0.125 + 0.5, 10);
  });

  it('summarizeFeatureCost sums measured answers and fills gaps with their mean', () => {
    const summary = summarizeFeatureCost([0.004, 0.006], 4);
    expect(summary.measuredAnswers).toBe(2);
    expect(summary.featureCostUsd).toBeCloseTo(0.02, 10);
  });

  it('summarizeFeatureCost falls back to the approximation when nothing was measured', () => {
    const summary = summarizeFeatureCost([], 2);
    expect(summary.measuredAnswers).toBe(0);
    expect(summary.featureCostUsd).toBeCloseTo((2 * (1700 * 1 + 350 * 5)) / 1_000_000, 10);
  });
});
