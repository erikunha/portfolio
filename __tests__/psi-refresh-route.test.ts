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
    // biome-ignore lint/suspicious/noExplicitAny: NextRequest type not directly exported
    const { GET } = await import('@/app/api/psi-refresh/route');
    // biome-ignore lint/suspicious/noExplicitAny: NextRequest type not directly exported
    const res = await GET(makeRequest('Bearer anything') as any);
    expect(res.status).toBe(401);
  });

  it('returns 401 when Authorization header is missing', async () => {
    process.env.CRON_SECRET = 'secret123';
    // biome-ignore lint/suspicious/noExplicitAny: NextRequest type not directly exported
    const { GET } = await import('@/app/api/psi-refresh/route');
    // biome-ignore lint/suspicious/noExplicitAny: NextRequest type not directly exported
    const res = await GET(makeRequest() as any);
    expect(res.status).toBe(401);
  });

  it('returns 401 when Bearer token does not match CRON_SECRET', async () => {
    process.env.CRON_SECRET = 'secret123';
    // biome-ignore lint/suspicious/noExplicitAny: NextRequest type not directly exported
    const { GET } = await import('@/app/api/psi-refresh/route');
    // biome-ignore lint/suspicious/noExplicitAny: NextRequest type not directly exported
    const res = await GET(makeRequest('Bearer wrong') as any);
    expect(res.status).toBe(401);
  });
});

describe('GET /api/psi-refresh — success', () => {
  it('returns 200 with desktop and mobile scores', async () => {
    process.env.CRON_SECRET = 'secret123';
    mockRefreshScores.mockResolvedValueOnce(DESKTOP_SCORES).mockResolvedValueOnce(MOBILE_SCORES);
    // biome-ignore lint/suspicious/noExplicitAny: NextRequest type not directly exported
    const { GET } = await import('@/app/api/psi-refresh/route');
    // biome-ignore lint/suspicious/noExplicitAny: NextRequest type not directly exported
    const res = await GET(makeRequest('Bearer secret123') as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.desktop).toEqual(DESKTOP_SCORES);
    expect(body.mobile).toEqual(MOBILE_SCORES);
    expect(typeof body.durationMs).toBe('number');
  });

  it('calls refreshScores for both desktop and mobile', async () => {
    process.env.CRON_SECRET = 'secret123';
    mockRefreshScores.mockResolvedValue(DESKTOP_SCORES);
    // biome-ignore lint/suspicious/noExplicitAny: NextRequest type not directly exported
    const { GET } = await import('@/app/api/psi-refresh/route');
    // biome-ignore lint/suspicious/noExplicitAny: NextRequest type not directly exported
    await GET(makeRequest('Bearer secret123') as any);
    expect(mockRefreshScores).toHaveBeenCalledWith('desktop');
    expect(mockRefreshScores).toHaveBeenCalledWith('mobile');
  });

  it('returns null for a failed strategy while the other succeeds', async () => {
    process.env.CRON_SECRET = 'secret123';
    mockRefreshScores
      .mockResolvedValueOnce(DESKTOP_SCORES)
      .mockRejectedValueOnce(new Error('mobile PSI failed'));
    // biome-ignore lint/suspicious/noExplicitAny: NextRequest type not directly exported
    const { GET } = await import('@/app/api/psi-refresh/route');
    // biome-ignore lint/suspicious/noExplicitAny: NextRequest type not directly exported
    const res = await GET(makeRequest('Bearer secret123') as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.desktop).toEqual(DESKTOP_SCORES);
    expect(body.mobile).toBeNull();
  });

  it('logs an error when a strategy fails', async () => {
    process.env.CRON_SECRET = 'secret123';
    mockRefreshScores
      .mockResolvedValueOnce(DESKTOP_SCORES)
      .mockRejectedValueOnce(new Error('mobile PSI failed'));
    // biome-ignore lint/suspicious/noExplicitAny: NextRequest type not directly exported
    const { GET } = await import('@/app/api/psi-refresh/route');
    // biome-ignore lint/suspicious/noExplicitAny: NextRequest type not directly exported
    await GET(makeRequest('Bearer secret123') as any);
    expect(mockLogError).toHaveBeenCalledWith(
      'psi-refresh mobile failed',
      expect.objectContaining({ err: expect.any(Error) }),
    );
  });

  it('logs completion with durationMs', async () => {
    process.env.CRON_SECRET = 'secret123';
    mockRefreshScores.mockResolvedValue(DESKTOP_SCORES);
    // biome-ignore lint/suspicious/noExplicitAny: NextRequest type not directly exported
    const { GET } = await import('@/app/api/psi-refresh/route');
    // biome-ignore lint/suspicious/noExplicitAny: NextRequest type not directly exported
    await GET(makeRequest('Bearer secret123') as any);
    expect(mockLogInfo).toHaveBeenCalledWith(
      'psi-refresh completed',
      expect.objectContaining({ durationMs: expect.any(Number) }),
    );
  });
});
