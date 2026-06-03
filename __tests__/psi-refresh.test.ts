import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const redisMockSet = vi.fn(async () => 'OK');
const sendMock = vi.fn(async () => ({ data: { id: 'email-id' }, error: null }));

vi.mock('@/lib/lighthouse-scores', () => ({
  refreshScores: vi.fn(),
}));

vi.mock('@/lib/rate-limit', () => ({
  getRedis: vi.fn(() => ({ set: redisMockSet })),
}));

vi.mock('resend', () => ({
  // biome-ignore lint/complexity/useArrowFunction: `function` required — arrow fns cannot be used with `new` in jsdom/vitest; the route calls `new Resend(key)`.
  Resend: vi.fn(function () {
    return { emails: { send: sendMock } };
  }),
}));

vi.mock('@/lib/log', () => ({
  log: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

function makeRequest(): NextRequest {
  return new NextRequest('http://localhost/api/psi-refresh', {
    method: 'GET',
    headers: { authorization: 'Bearer test-cron-secret' },
  });
}

describe('GET /api/psi-refresh', () => {
  beforeEach(async () => {
    vi.resetModules();
    redisMockSet.mockReset().mockResolvedValue('OK');
    sendMock.mockReset().mockResolvedValue({ data: { id: 'email-id' }, error: null });
    vi.stubEnv('CRON_SECRET', 'test-cron-secret');
    vi.stubEnv('RESEND_API_KEY', 're_test_key');
  });

  it('writes meta:psi-last-run to Redis on full success', async () => {
    const { refreshScores } = await import('@/lib/lighthouse-scores');
    const mockRefresh = vi.mocked(refreshScores);
    mockRefresh.mockResolvedValue({
      performance: 95,
      accessibility: 100,
      bestPractices: 95,
      seo: 100,
      fetchedAt: new Date().toISOString(),
    });

    const { GET } = await import('@/app/api/psi-refresh/route');
    const res = await GET(makeRequest());

    expect(res.status).toBe(200);
    expect(redisMockSet).toHaveBeenCalledWith('meta:psi-last-run', expect.any(String));
    // Verify the written value is a valid ISO timestamp
    const writtenValue = (redisMockSet.mock.calls[0] as unknown as [string, string])?.[1];
    expect(() => new Date(writtenValue).toISOString()).not.toThrow();
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('does NOT write meta:psi-last-run and sends Resend alert on partial failure', async () => {
    const { refreshScores } = await import('@/lib/lighthouse-scores');
    const mockRefresh = vi.mocked(refreshScores);
    mockRefresh
      .mockResolvedValueOnce({
        performance: 95,
        accessibility: 100,
        bestPractices: 95,
        seo: 100,
        fetchedAt: new Date().toISOString(),
      })
      .mockRejectedValueOnce(new Error('PSI API timeout'));

    const { GET } = await import('@/app/api/psi-refresh/route');
    const res = await GET(makeRequest());

    expect(res.status).toBe(500);
    expect(redisMockSet).not.toHaveBeenCalled();
    expect(sendMock).toHaveBeenCalledOnce();
    const call = (sendMock.mock.calls[0] as unknown as [{ subject: string; to: string }])?.[0];
    expect(call.subject).toContain('psi-refresh');
    expect(call.to).toBe('erikhunha@gmail.com');
  });

  it('returns 200 and logs error when Redis write throws on success path', async () => {
    redisMockSet.mockRejectedValueOnce(new Error('Redis connection reset'));
    const { refreshScores } = await import('@/lib/lighthouse-scores');
    vi.mocked(refreshScores).mockResolvedValue({
      performance: 95,
      accessibility: 100,
      bestPractices: 95,
      seo: 100,
      fetchedAt: new Date().toISOString(),
    });
    const { log } = await import('@/lib/log');

    const { GET } = await import('@/app/api/psi-refresh/route');
    const res = await GET(makeRequest());

    expect(res.status).toBe(200);
    expect(vi.mocked(log.error)).toHaveBeenCalledWith(
      'psi-refresh: failed to write meta:psi-last-run',
      expect.objectContaining({ err: expect.any(Error) }),
    );
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('skips alert and logs error when RESEND_API_KEY is not set', async () => {
    vi.unstubAllEnvs();
    vi.stubEnv('CRON_SECRET', 'test-cron-secret');
    // RESEND_API_KEY intentionally not set
    const { refreshScores } = await import('@/lib/lighthouse-scores');
    vi.mocked(refreshScores).mockRejectedValue(new Error('PSI API timeout'));
    const { log } = await import('@/lib/log');

    const { GET } = await import('@/app/api/psi-refresh/route');
    const res = await GET(makeRequest());

    expect(res.status).toBe(500);
    expect(sendMock).not.toHaveBeenCalled();
    expect(vi.mocked(log.error)).toHaveBeenCalledWith(
      'psi-refresh: RESEND_API_KEY not set, skipping alert',
    );
  });

  it('returns 401 if Authorization header is missing', async () => {
    const { GET } = await import('@/app/api/psi-refresh/route');
    const req = new NextRequest('http://localhost/api/psi-refresh', { method: 'GET' });
    const res = await GET(req);
    expect(res.status).toBe(401);
    expect(redisMockSet).not.toHaveBeenCalled();
  });
});
