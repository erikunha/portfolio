import { describe, expect, it } from 'vitest';
import { ASK_RESERVED_INPUT_TOKENS } from '@/lib/ask/input-reservation';
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

  it('judgeCostUsdFrom prices cache reads at 0.1x and cache writes at 1.25x of the input rate', () => {
    const uncached = judgeCostUsdFrom(1_000_000, 0);
    const cachedRead = judgeCostUsdFrom(1_000_000, 0, { cacheReadTokens: 1_000_000 });
    const cachedWrite = judgeCostUsdFrom(1_000_000, 0, { cacheWriteTokens: 1_000_000 });
    expect(cachedRead).toBeCloseTo(uncached * 0.1, 10);
    expect(cachedWrite).toBeCloseTo(uncached * 1.25, 10);
  });

  it('judgeCostUsdFrom bills only the uncached remainder at the full rate', () => {
    const mixed = judgeCostUsdFrom(1_000_000, 0, { cacheReadTokens: 900_000 });
    expect(mixed).toBeCloseTo(((100_000 + 90_000) * 3.0) / 1_000_000, 10);
  });

  it('judgeCostUsdFrom returns 0 for a zero-token call', () => {
    expect(judgeCostUsdFrom(0, 0)).toBe(0);
  });

  it('PRICING_USD_PER_MTOK has the documented feature + judge shape', () => {
    expect(PRICING_USD_PER_MTOK.feature).toEqual({ input: 0.1, output: 0.5 });
    expect(PRICING_USD_PER_MTOK.mechanical).toEqual({ input: 1.0, output: 5.0 });
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
    expect(cost).toBeCloseTo(0.05 + 0.004 + 0.0125 + 0.05, 10);
  });

  it('summarizeFeatureCost sums measured answers and fills gaps with their mean', () => {
    const summary = summarizeFeatureCost([0.004, 0.006], 4);
    expect(summary.measuredAnswers).toBe(2);
    expect(summary.featureCostUsd).toBeCloseTo(0.02, 10);
  });

  it('summarizeFeatureCost falls back to the approximation when nothing was measured', () => {
    const summary = summarizeFeatureCost([], 2);
    expect(summary.measuredAnswers).toBe(0);
    expect(summary.featureCostUsd).toBeCloseTo(
      (2 * (ASK_RESERVED_INPUT_TOKENS * 0.1 + 350 * 0.5)) / 1_000_000,
      10,
    );
  });
});
