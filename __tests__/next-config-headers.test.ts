import { describe, expect, it } from 'vitest';

import nextConfig from '@/next.config';

const REQUIRED_STATIC_HEADERS = [
  'Cross-Origin-Opener-Policy',
  'X-Frame-Options',
  'X-Content-Type-Options',
  'Referrer-Policy',
  'Permissions-Policy',
  'Strict-Transport-Security',
];

describe('next.config security posture', () => {
  it('does not advertise the framework in an X-Powered-By header', () => {
    expect(nextConfig.poweredByHeader).toBe(false);
  });

  it('sets every static security header on every path', async () => {
    const rules = (await nextConfig.headers?.()) ?? [];
    const everyPath = rules.find((rule) => rule.source === '/(.*)');
    const keys = (everyPath?.headers ?? []).map((header) => header.key);
    expect(keys).toEqual(expect.arrayContaining(REQUIRED_STATIC_HEADERS));
  });
});
