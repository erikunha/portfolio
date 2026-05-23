import withBundleAnalyzer from '@next/bundle-analyzer';
import createMDX from '@next/mdx';
import type { NextConfig } from 'next';

const analyze = withBundleAnalyzer({ enabled: process.env.ANALYZE === 'true' });

const withMDX = createMDX({
  options: {
    // All plugins MUST be string-tuple refs — Turbopack serialization requirement.
    // Absolute path required: Turbopack evaluates plugin resolution in a different
    // CWD than the project root, so relative paths fail in production builds.
    rehypePlugins: [['rehype-pretty-code', { theme: 'github-dark-dimmed' }]],
    recmaPlugins: [[`${process.cwd()}/lib/mdx/recma-preview-source.mjs`, {}]],
  },
});

const nextConfig: NextConfig = {
  pageExtensions: ['ts', 'tsx', 'mdx'],
  cacheComponents: true,
  typedRoutes: true,
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=63072000; includeSubDomains; preload',
        },
      ],
    },
  ],
};

export default analyze(withMDX(nextConfig));
