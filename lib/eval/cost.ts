export const PRICING_USD_PER_MTOK = {
  feature: { input: 1.0, output: 5.0 },
  judge: { input: 3.0, output: 15.0 },
} as const;

export const judgeCostUsdFrom = (inputTokens: number, outputTokens: number): number =>
  (inputTokens * PRICING_USD_PER_MTOK.judge.input +
    outputTokens * PRICING_USD_PER_MTOK.judge.output) /
  1_000_000;

export const APPROX_FEATURE_INPUT_TOKENS = 1700;
export const APPROX_FEATURE_OUTPUT_TOKENS = 350;

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
