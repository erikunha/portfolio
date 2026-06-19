// lib/eval/cost.ts
//
// The eval cost model. PRICING_USD_PER_MTOK, judgeCostUsdFrom, and the
// APPROX_FEATURE_* constants are extracted verbatim from scripts/ask-eval.ts so
// the whole cost model lives in one place shared by both harnesses.
// estimateJobCostUsd is new: a PROJECTED pre-run cost the agent-eval cap check
// (C-b.6) consumes before any model call.

// Rough cost model for the estimate line. Haiku-4.5 + Sonnet-4.6 public
// per-MTok pricing at time of writing (USD). This is an ORDER-OF-MAGNITUDE
// estimate for the run, not a billing figure — the authoritative spend is
// the Gateway dashboard.
export const PRICING_USD_PER_MTOK = {
  feature: { input: 1.0, output: 5.0 }, // claude-haiku-4-5
  judge: { input: 3.0, output: 15.0 }, // claude-sonnet-4-6
} as const;

// Judge-side spend (USD) from real token usage. Used for BOTH the calibration
// pass and the corpus pass so the run-level cost never under-reports grading
// spend (calibration invokes the judge once per gold case). Returns the raw
// (unrounded) cost so call sites can sum before the single toFixed(4) rounding.
export const judgeCostUsdFrom = (inputTokens: number, outputTokens: number): number =>
  (inputTokens * PRICING_USD_PER_MTOK.judge.input +
    outputTokens * PRICING_USD_PER_MTOK.judge.output) /
  1_000_000;

// Feature-side per-item token approximation. The route consumes the feature's
// real `result.usage` internally for budget settlement and does not expose it
// to the caller, so the feature side of the cost estimate is approximated from
// the SYSTEM prompt size + a typical answer length. Hoisted here next to
// PRICING_USD_PER_MTOK so the whole cost model lives in one place.
export const APPROX_FEATURE_INPUT_TOKENS = 1700; // ~SYSTEM_TEXT + wrapped question
export const APPROX_FEATURE_OUTPUT_TOKENS = 350; // typical answer under the 512 cap

/**
 * Projected pre-run cost for a Monte-Carlo agent-eval job. The runner computes
 * this BEFORE the first model call and feeds it to the cost-ceiling check
 * (assertWithinBudget). Per run, each case pays one target invocation (feature
 * pricing) and one judge invocation (judge pricing); the projection scales that
 * by cases × runs. Returns the raw (unrounded) USD figure.
 */
export function estimateJobCostUsd(args: {
  cases: number;
  runs: number;
  approxTargetInputTokens: number;
  approxTargetOutputTokens: number;
  approxJudgeInputTokens: number;
  approxJudgeOutputTokens: number;
}): number {
  const targetPerRun =
    (args.approxTargetInputTokens * PRICING_USD_PER_MTOK.feature.input +
      args.approxTargetOutputTokens * PRICING_USD_PER_MTOK.feature.output) /
    1_000_000;
  const judgePerRun = judgeCostUsdFrom(args.approxJudgeInputTokens, args.approxJudgeOutputTokens);
  return args.cases * args.runs * (targetPerRun + judgePerRun);
}
