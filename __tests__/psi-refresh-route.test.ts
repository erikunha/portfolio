import { afterEach, describe, expect, it, vi } from 'vitest';

const mockRefreshScores = vi.fn();
vi.mock('@/lib/lighthouse-scores', () => ({
  refreshScores: mockRefreshScores,
}));

const mockLogInfo = vi.fn();
const mockLogError = vi.fn();
vi.mock('@/lib/log', () => ({ log: { info: mockLogInfo, error: mockLogError } }));

const mockRedisSet = vi.fn(async () => 'OK');
const mockRedisDel = vi.fn(async () => 1);
const mockPipeExec = vi.fn(async () => [1, 1] as [number, number]);
const mockRedisPipeline = vi.fn(() => ({
  incr: vi.fn().mockReturnThis(),
  expire: vi.fn().mockReturnThis(),
  exec: mockPipeExec,
}));
vi.mock('@/lib/rate-limit', () => ({
  getRedis: vi.fn(() => ({ set: mockRedisSet, del: mockRedisDel, pipeline: mockRedisPipeline })),
}));

// Resend must use `function` (not arrow) so `new Resend(...)` in the route works.
const mockSendEmail = vi.fn(async () => ({ data: { id: 'x' }, error: null }));
vi.mock('resend', () => ({
  // biome-ignore lint/complexity/useArrowFunction: `function` required — arrow fns cannot be used with `new` in jsdom/vitest; the route calls `new Resend(key)`.
  Resend: vi.fn(function () {
    return { emails: { send: mockSendEmail } };
  }),
}));

afterEach(() => {
  vi.resetModules();
  mockRefreshScores.mockReset();
  mockLogInfo.mockReset();
  mockLogError.mockReset();
  mockRedisSet.mockReset().mockResolvedValue('OK');
  mockRedisDel.mockReset().mockResolvedValue(1);
  mockPipeExec.mockReset().mockResolvedValue([1, 1]);
  mockSendEmail.mockReset().mockResolvedValue({ data: { id: 'x' }, error: null });
  delete process.env.CRON_SECRET;
  delete process.env.RESEND_API_KEY;
});

function makeRequest(authHeader?: string) {
  return new Request('http://localhost/api/psi-refresh', {
    method: 'GET',
    headers: authHeader ? { authorization: authHeader } : {},
  });
}

const DESKTOP_SCORES = {
  performance: 99,
  accessibility: 100,
  bestPractices: 95,
  seo: 100,
  fetchedAt: '2026-05-29T03:00:00.000Z',
};
const MOBILE_SCORES = {
  performance: 90,
  accessibility: 100,
  bestPractices: 95,
  seo: 100,
  fetchedAt: '2026-05-29T03:00:01.000Z',
};

describe('GET /api/psi-refresh — auth', () => {
  it('returns 401 when CRON_SECRET is not set', async () => {
    const { GET } = await import('@/app/api/psi-refresh/route');
    const res = await GET(makeRequest('Bearer anything') as never);
    expect(res.status).toBe(401);
  });

  it('returns 401 when Authorization header is missing', async () => {
    process.env.CRON_SECRET = 'secret123';
    const { GET } = await import('@/app/api/psi-refresh/route');
    const res = await GET(makeRequest() as never);
    expect(res.status).toBe(401);
  });

  it('returns 401 when Bearer token does not match CRON_SECRET', async () => {
    process.env.CRON_SECRET = 'secret123';
    const { GET } = await import('@/app/api/psi-refresh/route');
    const res = await GET(makeRequest('Bearer wrong') as never);
    expect(res.status).toBe(401);
  });
});

