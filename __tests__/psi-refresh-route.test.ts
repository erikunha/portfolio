import { afterEach, describe, expect, it, vi } from 'vitest';

const mockRefreshScores = vi.fn();
vi.mock('@/lib/lighthouse-scores', () => ({
  refreshScores: mockRefreshScores,
}));

const mockLogInfo = vi.fn();
const mockLogError = vi.fn();
vi.mock('@/lib/log', () => ({ log: { info: mockLogInfo, error: mockLogError } }));

afterEach(() => {
  vi.resetModules();
  mockRefreshScores.mockReset();
  mockLogInfo.mockReset();
  mockLogError.mockReset();
  delete process.env.CRON_SECRET;
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
    mockRefreshScores
      .mockResolvedValueOnce(DESKTOP_SCORES)
      .mockRejectedValueOnce(new Error('mobile PSI failed'));
    const { GET } = await import('@/app/api/psi-refresh/route');
    const res = await GET(makeRequest('Bearer secret123') as never);
    // WHY: 500 so Vercel Cron retries and surfaces the failure in the dashboard.
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.desktop).toEqual(DESKTOP_SCORES);
    expect(body.mobile).toBeNull();
  });

  it('returns 500 when both strategies fail', async () => {
    process.env.CRON_SECRET = 'secret123';
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
    mockRefreshScores
      .mockResolvedValueOnce(DESKTOP_SCORES)
      .mockRejectedValueOnce(new Error('mobile PSI failed'));
    const { GET } = await import('@/app/api/psi-refresh/route');
    await GET(makeRequest('Bearer secret123') as never);
    expect(mockLogError).toHaveBeenCalledWith(
      'psi-refresh mobile failed',
      expect.objectContaining({ err: expect.any(Error) }),
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
    mockRefreshScores
      .mockRejectedValueOnce(new Error('desktop PSI failed'))
      .mockResolvedValueOnce(MOBILE_SCORES);
    const { GET } = await import('@/app/api/psi-refresh/route');
    await GET(makeRequest('Bearer secret123') as never);
    expect(mockLogError).toHaveBeenCalledWith(
      'psi-refresh desktop failed',
      expect.objectContaining({ err: expect.any(Error) }),
    );
  });
});
