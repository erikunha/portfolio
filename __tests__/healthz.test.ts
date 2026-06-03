import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const redisMockGet = vi.fn();

vi.mock('@/lib/rate-limit', () => ({
  getRedis: vi.fn(() => ({ get: redisMockGet })),
}));

vi.mock('@/lib/log', () => ({
  log: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

const FRESH_TIMESTAMP = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1h ago
const STALE_TIMESTAMP = new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(); // 26h ago

describe('GET /api/healthz', () => {
  beforeEach(() => {
    vi.resetModules();
    redisMockGet.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns 200 with status ok and sha when psiLastRun is fresh', async () => {
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', 'abc1234');
    redisMockGet.mockResolvedValue(FRESH_TIMESTAMP);

    const { GET } = await import('@/app/api/healthz/route');
    const res = await GET();

    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; sha: string; psiLastRun: string | null };
    expect(body.status).toBe('ok');
    expect(body.sha).toBe('abc1234');
    expect(body.psiLastRun).toBe(FRESH_TIMESTAMP);
  });

  it('returns 503 with status degraded when psiLastRun is stale (older than 25h)', async () => {
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', 'abc1234');
    redisMockGet.mockResolvedValue(STALE_TIMESTAMP);

    const { GET } = await import('@/app/api/healthz/route');
    const res = await GET();

    expect(res.status).toBe(503);
    const body = (await res.json()) as { status: string; sha: string; psiLastRun: string | null };
    expect(body.status).toBe('degraded');
    expect(body.psiLastRun).toBe(STALE_TIMESTAMP);
  });

  it('returns 503 with status degraded when psiLastRun is null (key not yet written)', async () => {
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', '');
    redisMockGet.mockResolvedValue(null);

    const { GET } = await import('@/app/api/healthz/route');
    const res = await GET();

    expect(res.status).toBe(503);
    const body = (await res.json()) as { status: string; sha: string; psiLastRun: string | null };
    expect(body.sha).toBe('local');
    expect(body.psiLastRun).toBeNull();
    expect(body.status).toBe('degraded');
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
