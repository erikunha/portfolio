import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const redisMockGet = vi.fn();

vi.mock('@/lib/rate-limit', () => ({
  getRedis: vi.fn(() => ({ get: redisMockGet })),
}));

vi.mock('@/lib/log', () => ({
  log: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

describe('GET /api/healthz', () => {
  beforeEach(() => {
    vi.resetModules();
    redisMockGet.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns 200 with status ok and sha when Upstash responds', async () => {
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', 'abc1234');
    redisMockGet.mockResolvedValue('2026-06-03T03:00:00.000Z');

    const { GET } = await import('@/app/api/healthz/route');
    const res = await GET();

    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; sha: string; psiLastRun: string | null };
    expect(body).toEqual({
      status: 'ok',
      sha: 'abc1234',
      psiLastRun: '2026-06-03T03:00:00.000Z',
    });
  });

  it('returns status ok with sha=local when VERCEL_GIT_COMMIT_SHA is not set', async () => {
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', '');
    redisMockGet.mockResolvedValue(null);

    const { GET } = await import('@/app/api/healthz/route');
    const res = await GET();

    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; sha: string; psiLastRun: string | null };
    expect(body.sha).toBe('local');
    expect(body.psiLastRun).toBeNull();
  });

  it('returns 503 with status degraded when Upstash throws', async () => {
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', 'abc1234');
    redisMockGet.mockRejectedValue(new Error('connection refused'));

    const { GET } = await import('@/app/api/healthz/route');
    const res = await GET();

    expect(res.status).toBe(503);
    const body = (await res.json()) as { status: string; sha: string; psiLastRun: null };
    expect(body.status).toBe('degraded');
    expect(body.psiLastRun).toBeNull();
  });
});
