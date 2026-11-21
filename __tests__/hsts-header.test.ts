import { describe, expect, it } from 'vitest';

import nextConfig from '@/next.config';

const HSTS_HEADER = 'Strict-Transport-Security';
const EVERY_PATH_SOURCE = '/(.*)';
const EXPECTED_HSTS = 'max-age=63072000; includeSubDomains';

async function hstsValues(): Promise<string[]> {
  const rules = await (nextConfig.headers?.() ?? []);
  return rules
    .filter((rule) => rule.source === EVERY_PATH_SOURCE)
    .flatMap((rule) => rule.headers)
    .filter((header) => header.key === HSTS_HEADER)
    .map((header) => header.value);
}

describe('Strict-Transport-Security header', () => {
  it('is sent once on every path with exactly max-age and includeSubDomains', async () => {
    expect(await hstsValues()).toEqual([EXPECTED_HSTS]);
  });

  it('carries no preload token, since no preload submission exists for the www host', async () => {
    const tokens = (await hstsValues()).flatMap((value) =>
      value.split(';').map((token) => token.trim().toLowerCase()),
    );
    expect(tokens).not.toContain('preload');
  });
});
