import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const limit = vi.hoisted(() => vi.fn());
const connection = vi.hoisted(() => vi.fn(() => Promise.resolve()));

vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  connection,
}));
vi.mock('@/lib/log', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/lib/rate-limit', () => ({
  getClientIp: vi.fn(() => '203.0.113.7'),
  getHealthzLimit: vi.fn(() => ({ limit })),
  getLighthouseLimit: vi.fn(() => ({ limit })),
  getRedis: vi.fn(() => ({})),
}));
vi.mock('@/lib/lighthouse-scores', () => ({
  getScores: vi.fn(),
  refreshScores: vi.fn(),
  LIGHTHOUSE_FALLBACK: { fetchedAt: '-' },
  LIGHTHOUSE_TTL_S: 86400,
}));
vi.mock('resend', () => ({ Resend: class {} }));

interface Failure {
  ok: false;
  requestId: string;
  error: { code: string; message: string };
}

async function expectEnvelope(res: Response, status: number, code: string): Promise<Failure> {
  expect(res.status).toBe(status);
  const body = (await res.json()) as Failure;
  expect(
    body,
    'every JSON /api failure carries { ok: false, requestId, error: { code, message } }; a plain-text body forces clients to switch on the route',
  ).toMatchObject({ ok: false, error: { code, message: expect.any(String) } });
  expect(res.headers.get('X-Request-Id')).toBe(body.requestId);
  return body;
}

describe('failures from the GET and cron routes use the shared envelope', () => {
  beforeEach(() => {
    vi.resetModules();
    limit.mockReset();
    vi.stubEnv('CRON_SECRET', 'x'.repeat(24));
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('healthz rate limit', async () => {
    limit.mockResolvedValue({ success: false });
    const { GET } = await import('@/app/api/healthz/route');
    const res = await GET(new NextRequest('http://localhost/api/healthz'));
    await expectEnvelope(res, 429, 'rate_limited');
    expect(res.headers.get('Retry-After')).toBe('60');
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  it('lighthouse rate limit', async () => {
    limit.mockResolvedValue({ success: false });
    const { GET } = await import('@/app/api/lighthouse/route');
    const res = await GET(new NextRequest('http://localhost/api/lighthouse'));
    await expectEnvelope(res, 429, 'rate_limited');
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  it.each(['psi-refresh', 'contact-retry'])('%s without the cron bearer', async (route) => {
    const { GET } = await import(`@/app/api/${route}/route`);
    const res = await GET(new NextRequest(`http://localhost/api/${route}`));
    await expectEnvelope(res, 401, 'unauthorized');
  });
});
