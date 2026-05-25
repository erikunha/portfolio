// __tests__/lighthouse-scores.test.ts
// Behavioral tests for getScores.
// Locks down: cache hit returns cached data; no-PSI-key path returns FALLBACK;
// fetch error returns FALLBACK; successful fetch parses and caches scores.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const redisMock = {
  get: vi.fn(async () => null as unknown),
  set: vi.fn(async () => 'OK'),
};

vi.mock('@/lib/rate-limit', () => ({
  getRedis: vi.fn(() => redisMock),
}));

vi.mock('@/lib/log', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const cachedScores = {
  performance: 97,
  accessibility: 100,
  bestPractices: 95,
  seo: 100,
  fetchedAt: '2026-01-01T00:00:00.000Z',
};

describe('getScores — cache hit', () => {
  beforeEach(() => {
    vi.resetModules();
    redisMock.get.mockReset();
    redisMock.set.mockReset();
  });

  it('returns cached data when Redis has a valid entry', async () => {
    redisMock.get.mockResolvedValueOnce(cachedScores);
    const { getScores } = await import('@/lib/lighthouse-scores');
    const result = await getScores();
    expect(result).toEqual(cachedScores);
  });

  it('continues (returns fallback) when Redis GET throws', async () => {
    redisMock.get.mockRejectedValueOnce(new Error('Redis down'));
    delete process.env.PSI_API_KEY;
    const { getScores, LIGHTHOUSE_FALLBACK } = await import('@/lib/lighthouse-scores');
    const result = await getScores();
    // Redis error is caught; PSI_API_KEY absent so returns fallback.
    expect(result).toEqual(LIGHTHOUSE_FALLBACK);
  });
});

describe('getScores — no PSI API key', () => {
  beforeEach(() => {
    vi.resetModules();
    redisMock.get.mockReset().mockResolvedValue(null);
    redisMock.set.mockReset();
    delete process.env.PSI_API_KEY;
  });

  it('returns LIGHTHOUSE_FALLBACK when PSI_API_KEY is not set', async () => {
    const { getScores, LIGHTHOUSE_FALLBACK } = await import('@/lib/lighthouse-scores');
    const result = await getScores();
    expect(result).toEqual(LIGHTHOUSE_FALLBACK);
  });
});

describe('getScores — PSI fetch error', () => {
  beforeEach(() => {
    vi.resetModules();
    redisMock.get.mockReset().mockResolvedValue(null);
    redisMock.set.mockReset();
    process.env.PSI_API_KEY = 'test-key';
  });

  afterEach(() => {
    delete process.env.PSI_API_KEY;
    vi.unstubAllGlobals();
  });

  it('returns LIGHTHOUSE_FALLBACK when the PSI API fetch throws', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('Network error');
      }),
    );
    const { getScores, LIGHTHOUSE_FALLBACK } = await import('@/lib/lighthouse-scores');
    const result = await getScores();
    expect(result).toEqual(LIGHTHOUSE_FALLBACK);
  });

  it('returns LIGHTHOUSE_FALLBACK when the PSI API returns a non-OK status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('error', { status: 500 })),
    );
    const { getScores, LIGHTHOUSE_FALLBACK } = await import('@/lib/lighthouse-scores');
    const result = await getScores();
    expect(result).toEqual(LIGHTHOUSE_FALLBACK);
  });
});

describe('getScores — PSI fetch success', () => {
  beforeEach(() => {
    vi.resetModules();
    redisMock.get.mockReset().mockResolvedValue(null);
    redisMock.set.mockReset();
    process.env.PSI_API_KEY = 'test-key';
  });

  afterEach(() => {
    delete process.env.PSI_API_KEY;
    vi.unstubAllGlobals();
  });

  it('parses PSI response and returns correctly scaled scores', async () => {
    const psiBody = {
      lighthouseResult: {
        categories: {
          performance: { score: 0.97 },
          accessibility: { score: 1.0 },
          'best-practices': { score: 0.95 },
          seo: { score: 1.0 },
        },
      },
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(psiBody), { status: 200 })),
    );
    const { getScores } = await import('@/lib/lighthouse-scores');
    const result = await getScores();
    expect(result.performance).toBe(97);
    expect(result.accessibility).toBe(100);
    expect(result.bestPractices).toBe(95);
    expect(result.seo).toBe(100);
    expect(typeof result.fetchedAt).toBe('string');
  });

  it('writes the fetched scores to Redis cache (fire-and-forget)', async () => {
    const psiBody = {
      lighthouseResult: {
        categories: {
          performance: { score: 0.95 },
          accessibility: { score: 1.0 },
          'best-practices': { score: 0.98 },
          seo: { score: 1.0 },
        },
      },
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(psiBody), { status: 200 })),
    );
    const { getScores, LIGHTHOUSE_TTL_S } = await import('@/lib/lighthouse-scores');
    await getScores();
    // Give fire-and-forget a tick to resolve.
    await new Promise((r) => setTimeout(r, 10));
    expect(redisMock.set).toHaveBeenCalledWith(
      'lh:scores',
      expect.objectContaining({ performance: 95 }),
      { ex: LIGHTHOUSE_TTL_S },
    );
  });

  it('returns scores and swallows error when Redis SET fails (fire-and-forget error path)', async () => {
    const psiBody = {
      lighthouseResult: {
        categories: {
          performance: { score: 0.96 },
          accessibility: { score: 1.0 },
          'best-practices': { score: 0.97 },
          seo: { score: 1.0 },
        },
      },
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(psiBody), { status: 200 })),
    );
    // Make the Redis SET fail to exercise the fire-and-forget catch branch.
    redisMock.set.mockRejectedValueOnce(new Error('Redis set failed'));
    const { getScores } = await import('@/lib/lighthouse-scores');
    const result = await getScores();
    // Scores still returned despite cache-write failure.
    expect(result.performance).toBe(96);
    // Give fire-and-forget a tick to settle.
    await new Promise((r) => setTimeout(r, 10));
  });
});
