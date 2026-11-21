import { describe, expect, it } from 'vitest';
import { countAskTokens } from '@/lib/ask/usage';

describe('countAskTokens', () => {
  it('does not add cache tokens to an SDK total that already contains them', () => {
    const counts = countAskTokens({
      inputTokens: 3000,
      outputTokens: 80,
      inputTokenDetails: { noCacheTokens: 200, cacheReadTokens: 2800, cacheWriteTokens: 0 },
    });
    expect(counts.billedInputTokens).toBe(3000);
    expect(counts.cacheReadTokens).toBe(2800);
    expect(counts.outputTokens).toBe(80);
  });

  it('recovers the full input when the reported total omits the cache split', () => {
    const counts = countAskTokens({
      inputTokens: 200,
      inputTokenDetails: { noCacheTokens: 200, cacheReadTokens: 1500, cacheWriteTokens: 0 },
    });
    expect(counts.billedInputTokens).toBe(1700);
  });

  it('counts a cold cache write once', () => {
    const counts = countAskTokens({
      inputTokens: 1700,
      inputTokenDetails: { noCacheTokens: 200, cacheReadTokens: 0, cacheWriteTokens: 1500 },
    });
    expect(counts.billedInputTokens).toBe(1700);
    expect(counts.cacheWriteTokens).toBe(1500);
  });

  it('reads zeros from a missing usage object', () => {
    expect(countAskTokens(undefined)).toEqual({
      billedInputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      outputTokens: 0,
    });
  });
});
