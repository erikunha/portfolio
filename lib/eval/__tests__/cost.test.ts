import { describe, expect, it } from 'vitest';
import { estimateJobCostUsd, judgeCostUsdFrom, PRICING_USD_PER_MTOK } from '@/lib/eval/cost';

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
});
