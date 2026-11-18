import { describe, expect, it } from 'vitest';

import nextConfig from '@/next.config';

const RECORDED_FLAGS = {
  cacheComponents: true,
  partialPrefetching: false,
  experimental: { agentFeedback: false },
  trailingSlash: false,
  poweredByHeader: false,
};

describe('next.config flags', () => {
  it('sets exactly the recorded behavior flags', () => {
    const flags = {
      cacheComponents: nextConfig.cacheComponents,
      partialPrefetching: nextConfig.partialPrefetching,
      experimental: nextConfig.experimental,
      trailingSlash: nextConfig.trailingSlash,
      poweredByHeader: nextConfig.poweredByHeader,
    };
    expect(flags).toEqual(RECORDED_FLAGS);
  });

  it('does not enable typed routes', () => {
    expect(nextConfig).not.toHaveProperty('typedRoutes');
  });
});
