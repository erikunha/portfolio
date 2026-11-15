import { beforeEach, describe, expect, it, vi } from 'vitest';

const getMock = vi.fn();
const setMock = vi.fn();
const getRedisMock = vi.fn(() => ({ get: getMock, set: setMock }));

vi.mock('@/lib/redis', () => ({
  getRedis: getRedisMock,
}));

vi.mock('@/lib/log', () => ({
  log: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

describe('Redis singleton: lighthouse-scores reuses the shared client', () => {
  beforeEach(() => {
    vi.resetModules();
    getMock.mockReset();
    setMock.mockReset();
    getRedisMock.mockClear();
  });

  it('getScores reads the cache via the shared getRedis() singleton', async () => {
    getMock.mockResolvedValueOnce(null);
    const prevKey = process.env.PSI_API_KEY;
    delete process.env.PSI_API_KEY;
    const fetchMock = vi.fn(() => Promise.reject(new Error('no network in this test')));
    vi.stubGlobal('fetch', fetchMock);

    try {
      const { getScores } = await import('@/lib/lighthouse-scores');
      await getScores();

      expect(getRedisMock).toHaveBeenCalled();
      expect(getMock).toHaveBeenCalledWith('lh:scores:desktop');
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
      if (prevKey === undefined) delete process.env.PSI_API_KEY;
      else process.env.PSI_API_KEY = prevKey;
    }
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
    expect(getMock).toHaveBeenCalledWith('lh:scores:desktop');
  });
});
