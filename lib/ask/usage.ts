import { ASK_PRICING_USD_PER_MTOK, CACHE_PRICE_MULTIPLIER } from '@/lib/ask/pricing';

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

export const ASK_BUDGET_UNITS_PER_USD = 1_000_000_000;

const TOKENS_PER_MTOK = 1_000_000;

const unitsPerToken = (usdPerMtok: number): number =>
  Math.round((usdPerMtok * ASK_BUDGET_UNITS_PER_USD) / TOKENS_PER_MTOK);

export const ASK_INPUT_UNITS_PER_TOKEN = unitsPerToken(ASK_PRICING_USD_PER_MTOK.input);
export const ASK_OUTPUT_UNITS_PER_TOKEN = unitsPerToken(ASK_PRICING_USD_PER_MTOK.output);
const CACHE_READ_UNITS_PER_TOKEN = Math.round(
  ASK_INPUT_UNITS_PER_TOKEN * CACHE_PRICE_MULTIPLIER.read,
);
export const ASK_CACHE_WRITE_UNITS_PER_TOKEN = Math.round(
  ASK_INPUT_UNITS_PER_TOKEN * CACHE_PRICE_MULTIPLIER.write,
);

export function askBudgetCost(counts: AskTokenCounts): number {
  const plainInput = Math.max(
    0,
    counts.billedInputTokens - counts.cacheReadTokens - counts.cacheWriteTokens,
  );
  return (
    plainInput * ASK_INPUT_UNITS_PER_TOKEN +
    counts.cacheReadTokens * CACHE_READ_UNITS_PER_TOKEN +
    counts.cacheWriteTokens * ASK_CACHE_WRITE_UNITS_PER_TOKEN +
    counts.outputTokens * ASK_OUTPUT_UNITS_PER_TOKEN
  );
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
