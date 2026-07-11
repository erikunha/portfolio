import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const redisMockSet = vi.fn(async () => 'OK');
const redisMockDel = vi.fn(async () => 1);
const pipeExec = vi.fn(async () => [1, 1] as [number, number]);
const redisMockPipeline = vi.fn(() => ({
  incr: vi.fn().mockReturnThis(),
  expire: vi.fn().mockReturnThis(),
  exec: pipeExec,
}));
const sendMock = vi.fn(
  async (): Promise<{
    data: { id: string } | null;
    error: { message: string; name: string } | null;
  }> => ({
    data: { id: 'email-id' },
    error: null,
  }),
);

vi.mock('@/lib/lighthouse-scores', () => ({
  refreshScores: vi.fn(),
}));

vi.mock('@/lib/rate-limit', () => ({
  getRedis: vi.fn(() => ({ set: redisMockSet, del: redisMockDel, pipeline: redisMockPipeline })),
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
    vi.clearAllMocks();
    redisMockSet.mockResolvedValue('OK');
    redisMockDel.mockResolvedValue(1);
    pipeExec.mockResolvedValue([1, 1]);
    sendMock.mockResolvedValue({ data: { id: 'email-id' }, error: null });
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
    const writtenValue = (redisMockSet.mock.calls[0] as unknown as [string, string])?.[1];
    expect(() => new Date(writtenValue).toISOString()).not.toThrow();
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('writes meta:psi-last-run but does NOT send a Resend alert on a 1st partial failure', async () => {
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
    pipeExec.mockResolvedValue([1, 1]);

    const { GET } = await import('@/app/api/psi-refresh/route');
    const res = await GET(makeRequest());

    expect(res.status).toBe(500);
    expect(redisMockSet).toHaveBeenCalledWith('meta:psi-last-run', expect.any(String));
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('does NOT write meta:psi-last-run and does NOT alert on a 1st total failure (both strategies fail)', async () => {
    const { refreshScores } = await import('@/lib/lighthouse-scores');
    const mockRefresh = vi.mocked(refreshScores);
    mockRefresh
      .mockRejectedValueOnce(new Error('desktop PSI timeout'))
      .mockRejectedValueOnce(new Error('mobile PSI timeout'));
    pipeExec.mockResolvedValue([1, 1]);

    const { GET } = await import('@/app/api/psi-refresh/route');
    const res = await GET(makeRequest());

    expect(res.status).toBe(500);
    expect(redisMockSet).not.toHaveBeenCalled();
    expect(sendMock).not.toHaveBeenCalled();
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
      'psi-refresh: failed to write meta:psi-last-run — healthz will report degraded',
      expect.objectContaining({ err: expect.any(Error) }),
    );
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('skips alert and logs error when RESEND_API_KEY is not set (3rd consecutive failure)', async () => {
    vi.unstubAllEnvs();
    vi.stubEnv('CRON_SECRET', 'test-cron-secret');
    const { refreshScores } = await import('@/lib/lighthouse-scores');
    vi.mocked(refreshScores).mockRejectedValue(new Error('PSI API timeout'));
    pipeExec.mockResolvedValue([3, 1]);
    const { log } = await import('@/lib/log');

    const { GET } = await import('@/app/api/psi-refresh/route');
    const res = await GET(makeRequest());

    expect(res.status).toBe(500);
    expect(sendMock).not.toHaveBeenCalled();
    expect(vi.mocked(log.error)).toHaveBeenCalledWith(
      'psi-refresh: RESEND_API_KEY not set, skipping alert',
    );
  });

  it('logs API error when resend.emails.send returns { error } (3rd consecutive failure)', async () => {
    sendMock.mockResolvedValueOnce({
      data: null,
      error: { message: 'invalid_api_key', name: 'validation_error' },
    });
    const { refreshScores } = await import('@/lib/lighthouse-scores');
    vi.mocked(refreshScores).mockRejectedValue(new Error('PSI timeout'));
    pipeExec.mockResolvedValue([3, 1]);
    const { log } = await import('@/lib/log');

    const { GET } = await import('@/app/api/psi-refresh/route');
    const res = await GET(makeRequest());

    expect(res.status).toBe(500);
    expect(sendMock).toHaveBeenCalledOnce();
    expect(vi.mocked(log.error)).toHaveBeenCalledWith(
      'psi-refresh alert email API error',
      expect.objectContaining({ err: expect.objectContaining({ message: 'invalid_api_key' }) }),
    );
  });

  it('returns 401 if Authorization header is missing', async () => {
    const { GET } = await import('@/app/api/psi-refresh/route');
    const req = new NextRequest('http://localhost/api/psi-refresh', { method: 'GET' });
    const res = await GET(req);
    expect(res.status).toBe(401);
    expect(redisMockSet).not.toHaveBeenCalled();
  });

  it('does NOT email on a single (1st) strategy failure', async () => {
    const { refreshScores } = await import('@/lib/lighthouse-scores');
    vi.mocked(refreshScores).mockImplementation(async (s) => {
      if (s === 'mobile') throw new Error('PSI API returned 500 for strategy=mobile: x');
      return { performance: 99, accessibility: 100, bestPractices: 95, seo: 100, fetchedAt: 'now' };
    });
    pipeExec.mockResolvedValue([1, 1]);
    const { GET } = await import('@/app/api/psi-refresh/route');
    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('emails on the 3rd consecutive strategy failure', async () => {
    const { refreshScores } = await import('@/lib/lighthouse-scores');
    vi.mocked(refreshScores).mockImplementation(async (s) => {
      if (s === 'mobile') throw new Error('PSI API returned 500 for strategy=mobile: x');
      return { performance: 99, accessibility: 100, bestPractices: 95, seo: 100, fetchedAt: 'now' };
    });
    pipeExec.mockResolvedValue([3, 1]);
    const { GET } = await import('@/app/api/psi-refresh/route');
    await GET(makeRequest());
    expect(sendMock).toHaveBeenCalledTimes(1);
    const call = (sendMock.mock.calls[0] as unknown as [{ text: string }])?.[0];
    expect(call.text).toContain('mobile');
  });

  it('resets (DEL) a strategy counter on its success and does not email', async () => {
    const { refreshScores } = await import('@/lib/lighthouse-scores');
    vi.mocked(refreshScores).mockResolvedValue({
      performance: 99,
      accessibility: 100,
      bestPractices: 95,
      seo: 100,
      fetchedAt: 'now',
    });
    const { GET } = await import('@/app/api/psi-refresh/route');
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    expect(redisMockDel).toHaveBeenCalledWith('meta:psi-consec-failures:desktop');
    expect(redisMockDel).toHaveBeenCalledWith('meta:psi-consec-failures:mobile');
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('still writes meta:psi-last-run and does not throw when the counter pipeline fails', async () => {
    const { refreshScores } = await import('@/lib/lighthouse-scores');
    vi.mocked(refreshScores).mockImplementation(async (s) => {
      if (s === 'mobile') throw new Error('boom');
      return { performance: 99, accessibility: 100, bestPractices: 95, seo: 100, fetchedAt: 'now' };
    });
    pipeExec.mockRejectedValue(new Error('redis down'));
    const { GET } = await import('@/app/api/psi-refresh/route');
    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
    expect(redisMockSet).toHaveBeenCalledWith('meta:psi-last-run', expect.any(String));
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('a Redis error on the first strategy does NOT skip the second strategy (per-strategy try/catch)', async () => {
    const { refreshScores } = await import('@/lib/lighthouse-scores');
    vi.mocked(refreshScores).mockImplementation(async (s) => {
      if (s === 'mobile') throw new Error('PSI API returned 500 for strategy=mobile: x');
      return { performance: 99, accessibility: 100, bestPractices: 95, seo: 100, fetchedAt: 'now' };
    });
    redisMockDel.mockRejectedValueOnce(new Error('redis blip on desktop del'));
    pipeExec.mockResolvedValue([3, 1]);
    const { GET } = await import('@/app/api/psi-refresh/route');
    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
    expect(sendMock).toHaveBeenCalledTimes(1);
    const call = (sendMock.mock.calls[0] as unknown as [{ text: string }])?.[0];
    expect(call.text).toContain('mobile');
  });
});
