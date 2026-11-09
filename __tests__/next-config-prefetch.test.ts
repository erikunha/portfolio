import { describe, expect, it } from 'vitest';

import nextConfig from '@/next.config';

describe('next.config cache components', () => {
  it('enables cache components and sets partial prefetching explicitly to false', () => {
    expect(nextConfig.cacheComponents).toBe(true);
    expect(
      nextConfig.partialPrefetching,
      'true embeds a second copy of every route shell in each HTML response (about 38 KB gzipped on the home page); unset logs a build warning, so the value is set to false on purpose',
    ).toBe(false);
  });
});
