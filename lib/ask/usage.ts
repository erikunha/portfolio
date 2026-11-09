export type AskUsageInput = {
  inputTokens?: number | undefined;
  outputTokens?: number | undefined;
  inputTokenDetails?:
    | {
        noCacheTokens?: number | undefined;
        cacheReadTokens?: number | undefined;
        cacheWriteTokens?: number | undefined;
      }
    | undefined;
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

export type AskUsageEvent = AskTokenCounts & { requestId: string; usageResolved: boolean };

type AskUsageListener = (event: AskUsageEvent) => void;

const usageListeners = new Set<AskUsageListener>();

export function onAskUsage(listener: AskUsageListener): () => void {
  usageListeners.add(listener);
  return () => {
    usageListeners.delete(listener);
  };
}

export function emitAskUsage(event: AskUsageEvent): void {
  for (const listener of usageListeners) listener(event);
}
