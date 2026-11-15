import type { CacheTokenCounts, ReservationUsage } from '@/lib/ask/budget';
import { ASK_RESERVED_INPUT_TOKENS } from '@/lib/ask/input-reservation';

export type SettledUsage = CacheTokenCounts & {
  resolved: boolean;
  billedInputTokens: number;
  outputTokens: number;
};

export type SettlementInput = {
  usage: SettledUsage;
  upstreamFailed: boolean;
  usageRejected: boolean;
  firstChunkSeen: boolean;
  answerEmpty: boolean;
};

export type SettlementDecision = ReservationUsage | 'none' | null;

export function decideSettlement(input: SettlementInput): SettlementDecision {
  const { usage } = input;
  if (usage.resolved) {
    return {
      billedInputTokens: usage.billedInputTokens,
      outputTokens: usage.outputTokens,
      cacheReadTokens: usage.cacheReadTokens,
      cacheWriteTokens: usage.cacheWriteTokens,
    };
  }
  const failedBeforeAnyOutput = input.upstreamFailed && input.usageRejected && input.answerEmpty;
  if (failedBeforeAnyOutput) return 'none';
  const endedBeforeFirstToken = !input.firstChunkSeen && !input.upstreamFailed;
  if (endedBeforeFirstToken) {
    return { billedInputTokens: ASK_RESERVED_INPUT_TOKENS, outputTokens: 0 };
  }
  return null;
}
