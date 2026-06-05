// __tests__/lighthouse-scores.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest';

const mockGet = vi.fn();
const mockSet = vi.fn();
vi.mock('@/lib/rate-limit', () => ({
  getRedis: () => ({ get: mockGet, set: mockSet }),
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const mockLogError = vi.fn();
vi.mock('@/lib/log', () => ({ log: { error: mockLogError, info: vi.fn() } }));

afterEach(() => {
  vi.resetModules();
  mockGet.mockReset();
  mockSet.mockReset();
  mockFetch.mockReset();
  mockLogError.mockReset();
  delete process.env.PSI_API_KEY;
});

const CACHED_DESKTOP = {
  performance: 99,
  accessibility: 100,
  bestPractices: 95,
  seo: 100,
  fetchedAt: '2026-05-29T03:00:00.000Z',
};

function makePsiResponse(score = 0.99) {
  return {
    ok: true,
    json: async () => ({
      lighthouseResult: {
        categories: {
          performance: { score },
          accessibility: { score: 1 },
          'best-practices': { score: 0.95 },
          seo: { score: 1 },
        },
      },
    }),
  };
}

describe('getScores — cache hit', () => {
  it('returns cached value without fetching PSI', async () => {
    mockGet.mockResolvedValue(CACHED_DESKTOP);
    const { getScores } = await import('@/lib/lighthouse-scores');
    const result = await getScores('desktop');
    expect(result).toEqual(CACHED_DESKTOP);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('defaults to desktop strategy', async () => {
    mockGet.mockResolvedValue(CACHED_DESKTOP);
    const { getScores } = await import('@/lib/lighthouse-scores');
    await getScores();
    expect(mockGet).toHaveBeenCalledWith('lh:scores:desktop');
  });

  it('uses lh:scores:mobile key for mobile strategy', async () => {
    mockGet.mockResolvedValue(CACHED_DESKTOP);
    const { getScores } = await import('@/lib/lighthouse-scores');
    await getScores('mobile');
    expect(mockGet).toHaveBeenCalledWith('lh:scores:mobile');
  });
});

describe('getScores — cache miss', () => {
  it('fetches from PSI and returns scores', async () => {
    mockGet.mockResolvedValue(null);
    mockSet.mockResolvedValue('OK');
    process.env.PSI_API_KEY = 'test-key';
    mockFetch.mockResolvedValue(makePsiResponse(0.99));
    const { getScores } = await import('@/lib/lighthouse-scores');
    const result = await getScores('desktop');
    expect(result.performance).toBe(99);
    expect(result.fetchedAt).not.toBe('—');
  });

  it('writes result to Redis with TTL', async () => {
    mockGet.mockResolvedValue(null);
    mockSet.mockResolvedValue('OK');
    process.env.PSI_API_KEY = 'test-key';
    mockFetch.mockResolvedValue(makePsiResponse(0.95));
    const { getScores, LIGHTHOUSE_TTL_S } = await import('@/lib/lighthouse-scores');
    await getScores('desktop');
    // fire-and-forget; wait a tick for the promise to settle
    await new Promise((r) => setTimeout(r, 0));
    expect(mockSet).toHaveBeenCalledWith(
      'lh:scores:desktop',
      expect.objectContaining({ performance: 95 }),
      { ex: LIGHTHOUSE_TTL_S },
    );
  });

  it('returns LIGHTHOUSE_FALLBACK when PSI_API_KEY is absent', async () => {
    mockGet.mockResolvedValue(null);
    delete process.env.PSI_API_KEY;
    const { getScores, LIGHTHOUSE_FALLBACK } = await import('@/lib/lighthouse-scores');
    const result = await getScores('desktop');
    expect(result).toEqual(LIGHTHOUSE_FALLBACK);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns LIGHTHOUSE_FALLBACK when PSI fetch throws', async () => {
    mockGet.mockResolvedValue(null);
    process.env.PSI_API_KEY = 'test-key';
    mockFetch.mockRejectedValue(new Error('network error'));
    const { getScores, LIGHTHOUSE_FALLBACK } = await import('@/lib/lighthouse-scores');
    const result = await getScores('desktop');
    expect(result).toEqual(LIGHTHOUSE_FALLBACK);
  });

  it('returns LIGHTHOUSE_FALLBACK when PSI returns non-OK status', async () => {
    mockGet.mockResolvedValue(null);
    process.env.PSI_API_KEY = 'test-key';
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    });
    const { getScores, LIGHTHOUSE_FALLBACK } = await import('@/lib/lighthouse-scores');
    const result = await getScores('desktop');
    expect(result).toEqual(LIGHTHOUSE_FALLBACK);
  });

  it('calls fetch with next.revalidate (not cache: no-store) on cache miss', async () => {
    mockGet.mockResolvedValue(null);
    process.env.PSI_API_KEY = 'test-key';
    mockFetch.mockResolvedValue(makePsiResponse(0.99));
    const { getScores, LIGHTHOUSE_TTL_S } = await import('@/lib/lighthouse-scores');
    await getScores('desktop');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('pagespeedonline'),
      expect.objectContaining({ next: { revalidate: LIGHTHOUSE_TTL_S } }),
    );
  });

  it('logs error when Redis GET fails', async () => {
    mockGet.mockRejectedValue(new Error('Redis connection refused'));
    mockSet.mockResolvedValue('OK');
    process.env.PSI_API_KEY = 'test-key';
    mockFetch.mockResolvedValue(makePsiResponse(0.99));
    const { getScores } = await import('@/lib/lighthouse-scores');
    await getScores('desktop');
    expect(mockLogError).toHaveBeenCalledWith(
      'Redis cache GET failed',
      expect.objectContaining({ strategy: 'desktop' }),
    );
  });
});

describe('refreshScores', () => {
  it('fetches from PSI even when cache is warm', async () => {
    mockGet.mockResolvedValue(CACHED_DESKTOP);
    mockSet.mockResolvedValue('OK');
    process.env.PSI_API_KEY = 'test-key';
    mockFetch.mockResolvedValue(makePsiResponse(0.98));
    const { refreshScores } = await import('@/lib/lighthouse-scores');
    const result = await refreshScores('desktop');
    expect(result.performance).toBe(98);
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it('throws when PSI fetch fails', async () => {
    process.env.PSI_API_KEY = 'test-key';
    mockFetch.mockRejectedValue(new Error('PSI down'));
    const { refreshScores } = await import('@/lib/lighthouse-scores');
    await expect(refreshScores('desktop')).rejects.toThrow('PSI down');
  });

  it('throws when PSI_API_KEY is absent', async () => {
    delete process.env.PSI_API_KEY;
    const { refreshScores } = await import('@/lib/lighthouse-scores');
    await expect(refreshScores('desktop')).rejects.toThrow();
  });

  it('throws when PSI returns non-OK status', async () => {
    process.env.PSI_API_KEY = 'test-key';
    mockFetch.mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => 'Service Unavailable',
    });
    const { refreshScores } = await import('@/lib/lighthouse-scores');
    await expect(refreshScores('desktop')).rejects.toThrow('PSI API returned 503');
  });

  it('calls fetch with cache: no-store to bypass Next.js fetch cache', async () => {
    process.env.PSI_API_KEY = 'test-key';
    mockFetch.mockResolvedValue(makePsiResponse(0.98));
    mockSet.mockResolvedValue('OK');
    const { refreshScores } = await import('@/lib/lighthouse-scores');
    await refreshScores('desktop');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('pagespeedonline'),
      expect.objectContaining({ cache: 'no-store' }),
    );
  });

  it('awaits the Redis SET so the cron write completes before returning', async () => {
    process.env.PSI_API_KEY = 'test-key';
    mockFetch.mockResolvedValue(makePsiResponse(0.95));
    let setResolved = false;
    mockSet.mockImplementation(async () => {
      setResolved = true;
      return 'OK';
    });
    const { refreshScores } = await import('@/lib/lighthouse-scores');
    await refreshScores('desktop');
    expect(setResolved).toBe(true);
  });

  it('throws when Redis SET fails during refresh', async () => {
    process.env.PSI_API_KEY = 'test-key';
    mockFetch.mockResolvedValue(makePsiResponse(0.95));
    mockSet.mockRejectedValue(new Error('Redis write failed'));
    const { refreshScores } = await import('@/lib/lighthouse-scores');
    await expect(refreshScores('desktop')).rejects.toThrow('Redis write failed');
  });
});

describe('PSI fetch timeout — differentiated by path', () => {
  // WHY: fetchAndCache is shared by the cron (forceRefresh) and organic page
  // renders (getScores). PSI runs a full Lighthouse audit server-side (~15–40s),
  // so the cron needs a long budget to ever succeed; the request path must keep a
  // short budget so a cache-miss page render falls back fast and never blocks LCP.
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('refreshScores (cron path) uses the long PSI timeout so real audits complete', async () => {
    process.env.PSI_API_KEY = 'test-key';
    mockSet.mockResolvedValue('OK');
    mockFetch.mockResolvedValue(makePsiResponse(0.98));
    const timeoutSpy = vi.spyOn(AbortSignal, 'timeout');
    const { refreshScores, PSI_REFRESH_TIMEOUT_MS } = await import('@/lib/lighthouse-scores');
    await refreshScores('desktop');
    expect(timeoutSpy).toHaveBeenCalledWith(PSI_REFRESH_TIMEOUT_MS);
    expect(PSI_REFRESH_TIMEOUT_MS).toBeGreaterThanOrEqual(45_000);
  });

  it('getScores cache-miss (request path) keeps the short timeout to protect LCP', async () => {
    mockGet.mockResolvedValue(null);
    process.env.PSI_API_KEY = 'test-key';
    mockSet.mockResolvedValue('OK');
    mockFetch.mockResolvedValue(makePsiResponse(0.99));
    const timeoutSpy = vi.spyOn(AbortSignal, 'timeout');
    const { getScores, PSI_REQUEST_TIMEOUT_MS } = await import('@/lib/lighthouse-scores');
    await getScores('desktop');
    expect(timeoutSpy).toHaveBeenCalledWith(PSI_REQUEST_TIMEOUT_MS);
    expect(PSI_REQUEST_TIMEOUT_MS).toBeLessThanOrEqual(8_000);
  });

  it('the cron timeout is strictly longer than the request timeout', async () => {
    const { PSI_REFRESH_TIMEOUT_MS, PSI_REQUEST_TIMEOUT_MS } = await import(
      '@/lib/lighthouse-scores'
    );
    expect(PSI_REFRESH_TIMEOUT_MS).toBeGreaterThan(PSI_REQUEST_TIMEOUT_MS);
  });
});
