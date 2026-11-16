import type { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const redisMockPing = vi.fn();
const redisMockGet = vi.fn();
const limitMock = vi.fn();

vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  connection: vi.fn(() => Promise.resolve()),
}));
vi.mock('@/lib/redis', () => ({
  getRedis: vi.fn(() => ({ ping: redisMockPing, get: redisMockGet })),
}));
vi.mock('@/lib/server/client-ip', () => ({ getClientIp: vi.fn(() => '1.2.3.4') }));
vi.mock('@/lib/rate-limit', () => ({ getHealthzLimit: vi.fn(() => ({ limit: limitMock })) }));

const STALE_TIMESTAMP = new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString();

function makeMockRequest(): NextRequest {
  return new Request('http://localhost/api/healthz') as unknown as NextRequest;
}

describe('GET /api/healthz liveness', () => {
  beforeEach(() => {
    vi.resetModules();
    redisMockPing.mockReset();
    redisMockGet.mockReset();
    limitMock.mockReset();
    limitMock.mockResolvedValue({ success: true });
    redisMockPing.mockResolvedValue('PONG');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('answers 200 ok with the build sha when Redis is reachable', async () => {
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', 'abc1234');
    const { GET } = await import('@/app/api/healthz/route');
    const res = await GET(makeMockRequest());

    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(await res.json()).toEqual({ status: 'ok', sha: 'abc1234' });
    expect(redisMockPing).toHaveBeenCalledTimes(1);
  });

  it('falls back to the local sha outside a Vercel build', async () => {
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', '');
    const { GET } = await import('@/app/api/healthz/route');
    const body = (await (await GET(makeMockRequest())).json()) as { sha: string };
    expect(body.sha).toBe('local');
  });

  it('answers 503 degraded with the sha when Redis is unreachable', async () => {
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', 'abc1234');
    redisMockPing.mockRejectedValue(new Error('connection refused'));
    const { GET } = await import('@/app/api/healthz/route');
    const res = await GET(makeMockRequest());

    expect(res.status).toBe(503);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(await res.json()).toEqual({ status: 'degraded', sha: 'abc1234' });
  });

  it('does not report PSI staleness: a stale refresh key leaves it 200 and unread', async () => {
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', 'abc1234');
    redisMockGet.mockResolvedValue(STALE_TIMESTAMP);
    const { GET } = await import('@/app/api/healthz/route');
    const res = await GET(makeMockRequest());

    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe('ok');
    expect(body).not.toHaveProperty('psiLastRun');
    expect(redisMockGet).not.toHaveBeenCalled();
  });
});
