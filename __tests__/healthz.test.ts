import type { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const redisMockPing = vi.fn();
const limitMock = vi.fn();
const getClientIpMock = vi.fn(() => '1.2.3.4');
const connectionMock = vi.fn(() => Promise.resolve());

vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  connection: connectionMock,
}));

vi.mock('@/lib/redis', () => ({ getRedis: vi.fn(() => ({ ping: redisMockPing })) }));
vi.mock('@/lib/server/client-ip', () => ({ getClientIp: getClientIpMock }));
vi.mock('@/lib/rate-limit', () => ({ getHealthzLimit: vi.fn(() => ({ limit: limitMock })) }));

function makeMockRequest(): NextRequest {
  return new Request('http://localhost/api/healthz') as unknown as NextRequest;
}

describe('GET /api/healthz', () => {
  beforeEach(() => {
    vi.resetModules();
    redisMockPing.mockReset();
    redisMockPing.mockResolvedValue('PONG');
    limitMock.mockReset();
    limitMock.mockResolvedValue({ success: true });
    getClientIpMock.mockReturnValue('1.2.3.4');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('lets a prerender bail-out propagate instead of logging it as a rate-limit failure', async () => {
    const bailOut = new Error('needs to bail out of prerendering');
    connectionMock.mockRejectedValueOnce(bailOut);
    const { GET } = await import('@/app/api/healthz/route');
    await expect(GET(makeMockRequest())).rejects.toBe(bailOut);
    expect(limitMock).not.toHaveBeenCalled();
  });

  it('returns 429 with Retry-After header when rate limit is exceeded', async () => {
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', 'abc1234');
    limitMock.mockResolvedValue({ success: false });

    const { GET } = await import('@/app/api/healthz/route');
    const res = await GET(makeMockRequest());

    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('60');
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(redisMockPing).not.toHaveBeenCalled();
  });

  it('allows request and returns health status when rate limiter throws (fail-open)', async () => {
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', 'abc1234');
    limitMock.mockRejectedValue(new Error('Redis down'));

    const { GET } = await import('@/app/api/healthz/route');
    const res = await GET(makeMockRequest());

    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe('ok');
  });
});
