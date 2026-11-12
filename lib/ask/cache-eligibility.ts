export const HAIKU_CACHE_MIN_TOKENS = 512;

export const CHARS_PER_TOKEN_CEILING = 5;

export function promptTokensLowerBound(text: string): number {
  return Math.floor(text.length / CHARS_PER_TOKEN_CEILING);
}

export function isCacheEligible(text: string): boolean {
  return promptTokensLowerBound(text) >= HAIKU_CACHE_MIN_TOKENS;
}
