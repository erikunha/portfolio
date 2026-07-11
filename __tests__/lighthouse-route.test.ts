import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const cachedScores = {
  performance: 97,
  accessibility: 100,
  bestPractices: 95,
  seo: 100,
  fetchedAt: '2026-01-01T00:00:00.000Z',
};

vi.mock('@/lib/lighthouse-scores', () => ({
  getScores: vi.fn(),
  LIGHTHOUSE_FALLBACK: {
    performance: 0,
    accessibility: 0,
    bestPractices: 0,
    seo: 0,
    fetchedAt: '—',
  },
  LIGHTHOUSE_TTL_S: 86400,
}));

vi.mock('@/lib/rate-limit', () => ({
  getRedis: vi.fn(() => ({
    get: vi.fn(async () => null),
    set: vi.fn(async () => 'OK'),
  })),
}));

vi.mock('@/lib/log', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe('GET /api/lighthouse', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns scores JSON with public cache-control header on success', async () => {
    const { getScores } = await import('@/lib/lighthouse-scores');
    vi.mocked(getScores).mockResolvedValueOnce(cachedScores);

    const { GET } = await import('@/app/api/lighthouse/route');
    const req = {} as import('next/server').NextRequest;
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.performance).toBe(97);
    expect(body.fetchedAt).toBe('2026-01-01T00:00:00.000Z');

    const cc = res.headers.get('Cache-Control');
    expect(cc).toContain('public');
    expect(cc).toContain('max-age=86400');
  });

  it('returns fallback with no-store when getScores returns fallback', async () => {
    const { getScores, LIGHTHOUSE_FALLBACK } = await import('@/lib/lighthouse-scores');
    vi.mocked(getScores).mockResolvedValueOnce(LIGHTHOUSE_FALLBACK);

    const { GET } = await import('@/app/api/lighthouse/route');
    const req = {} as import('next/server').NextRequest;
    const res = await GET(req);

    const body = await res.json();
    expect(body.fetchedAt).toBe('—');
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  it('returns fallback with no-store when getScores throws', async () => {
    const { getScores } = await import('@/lib/lighthouse-scores');
    vi.mocked(getScores).mockRejectedValueOnce(new Error('PSI timeout'));

    const { GET } = await import('@/app/api/lighthouse/route');
    const req = {} as import('next/server').NextRequest;
    const res = await GET(req);

    const body = await res.json();
    expect(body.fetchedAt).toBe('—');
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });
});
