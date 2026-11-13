import { describe, expect, it } from 'vitest';
import { ASK_RESERVED_INPUT_TOKENS } from '@/lib/ask/input-reservation';
import {
  APPROX_AGENT_EVAL_INPUT_TOKENS,
  APPROX_FEATURE_INPUT_TOKENS,
  APPROX_FEATURE_OUTPUT_TOKENS,
  PRICING_USD_PER_MTOK,
  summarizeFeatureCost,
} from '@/lib/eval/cost';

const TOKENS_PER_MTOK = 1_000_000;

describe('the unmetered feature cost approximation tracks the real prompt', () => {
  it('sizes the input from the ask input reservation, not a stale literal', () => {
    expect(APPROX_FEATURE_INPUT_TOKENS).toBe(ASK_RESERVED_INPUT_TOKENS);
  });

  it('prices an unmetered answer from that input and the approximate output', () => {
    const perAnswer =
      (APPROX_FEATURE_INPUT_TOKENS * PRICING_USD_PER_MTOK.feature.input +
        APPROX_FEATURE_OUTPUT_TOKENS * PRICING_USD_PER_MTOK.feature.output) /
      TOKENS_PER_MTOK;
    expect(summarizeFeatureCost([], 2).featureCostUsd).toBeCloseTo(2 * perAnswer, 10);
  });

  it('keeps the agent-eval projection on its own small-prompt size so the job cap is unchanged', () => {
    expect(APPROX_AGENT_EVAL_INPUT_TOKENS).toBeLessThan(APPROX_FEATURE_INPUT_TOKENS);
  });
});
