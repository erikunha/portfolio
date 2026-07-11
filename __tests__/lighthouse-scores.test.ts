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
  afterEach(() => {
    vi.useRealTimers();
  });

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
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0);
    process.env.PSI_API_KEY = 'test-key';
    mockFetch.mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => 'Service Unavailable',
    });
    const { refreshScores } = await import('@/lib/lighthouse-scores');
    const assertion = expect(refreshScores('desktop')).rejects.toThrow('PSI API returned 503');
    await vi.advanceTimersByTimeAsync(600);
    await assertion;
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

describe('refreshScores — error typing', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('throws with status + preserved message on a non-ok PSI response', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0);
    process.env.PSI_API_KEY = 'k';
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => '{"error":{"code":500,"message":"Lighthouse returned error"}}',
    });
    const { refreshScores } = await import('@/lib/lighthouse-scores');
    const assertion = expect(refreshScores('mobile')).rejects.toMatchObject({
      status: 500,
      message: expect.stringContaining('PSI API returned 500 for strategy=mobile'),
    });
    await vi.advanceTimersByTimeAsync(600);
    await assertion;
  });
});

describe('PSI fetch timeout — differentiated by path', () => {
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

describe('refreshScores — cron retry', () => {
  const okResp = () => makePsiResponse(0.99);
  const errResp = (status: number) => ({ ok: false, status, text: async () => 'err' });
  afterEach(() => {
    vi.useRealTimers();
  });
  const BACKOFF_ADVANCE_MS = 600;

  it('retries once on 500 then succeeds, writing the cache exactly once', async () => {
    vi.useFakeTimers();
    process.env.PSI_API_KEY = 'k';
    vi.spyOn(Math, 'random').mockReturnValue(0);
    mockFetch.mockResolvedValueOnce(errResp(500)).mockResolvedValueOnce(okResp());
    mockSet.mockResolvedValue('OK');
    const { refreshScores } = await import('@/lib/lighthouse-scores');
    const p = refreshScores('mobile');
    await vi.advanceTimersByTimeAsync(BACKOFF_ADVANCE_MS);
    const res = await p;
    expect(res.performance).toBe(99);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockSet).toHaveBeenCalledTimes(1);
  });

  it('retries on 429 then succeeds', async () => {
    vi.useFakeTimers();
    process.env.PSI_API_KEY = 'k';
    vi.spyOn(Math, 'random').mockReturnValue(0);
    mockFetch.mockResolvedValueOnce(errResp(429)).mockResolvedValueOnce(okResp());
    mockSet.mockResolvedValue('OK');
    const { refreshScores } = await import('@/lib/lighthouse-scores');
    const p = refreshScores('desktop');
    await vi.advanceTimersByTimeAsync(BACKOFF_ADVANCE_MS);
    await expect(p).resolves.toBeTruthy();
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('does NOT retry on a timeout', async () => {
    process.env.PSI_API_KEY = 'k';
    mockFetch.mockRejectedValue(
      Object.assign(new Error('The operation was aborted due to timeout'), {
        name: 'TimeoutError',
      }),
    );
    const { refreshScores } = await import('@/lib/lighthouse-scores');
    await expect(refreshScores('mobile')).rejects.toThrow(/aborted/);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('does NOT retry on a non-429 4xx', async () => {
    process.env.PSI_API_KEY = 'k';
    mockFetch.mockResolvedValue(errResp(403));
    const { refreshScores } = await import('@/lib/lighthouse-scores');
    await expect(refreshScores('mobile')).rejects.toMatchObject({ status: 403 });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('exhausts retries on a persistent 500 (2 attempts, then throws)', async () => {
    vi.useFakeTimers();
    process.env.PSI_API_KEY = 'k';
    vi.spyOn(Math, 'random').mockReturnValue(0);
    mockFetch.mockResolvedValue(errResp(500));
    const { refreshScores } = await import('@/lib/lighthouse-scores');
    const assertion = expect(refreshScores('mobile')).rejects.toMatchObject({ status: 500 });
    await vi.advanceTimersByTimeAsync(BACKOFF_ADVANCE_MS);
    await assertion;
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('skips the retry when the remaining budget is below the floor', async () => {
    process.env.PSI_API_KEY = 'k';
    const { refreshScores, __setNowForTest, PSI_STRATEGY_BUDGET_MS } = await import(
      '@/lib/lighthouse-scores'
    );
    let t = 0;
    __setNowForTest(() => {
      const v = t;
      t = PSI_STRATEGY_BUDGET_MS - 1_000;
      return v;
    });
    mockFetch.mockResolvedValue(errResp(500));
    await expect(refreshScores('mobile')).rejects.toMatchObject({ status: 500 });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    __setNowForTest(null);
  });

  it('request path (getScores cache-miss) is single-shot — no retry on 500', async () => {
    process.env.PSI_API_KEY = 'k';
    mockGet.mockResolvedValue(null);
    mockFetch.mockResolvedValue(errResp(500));
    const { getScores, LIGHTHOUSE_FALLBACK } = await import('@/lib/lighthouse-scores');
    const res = await getScores('mobile');
    expect(res).toEqual(LIGHTHOUSE_FALLBACK);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