describe('GET /api/psi-refresh — success', () => {
  it('returns 200 with desktop and mobile scores when both succeed', async () => {
    process.env.CRON_SECRET = 'secret123';
    mockRefreshScores.mockResolvedValueOnce(DESKTOP_SCORES).mockResolvedValueOnce(MOBILE_SCORES);
    const { GET } = await import('@/app/api/psi-refresh/route');
    const res = await GET(makeRequest('Bearer secret123') as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.desktop).toEqual(DESKTOP_SCORES);
    expect(body.mobile).toEqual(MOBILE_SCORES);
    expect(typeof body.durationMs).toBe('number');
  });

  it('calls refreshScores for both desktop and mobile', async () => {
    process.env.CRON_SECRET = 'secret123';
    mockRefreshScores.mockResolvedValue(DESKTOP_SCORES);
    const { GET } = await import('@/app/api/psi-refresh/route');
    await GET(makeRequest('Bearer secret123') as never);
    expect(mockRefreshScores).toHaveBeenCalledWith('desktop');
    expect(mockRefreshScores).toHaveBeenCalledWith('mobile');
  });

  it('returns 500 with null for a failed strategy while the other succeeds', async () => {
    process.env.CRON_SECRET = 'secret123';
    process.env.RESEND_API_KEY = 're_test';
    mockRefreshScores
      .mockResolvedValueOnce(DESKTOP_SCORES)
      .mockRejectedValueOnce(new Error('mobile PSI failed'));
    const { GET } = await import('@/app/api/psi-refresh/route');
    const res = await GET(makeRequest('Bearer secret123') as never);
    // WHY: 500 surfaces the failure in the Vercel Cron dashboard and triggers the alert.
    // (Vercel Cron does not auto-retry; recovery is the next daily run.)
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.desktop).toEqual(DESKTOP_SCORES);
    expect(body.mobile).toBeNull();
  });

  it('returns 500 when both strategies fail', async () => {
    process.env.CRON_SECRET = 'secret123';
    process.env.RESEND_API_KEY = 're_test';
    mockRefreshScores
      .mockRejectedValueOnce(new Error('desktop PSI failed'))
      .mockRejectedValueOnce(new Error('mobile PSI failed'));
    const { GET } = await import('@/app/api/psi-refresh/route');
    const res = await GET(makeRequest('Bearer secret123') as never);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.desktop).toBeNull();
    expect(body.mobile).toBeNull();
  });

  it('logs an error when a strategy fails', async () => {
    process.env.CRON_SECRET = 'secret123';
    process.env.RESEND_API_KEY = 're_test';
    mockRefreshScores
      .mockResolvedValueOnce(DESKTOP_SCORES)
      .mockRejectedValueOnce(new Error('mobile PSI failed'));
    const { GET } = await import('@/app/api/psi-refresh/route');
    await GET(makeRequest('Bearer secret123') as never);
    expect(mockLogError).toHaveBeenCalledWith(
      'psi-refresh failed',
      expect.objectContaining({ errors: expect.stringContaining('mobile PSI failed') }),
    );
  });

  it('logs completion with durationMs', async () => {
    process.env.CRON_SECRET = 'secret123';
    mockRefreshScores.mockResolvedValue(DESKTOP_SCORES);
    const { GET } = await import('@/app/api/psi-refresh/route');
    await GET(makeRequest('Bearer secret123') as never);
    expect(mockLogInfo).toHaveBeenCalledWith(
      'psi-refresh completed',
      expect.objectContaining({ durationMs: expect.any(Number) }),
    );
  });

  it('logs an error when desktop strategy fails', async () => {
    process.env.CRON_SECRET = 'secret123';
    process.env.RESEND_API_KEY = 're_test';
    mockRefreshScores
      .mockRejectedValueOnce(new Error('desktop PSI failed'))
      .mockResolvedValueOnce(MOBILE_SCORES);
    const { GET } = await import('@/app/api/psi-refresh/route');
    await GET(makeRequest('Bearer secret123') as never);
    expect(mockLogError).toHaveBeenCalledWith(
      'psi-refresh failed',
      expect.objectContaining({ errors: expect.stringContaining('desktop PSI failed') }),
    );
  });
});

describe('GET /api/psi-refresh — function config', () => {
  it('sets maxDuration high enough for the parallel PSI audits to complete', async () => {
    // WHY: a fresh PSI run takes 15–40s; without a raised maxDuration the function is
    // killed before PSI returns and the freshness key is never written (healthz degraded).
    const route = await import('@/app/api/psi-refresh/route');
    expect(route.maxDuration).toBeGreaterThanOrEqual(60);
  });
});
