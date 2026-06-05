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
  // WHY explicit false (already the Next.js default): production
  // `curl https://erikunha.dev/api/healthz` returned HTTP 308, a trailing-slash
  // redirect injected at the Vercel routing layer, NOT by the Route Handler
  // (app/api/healthz/route.ts never redirects). Route Handlers are strict on the
  // trailing slash: `/api/healthz/` does not match `route.ts`, so the platform
  // redirect breaks the canonical no-slash form. Making `trailingSlash` explicit
  // forces Next.js to emit an unambiguous canonical-URL rule into the generated
  // routes-manifest.json, eliminating the platform-level ambiguity that produced
  // the 308. Post-deploy smoke (smoke.yml) probes the canonical domain with HEAD
  // (no follow) to assert 200/503 and fail loudly on any 3xx. See WS5 spec +
  // DECISIONS.md. NOTE: if the 308 originated from a Vercel project-level
  // Trailing Slash setting (Settings > General), that dashboard toggle overrides
  // this config and must be cleared too. Verify against the CANONICAL host with
  // no redirect-follow (the WS0 lesson: -L would mask the apex 308):
  //   curl -sI https://www.erikunha.dev/api/healthz   # expect HTTP/2 200 (or 503 degraded), never 3xx
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
