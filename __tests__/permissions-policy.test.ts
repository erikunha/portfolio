import { describe, expect, it } from 'vitest';

import nextConfig from '@/next.config';

const DENIED_FEATURES = [
  'camera',
  'microphone',
  'geolocation',
  'payment',
  'usb',
  'serial',
  'browsing-topics',
];

const permissionsPolicy = async (): Promise<string> => {
  const rules = (await nextConfig.headers?.()) ?? [];
  const everyPath = rules.find((rule) => rule.source === '/(.*)');
  const header = everyPath?.headers.find((entry) => entry.key === 'Permissions-Policy');
  return header?.value ?? '';
};

describe('Permissions-Policy response header', () => {
  it('denies exactly the listed features with an empty allowlist', async () => {
    const directives = (await permissionsPolicy()).split(',').map((part) => part.trim());
    expect(directives.sort()).toEqual(DENIED_FEATURES.map((feature) => `${feature}=()`).sort());
  });
});
