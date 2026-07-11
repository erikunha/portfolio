import type { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const redisMockGet = vi.fn();
const limitMock = vi.fn();
const getClientIpMock = vi.fn(() => '1.2.3.4');

vi.mock('@/lib/rate-limit', () => ({
  getRedis: vi.fn(() => ({ get: redisMockGet })),
  getHealthzLimit: vi.fn(() => ({ limit: limitMock })),
  getClientIp: getClientIpMock,
}));

const FRESH_TIMESTAMP = new Date(Date.now() - 60 * 60 * 1000).toISOString();
const STALE_TIMESTAMP = new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString();

function makeMockRequest(): NextRequest {
  return new Request('http://localhost/api/healthz') as unknown as NextRequest;
}

describe('GET /api/healthz', () => {
  beforeEach(() => {
    vi.resetModules();
    redisMockGet.mockReset();
    limitMock.mockReset();
    limitMock.mockResolvedValue({ success: true });
    getClientIpMock.mockReturnValue('1.2.3.4');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns 200 with status ok and sha when psiLastRun is fresh', async () => {
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', 'abc1234');
    redisMockGet.mockResolvedValue(FRESH_TIMESTAMP);

    const { GET } = await import('@/app/api/healthz/route');
    const res = await GET(makeMockRequest());

    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    const body = (await res.json()) as { status: string; sha: string; psiLastRun: string | null };
    expect(body.status).toBe('ok');
    expect(body.sha).toBe('abc1234');
    expect(body.psiLastRun).toBe(FRESH_TIMESTAMP);
  });

  it('returns 503 with status degraded when psiLastRun is an invalid (NaN) timestamp', async () => {
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', 'abc1234');
    redisMockGet.mockResolvedValue('not-a-date');

    const { GET } = await import('@/app/api/healthz/route');
    const res = await GET(makeMockRequest());

    expect(res.status).toBe(503);
    const body = (await res.json()) as { status: string; sha: string; psiLastRun: string | null };
    expect(body.status).toBe('degraded');
    expect(body.psiLastRun).toBe('not-a-date');
  });

  it('returns 503 with status degraded when psiLastRun is stale (older than 25h)', async () => {
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', 'abc1234');
    redisMockGet.mockResolvedValue(STALE_TIMESTAMP);

    const { GET } = await import('@/app/api/healthz/route');
    const res = await GET(makeMockRequest());

    expect(res.status).toBe(503);
    const body = (await res.json()) as { status: string; sha: string; psiLastRun: string | null };
    expect(body.status).toBe('degraded');
    expect(body.psiLastRun).toBe(STALE_TIMESTAMP);
  });

  it('returns 503 with status degraded when psiLastRun is null (key not yet written)', async () => {
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', '');
    redisMockGet.mockResolvedValue(null);

    const { GET } = await import('@/app/api/healthz/route');
    const res = await GET(makeMockRequest());

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
    const res = await GET(makeMockRequest());

    expect(res.status).toBe(503);
    const body = (await res.json()) as { status: string; sha: string; psiLastRun: null };
    expect(body.status).toBe('degraded');
    expect(body.psiLastRun).toBeNull();
  });

  it('returns 429 with Retry-After header when rate limit is exceeded', async () => {
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', 'abc1234');
    limitMock.mockResolvedValue({ success: false });

    const { GET } = await import('@/app/api/healthz/route');
    const res = await GET(makeMockRequest());

    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('60');
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(redisMockGet).not.toHaveBeenCalled();
  });

  it('allows request and returns health status when rate limiter throws (fail-open)', async () => {
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', 'abc1234');
    limitMock.mockRejectedValue(new Error('Redis down'));
    redisMockGet.mockResolvedValue(FRESH_TIMESTAMP);

    const { GET } = await import('@/app/api/healthz/route');
    const res = await GET(makeMockRequest());

    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe('ok');
  });

  it('reads psiLastRun from in-process cache on second request within TTL', async () => {
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', 'abc1234');
    redisMockGet.mockResolvedValue(FRESH_TIMESTAMP);

    const { GET } = await import('@/app/api/healthz/route');
    await GET(makeMockRequest());
    const res = await GET(makeMockRequest());

    expect(res.status).toBe(200);
    expect(redisMockGet).toHaveBeenCalledTimes(1);
  });
});
