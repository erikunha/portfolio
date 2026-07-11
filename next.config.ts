import withBundleAnalyzer from '@next/bundle-analyzer';
import createMDX from '@next/mdx';
import type { NextConfig } from 'next';

const analyze = withBundleAnalyzer({ enabled: process.env.ANALYZE === 'true' });

const withMDX = createMDX({
  options: {
    remarkPlugins: [
      [`${process.cwd()}/lib/mdx/remark-gfm-wrapper.mjs`, {}],
      [`${process.cwd()}/lib/mdx/remark-preview-source.mjs`, {}],
    ],
    rehypePlugins: [['rehype-pretty-code', { theme: 'github-dark-dimmed' }]],
  },
});

const nextConfig: NextConfig = {
  pageExtensions: ['ts', 'tsx', 'mdx'],
  cacheComponents: true,
  typedRoutes: true,
  trailingSlash: false,
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
