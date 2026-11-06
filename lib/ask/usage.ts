export type AskUsageInput = {
  inputTokens?: number;
  outputTokens?: number;
  inputTokenDetails?: {
    noCacheTokens?: number;
    cacheReadTokens?: number;
    cacheWriteTokens?: number;
  };
};

export type AskTokenCounts = {
  billedInputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  outputTokens: number;
};

export function countAskTokens(usage: AskUsageInput | null | undefined): AskTokenCounts {
  const details = usage?.inputTokenDetails;
  const cacheReadTokens = details?.cacheReadTokens ?? 0;
  const cacheWriteTokens = details?.cacheWriteTokens ?? 0;
  const splitTotal = (details?.noCacheTokens ?? 0) + cacheReadTokens + cacheWriteTokens;
  return {
    billedInputTokens: Math.max(usage?.inputTokens ?? 0, splitTotal),
    cacheReadTokens,
    cacheWriteTokens,
    outputTokens: usage?.outputTokens ?? 0,
  };
}
