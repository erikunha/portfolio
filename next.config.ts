import createMDX from '@next/mdx';
import type { NextConfig } from 'next';
import { commitSha } from './lib/env-build';

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

const CSP_REPORT_PATH = '/api/csp-report';
const CSP_REPORT_GROUP = 'csp-endpoint';

const REPORTING_DIRECTIVES: readonly string[] = [
  `report-to ${CSP_REPORT_GROUP}`,
  `report-uri ${CSP_REPORT_PATH}`,
];

const VERCEL_CONNECT_SOURCES: readonly string[] = [
  'https://vitals.vercel-insights.com',
  'https://va.vercel-scripts.com',
];

function contentSecurityPolicy(options: { connectSources: readonly string[] }): string {
  const directives: readonly string[] = [
    "default-src 'self'",
    process.env.NODE_ENV === 'development'
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com"
      : "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    ['connect-src', "'self'", ...options.connectSources].join(' '),
    "frame-ancestors 'none'",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "worker-src 'self'",
    ...REPORTING_DIRECTIVES,
  ];
  return directives.join('; ');
}

function connectSourceProbePolicy(): string {
  return ["connect-src 'self'", ...REPORTING_DIRECTIVES].join('; ');
}

const nextConfig: NextConfig = {
  env: { BUILD_DATE, RELEASE: commitSha() },
  poweredByHeader: false,
  pageExtensions: ['ts', 'tsx', 'mdx'],
  cacheComponents: true,
  partialPrefetching: false,
  experimental: { agentFeedback: false },
  trailingSlash: false,
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'i.ytimg.com', pathname: '/vi/**' }],
  },
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        {
          key: 'Content-Security-Policy',
          value: contentSecurityPolicy({ connectSources: VERCEL_CONNECT_SOURCES }),
        },
        {
          key: 'Content-Security-Policy-Report-Only',
          value: connectSourceProbePolicy(),
        },
        { key: 'Reporting-Endpoints', value: `${CSP_REPORT_GROUP}="${CSP_REPORT_PATH}"` },
        { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        {
          key: 'Permissions-Policy',
          value:
            'camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), browsing-topics=()',
        },
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=63072000; includeSubDomains',
        },
      ],
    },
  ],
};

export default withMDX(nextConfig);
