import { describe, expect, it } from 'vitest';

import nextConfig from '@/next.config';

describe('next.config cache components', () => {
  it('enables cache components together with partial prefetching', () => {
    expect(nextConfig.cacheComponents).toBe(true);
    expect(nextConfig.partialPrefetching).toBe(true);
  });
});
