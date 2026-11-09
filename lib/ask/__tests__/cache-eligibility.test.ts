import { describe, expect, it } from 'vitest';
import {
  CHARS_PER_TOKEN_CEILING,
  HAIKU_CACHE_MIN_TOKENS,
  isCacheEligible,
  promptTokensLowerBound,
} from '@/lib/ask/cache-eligibility';
import { SYSTEM_TEXT } from '@/lib/ask/system-prompt';

describe('lib/ask/cache-eligibility', () => {
  it('rejects a prompt the old 3500-character proxy accepted, because 3600 characters is about 900 tokens', () => {
    expect(isCacheEligible('x'.repeat(3600))).toBe(false);
  });

  it('rejects a prompt one token short of the Haiku 4.5 minimum', () => {
    const justShort = 'x'.repeat(HAIKU_CACHE_MIN_TOKENS * CHARS_PER_TOKEN_CEILING - 1);
    expect(promptTokensLowerBound(justShort)).toBe(HAIKU_CACHE_MIN_TOKENS - 1);
    expect(isCacheEligible(justShort)).toBe(false);
  });

  it('accepts a prompt that reaches the minimum even at the sparsest tokenization', () => {
    expect(isCacheEligible('x'.repeat(HAIKU_CACHE_MIN_TOKENS * CHARS_PER_TOKEN_CEILING))).toBe(
      true,
    );
  });

  it('holds the shipped system prompt above the Haiku 4.5 minimum cacheable prefix', () => {
    expect(
      isCacheEligible(SYSTEM_TEXT),
      `SYSTEM_TEXT is ${SYSTEM_TEXT.length} characters, a lower bound of ${promptTokensLowerBound(SYSTEM_TEXT)} tokens against the ${HAIKU_CACHE_MIN_TOKENS}-token minimum: below it the cacheControl marker is silently ignored and every request pays full input price`,
    ).toBe(true);
  });
});
