import type { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const redisMockGet = vi.fn();
const limitMock = vi.fn();
const connectionMock = vi.fn(() => Promise.resolve());

vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  connection: connectionMock,
}));
vi.mock('@/lib/redis', () => ({ getRedis: vi.fn(() => ({ get: redisMockGet })) }));
vi.mock('@/lib/server/client-ip', () => ({ getClientIp: vi.fn(() => '1.2.3.4') }));
vi.mock('@/lib/rate-limit', async () =>
  (await import('@/__tests__/helpers/ask-route')).rateLimitModule({
    getHealthzLimit: vi.fn(() => ({ limit: limitMock })),
  }),
);

const HOUR_MS = 60 * 60 * 1000;
const FRESH_TIMESTAMP = new Date(Date.now() - HOUR_MS).toISOString();
const STALE_TIMESTAMP = new Date(Date.now() - 26 * HOUR_MS).toISOString();

interface StatusBody {
  sha: string;
  stale: boolean;
  psiLastRun: string | null;
  psiAgeMs: number | null;
}

function makeMockRequest(): NextRequest {
  return new Request('http://localhost/api/status') as unknown as NextRequest;
}

async function readStatus(): Promise<{ res: Response; body: StatusBody }> {
  const { GET } = await import('@/app/api/status/route');
  const res = await GET(makeMockRequest());
  return { res, body: (await res.clone().json()) as StatusBody };
}

describe('GET /api/status freshness', () => {
  beforeEach(() => {
    vi.resetModules();
    redisMockGet.mockReset();
    limitMock.mockReset();
    limitMock.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('lets a prerender bail-out propagate instead of logging it as a rate-limit failure', async () => {
    const bailOut = new Error('needs to bail out of prerendering');
    connectionMock.mockRejectedValueOnce(bailOut);
    const { GET } = await import('@/app/api/status/route');
    await expect(GET(makeMockRequest())).rejects.toBe(bailOut);
    expect(limitMock).not.toHaveBeenCalled();
  });

  it('reports a fresh PSI run as not stale with its age and the sha', async () => {
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', 'abc1234');
    redisMockGet.mockResolvedValue(FRESH_TIMESTAMP);
    const { res, body } = await readStatus();

    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(body.sha).toBe('abc1234');
    expect(body.stale).toBe(false);
    expect(body.psiLastRun).toBe(FRESH_TIMESTAMP);
    expect(body.psiAgeMs).toBeGreaterThanOrEqual(HOUR_MS);
    expect(body.psiAgeMs).toBeLessThan(2 * HOUR_MS);
  });

  it('flags a PSI run older than 25h as stale and still answers 200', async () => {
    redisMockGet.mockResolvedValue(STALE_TIMESTAMP);
    const { res, body } = await readStatus();

    expect(res.status).toBe(200);
    expect(body.stale).toBe(true);
    expect(body.psiLastRun).toBe(STALE_TIMESTAMP);
    expect(body.psiAgeMs).toBeGreaterThan(25 * HOUR_MS);
  });

  it('flags an invalid PSI timestamp as stale with no age', async () => {
    redisMockGet.mockResolvedValue('not-a-date');
    const { res, body } = await readStatus();

    expect(res.status).toBe(200);
    expect(body.stale).toBe(true);
    expect(body.psiLastRun).toBe('not-a-date');
    expect(body.psiAgeMs).toBeNull();
  });

  it('flags a missing PSI key as stale and reports the local sha', async () => {
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', '');
    redisMockGet.mockResolvedValue(null);
    const { res, body } = await readStatus();

    expect(res.status).toBe(200);
    expect(body.sha).toBe('local');
    expect(body.stale).toBe(true);
    expect(body.psiLastRun).toBeNull();
    expect(body.psiAgeMs).toBeNull();
  });

  it('flags the data stale and answers 200, never 503, when Redis throws', async () => {
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', 'abc1234');
    redisMockGet.mockRejectedValue(new Error('connection refused'));
    const { res, body } = await readStatus();

    expect(res.status).toBe(200);
    expect(body.sha).toBe('abc1234');
    expect(body.stale).toBe(true);
    expect(body.psiLastRun).toBeNull();
  });

  it('answers 429 with Retry-After and skips Redis when the rate limit is exceeded', async () => {
    limitMock.mockResolvedValue({ success: false });
    const { GET } = await import('@/app/api/status/route');
    const res = await GET(makeMockRequest());

    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('60');
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(redisMockGet).not.toHaveBeenCalled();
  });

  it('allows the request when the rate limiter throws (fail-open)', async () => {
    limitMock.mockRejectedValue(new Error('Redis down'));
    redisMockGet.mockResolvedValue(FRESH_TIMESTAMP);
    const { res, body } = await readStatus();

    expect(res.status).toBe(200);
    expect(body.stale).toBe(false);
  });

  it('reads the PSI key once for two requests inside the cache window', async () => {
    redisMockGet.mockResolvedValue(FRESH_TIMESTAMP);
    const { GET } = await import('@/app/api/status/route');
    await GET(makeMockRequest());
    const res = await GET(makeMockRequest());

    expect(res.status).toBe(200);
    expect(redisMockGet).toHaveBeenCalledTimes(1);
  });
});
