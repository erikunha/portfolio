import createMDX from '@next/mdx';
import type { NextConfig } from 'next';

const withMDX = createMDX({
  options: {
    remarkPlugins: [
      [`${process.cwd()}/lib/mdx/remark-gfm-wrapper.mjs`, {}],
      [`${process.cwd()}/lib/mdx/remark-preview-source.mjs`, {}],
      [`${process.cwd()}/lib/mdx/remark-table-caption.mjs`, {}],
    ],
    rehypePlugins: [['rehype-pretty-code', { theme: 'github-dark-dimmed' }]],
  },
});

const ISO_DATE_LENGTH = 10;
const BUILD_DATE = new Date().toISOString().slice(0, ISO_DATE_LENGTH);

const nextConfig: NextConfig = {
  env: { BUILD_DATE },
  poweredByHeader: false,
  pageExtensions: ['ts', 'tsx', 'mdx'],
  cacheComponents: true,
  partialPrefetching: false,
  typedRoutes: true,
  experimental: { agentFeedback: false },
  trailingSlash: false,
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'i.ytimg.com', pathname: '/vi/**' }],
  },
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

export default withMDX(nextConfig);
