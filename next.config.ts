import withBundleAnalyzer from '@next/bundle-analyzer';
import createMDX from '@next/mdx';
import type { NextConfig } from 'next';

const analyze = withBundleAnalyzer({ enabled: process.env.ANALYZE === 'true' });

const withMDX = createMDX({
  options: {
    // All plugins MUST be string-tuple refs — Turbopack serialization requirement.
    // Absolute path required: Turbopack evaluates plugin resolution in a different
    // CWD than the project root, so relative paths fail in production builds.
    // remark-preview-source runs at the MDAST stage (before JSX compilation) so it
    // can slice raw MDX source text via position offsets to inject the `source` prop.
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
  experimental: {
    // Force @custom-media resolution in Lightning CSS (applies to both Turbopack
    // and webpack). WHY: The breakpoint contract (M3) uses @custom-media to
    // centralise 54 raw width literals. 'include' forces transpilation regardless
    // of browserslist targets. Spike conducted 2026-05-30; see DECISIONS.md.
    lightningCssFeatures: {
      include: ['custom-media-queries'],
    },
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

export default analyze(withMDX(nextConfig));
