// __tests__/ua.test.ts
// Table-driven unit tests for getIsMobile(). next/headers is mocked per-test
// via vi.mocked so each case controls the returned UA string independently.
// server-only is globally aliased to an empty module in vitest.config.ts.

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({
  headers: vi.fn(),
}));

import { headers } from 'next/headers';
import { getIsMobile } from '@/lib/ua';

function mockUA(ua: string) {
  // Cast through unknown — the full Headers interface is not needed under test;
  // only the `get` method is exercised by getIsMobile().
  vi.mocked(headers).mockResolvedValue({ get: () => ua } as unknown as Awaited<
    ReturnType<typeof headers>
  >);
}

describe('getIsMobile()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns false for an empty UA string', async () => {
    mockUA('');
    expect(await getIsMobile()).toBe(false);
  });

  it('returns false for a desktop Chrome UA', async () => {
    mockUA(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    );
    expect(await getIsMobile()).toBe(false);
  });

  it('returns true for an iPhone Safari UA', async () => {
    mockUA(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    );
    expect(await getIsMobile()).toBe(true);
  });

  it('returns true for an Android Chrome UA', async () => {
    mockUA(
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.6422.165 Mobile Safari/537.36',
    );
    expect(await getIsMobile()).toBe(true);
  });

  it('returns false for an iPad in desktop mode (no "Mobile" token)', async () => {
    // iPads in desktop mode omit the "Mobile" token; the regex should not match.
    mockUA(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    );
    expect(await getIsMobile()).toBe(false);
  });
});
