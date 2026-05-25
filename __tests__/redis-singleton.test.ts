// __tests__/redis-singleton.test.ts
// Behavioral test: proves lib/lighthouse-scores.ts reads its cache
// through the SHARED Redis singleton (getRedis from lib/rate-limit) rather
// than instantiating its own client.
//
// Mechanism: we mock @/lib/rate-limit's getRedis to return a spy. If
// getScores() routes its cache read through that singleton, the spy's .get
// is observed. If a future refactor reintroduced a private `Redis.fromEnv()`
// inside lighthouse-scores.ts, that private client would bypass this mock
// entirely — the spy would never be called and the test fails. That is the
// regression this test catches, expressed as observable behavior.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const getMock = vi.fn();
const setMock = vi.fn();
const getRedisMock = vi.fn(() => ({ get: getMock, set: setMock }));

vi.mock('@/lib/rate-limit', () => ({
  getRedis: getRedisMock,
}));

vi.mock('@/lib/log', () => ({
  log: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

describe('Redis singleton — lighthouse-scores reuses the shared client', () => {
  beforeEach(() => {
    vi.resetModules();
    getMock.mockReset();
    setMock.mockReset();
    getRedisMock.mockClear();
  });

  it('getScores reads the cache via the shared getRedis() singleton', async () => {
    getMock.mockResolvedValueOnce(null); // cache miss
    // No PSI_API_KEY → getScores returns the fallback after the cache read.
    const prevKey = process.env.PSI_API_KEY;
    process.env.PSI_API_KEY = undefined;

    const { getScores } = await import('@/lib/lighthouse-scores');
    await getScores();

    // The shared singleton factory was consulted, and its client's `.get`
    // was used for the cache read. A private Redis.fromEnv() inside
    // lighthouse-scores.ts would never hit this mocked factory.
    expect(getRedisMock).toHaveBeenCalled();
    expect(getMock).toHaveBeenCalledWith('lh:scores');

    if (prevKey === undefined) delete process.env.PSI_API_KEY;
    else process.env.PSI_API_KEY = prevKey;
  });

  it('a cached value short-circuits and is returned as-is from the shared client', async () => {
    const cached = {
      performance: 99,
      accessibility: 100,
      bestPractices: 97,
      seo: 100,
      fetchedAt: '2026-05-20T00:00:00.000Z',
    };
    getMock.mockResolvedValueOnce(cached);

    const { getScores } = await import('@/lib/lighthouse-scores');
    const result = await getScores();

    expect(result).toEqual(cached);
    expect(getMock).toHaveBeenCalledWith('lh:scores');
  });
});
