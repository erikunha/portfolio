import { describe, expect, it } from 'vitest';
import { ASK_RESERVED_INPUT_TOKENS } from '@/lib/ask/input-reservation';
import {
  APPROX_FEATURE_OUTPUT_TOKENS,
  APPROX_TYPICAL_FEATURE_INPUT_TOKENS,
  PRICING_USD_PER_MTOK,
  summarizeFeatureCost,
} from '@/lib/eval/cost';

const TOKENS_PER_MTOK = 1_000_000;
const typicalPerAnswerUsd =
  (APPROX_TYPICAL_FEATURE_INPUT_TOKENS * PRICING_USD_PER_MTOK.feature.input +
    APPROX_FEATURE_OUTPUT_TOKENS * PRICING_USD_PER_MTOK.feature.output) /
  TOKENS_PER_MTOK;
const reservedPerAnswerUsd =
  (ASK_RESERVED_INPUT_TOKENS * PRICING_USD_PER_MTOK.feature.input +
    APPROX_FEATURE_OUTPUT_TOKENS * PRICING_USD_PER_MTOK.feature.output) /
  TOKENS_PER_MTOK;

describe('the feature cost fallback is an estimate of use, not the budget reservation', () => {
  it('sizes the typical input below the conservative reservation', () => {
    expect(APPROX_TYPICAL_FEATURE_INPUT_TOKENS).toBeGreaterThan(0);
    expect(APPROX_TYPICAL_FEATURE_INPUT_TOKENS).toBeLessThan(ASK_RESERVED_INPUT_TOKENS);
  });

  it('prices answers with no metering at the typical input, not the reservation', () => {
    const { featureCostUsd } = summarizeFeatureCost([], 3);
    expect(featureCostUsd).toBeCloseTo(3 * typicalPerAnswerUsd, 10);
    expect(featureCostUsd).toBeLessThan(3 * reservedPerAnswerUsd);
  });

  it('fills unmetered answers with the mean of the metered ones and never the estimate', () => {
    const { featureCostUsd, measuredAnswers } = summarizeFeatureCost([0.002, 0.004], 5);
    expect(measuredAnswers).toBe(2);
    expect(featureCostUsd).toBeCloseTo(0.006 + 3 * 0.003, 10);
  });

  it('ignores metered values past the answered count', () => {
    const { featureCostUsd, measuredAnswers } = summarizeFeatureCost([0.002, 0.004, 0.9], 2);
    expect(measuredAnswers).toBe(2);
    expect(featureCostUsd).toBeCloseTo(0.006, 10);
  });
});
