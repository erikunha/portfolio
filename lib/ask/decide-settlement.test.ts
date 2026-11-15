import { describe, expect, it } from 'vitest';
import { decideSettlement, type SettledUsage } from '@/lib/ask/decide-settlement';
import { ASK_RESERVED_INPUT_TOKENS } from '@/lib/ask/input-reservation';

const RESOLVED: SettledUsage = {
  resolved: true,
  billedInputTokens: 120,
  outputTokens: 45,
  cacheReadTokens: 800,
  cacheWriteTokens: 30,
};

const UNRESOLVED: SettledUsage = {
  resolved: false,
  billedInputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
};

const CLEAN = {
  upstreamFailed: false,
  usageRejected: false,
  firstChunkSeen: true,
  answerEmpty: false,
};

type Row = {
  name: string;
  usage: SettledUsage;
  run: Partial<typeof CLEAN>;
  expected: ReturnType<typeof decideSettlement>;
};

const RESERVED_INPUT = { billedInputTokens: ASK_RESERVED_INPUT_TOKENS, outputTokens: 0 };

const ROWS: Row[] = [
  {
    name: 'resolved usage settles with every counted token, cache included',
    usage: RESOLVED,
    run: {},
    expected: {
      billedInputTokens: 120,
      outputTokens: 45,
      cacheReadTokens: 800,
      cacheWriteTokens: 30,
    },
  },
  {
    name: 'resolved usage settles even when the upstream reported an error',
    usage: RESOLVED,
    run: { upstreamFailed: true, usageRejected: true, answerEmpty: true, firstChunkSeen: false },
    expected: {
      billedInputTokens: 120,
      outputTokens: 45,
      cacheReadTokens: 800,
      cacheWriteTokens: 30,
    },
  },
  {
    name: 'upstream failed, usage rejected and no answer text refunds everything',
    usage: UNRESOLVED,
    run: { upstreamFailed: true, usageRejected: true, answerEmpty: true, firstChunkSeen: false },
    expected: 'none',
  },
  {
    name: 'upstream failed with usage rejected but some answer text is not settled',
    usage: UNRESOLVED,
    run: { upstreamFailed: true, usageRejected: true, answerEmpty: false },
    expected: null,
  },
  {
    name: 'upstream failed with usage merely timed out is not settled',
    usage: UNRESOLVED,
    run: { upstreamFailed: true, usageRejected: false, answerEmpty: true, firstChunkSeen: false },
    expected: null,
  },
  {
    name: 'usage rejected without an upstream failure is not a refund',
    usage: UNRESOLVED,
    run: { upstreamFailed: false, usageRejected: true, answerEmpty: true, firstChunkSeen: true },
    expected: null,
  },
  {
    name: 'ending before the first token without an upstream failure charges the reserved input',
    usage: UNRESOLVED,
    run: { firstChunkSeen: false, answerEmpty: true },
    expected: RESERVED_INPUT,
  },
  {
    name: 'usage timed out after the first token is not settled',
    usage: UNRESOLVED,
    run: { firstChunkSeen: true },
    expected: null,
  },
  {
    name: 'upstream failure before the first token with usage timed out is not settled',
    usage: UNRESOLVED,
    run: { upstreamFailed: true, firstChunkSeen: false, answerEmpty: true },
    expected: null,
  },
];

describe('decideSettlement', () => {
  it.each(ROWS)('$name', ({ usage, run, expected }) => {
    expect(decideSettlement({ ...CLEAN, ...run, usage })).toEqual(expected);
  });

  it('keeps the reserved-input charge free of cache counts so it prices as plain input', () => {
    const decision = decideSettlement({
      ...CLEAN,
      firstChunkSeen: false,
      answerEmpty: true,
      usage: UNRESOLVED,
    });
    expect(decision).not.toBeNull();
    expect(decision).not.toBe('none');
    expect(Object.keys(decision as object).sort()).toEqual(['billedInputTokens', 'outputTokens']);
  });
});
