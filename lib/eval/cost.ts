import { ASK_PRICING_USD_PER_MTOK, CACHE_PRICE_MULTIPLIER } from '@/lib/ask/pricing';
import { SYSTEM_TEXT } from '@/lib/ask/system-prompt';

export { CACHE_PRICE_MULTIPLIER };

export const PRICING_USD_PER_MTOK = {
  feature: ASK_PRICING_USD_PER_MTOK,
  mechanical: { input: 1.0, output: 5.0 },
  judge: { input: 3.0, output: 15.0 },
} as const;

export const featureCostUsdFrom = (counts: {
  billedInputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  outputTokens: number;
}): number => {
  const plainInput = Math.max(
    0,
    counts.billedInputTokens - counts.cacheReadTokens - counts.cacheWriteTokens,
  );
  const inputUnits =
    plainInput +
    counts.cacheReadTokens * CACHE_PRICE_MULTIPLIER.read +
    counts.cacheWriteTokens * CACHE_PRICE_MULTIPLIER.write;
  return (
    (inputUnits * PRICING_USD_PER_MTOK.feature.input +
      counts.outputTokens * PRICING_USD_PER_MTOK.feature.output) /
    1_000_000
  );
};

const TOKENS_PER_MTOK = 1_000_000;

export const judgeCostUsdFrom = (
  inputTokens: number,
  outputTokens: number,
  cache: { cacheReadTokens?: number; cacheWriteTokens?: number } = {},
): number => {
  const cacheReadTokens = cache.cacheReadTokens ?? 0;
  const cacheWriteTokens = cache.cacheWriteTokens ?? 0;
  const plainInput = Math.max(0, inputTokens - cacheReadTokens - cacheWriteTokens);
  const inputUnits =
    plainInput +
    cacheReadTokens * CACHE_PRICE_MULTIPLIER.read +
    cacheWriteTokens * CACHE_PRICE_MULTIPLIER.write;
  return (
    (inputUnits * PRICING_USD_PER_MTOK.judge.input +
      outputTokens * PRICING_USD_PER_MTOK.judge.output) /
    TOKENS_PER_MTOK
  );
};

export type TargetTier = 'mechanical' | 'judgment';

export const targetCostUsdFrom = (
  tier: TargetTier,
  inputTokens: number,
  outputTokens: number,
): number => {
  const rate = tier === 'mechanical' ? PRICING_USD_PER_MTOK.mechanical : PRICING_USD_PER_MTOK.judge;
  return (inputTokens * rate.input + outputTokens * rate.output) / TOKENS_PER_MTOK;
};

const TYPICAL_CHARS_PER_TOKEN = 4;
const TYPICAL_QUESTION_CHARS = 120;
const TYPICAL_REQUEST_FRAMING_TOKENS = 100;

export const APPROX_TYPICAL_FEATURE_INPUT_TOKENS =
  Math.ceil((SYSTEM_TEXT.length + TYPICAL_QUESTION_CHARS) / TYPICAL_CHARS_PER_TOKEN) +
  TYPICAL_REQUEST_FRAMING_TOKENS;
export const APPROX_AGENT_EVAL_INPUT_TOKENS = 1700;
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
    (args.approxTargetInputTokens * PRICING_USD_PER_MTOK.mechanical.input +
      args.approxTargetOutputTokens * PRICING_USD_PER_MTOK.mechanical.output) /
    1_000_000;
  const judgePerRun = judgeCostUsdFrom(args.approxJudgeInputTokens, args.approxJudgeOutputTokens);
  return args.cases * args.runs * (targetPerRun + judgePerRun);
}

export function summarizeFeatureCost(
  measuredPerAnswerUsd: number[],
  answeredCount: number,
): { featureCostUsd: number; measuredAnswers: number } {
  const measuredAnswers = Math.min(measuredPerAnswerUsd.length, answeredCount);
  const approxPerAnswer =
    (APPROX_TYPICAL_FEATURE_INPUT_TOKENS * PRICING_USD_PER_MTOK.feature.input +
      APPROX_FEATURE_OUTPUT_TOKENS * PRICING_USD_PER_MTOK.feature.output) /
    1_000_000;
  const measuredSum = measuredPerAnswerUsd.slice(0, measuredAnswers).reduce((a, b) => a + b, 0);
  const fallbackPerAnswer = measuredAnswers > 0 ? measuredSum / measuredAnswers : approxPerAnswer;
  return {
    featureCostUsd: measuredSum + fallbackPerAnswer * (answeredCount - measuredAnswers),
    measuredAnswers,
  };
}
