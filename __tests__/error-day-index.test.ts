import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createErrorStore } from '@/__tests__/helpers/error-store';
import { errorFingerprint } from '@/lib/error-fingerprint';

const SECRET = 'cron-secret-for-tests';
const REPORT_AT = '2026-11-17T12:00:00.000Z';
const OTHER_DAY_REPORT_AT = '2026-11-16T12:00:00.000Z';
const DIGEST_AT = '2026-11-18T05:00:00.000Z';
const DIGEST_DAY = '2026-11-17';
const RELEASE = 'abc1234';
const WEEK_SECONDS = 604_800;
const OPEN_CURSOR = '7';
const NOISE_KEY_COUNT = 20_000;

const send = vi.fn(
  async (): Promise<{ data: { id: string } | null; error: { message: string } | null }> => ({
    data: { id: 'mail-id' },
    error: null,
  }),
);

const store = createErrorStore();
const { members, ttls, values, pages } = store;
const scan = vi.fn();

async function report(message: string, release = RELEASE): Promise<Response> {
  const { POST } = await import('@/app/api/log/route');
  return POST(
    new NextRequest('http://localhost/api/log', {
      method: 'POST',
      body: JSON.stringify({ level: 'error', release, message }),
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

async function digest(): Promise<Response> {
  const { GET } = await import('@/app/api/error-digest/route');
  return GET(
    new NextRequest('http://localhost/api/error-digest', {
      method: 'GET',
      headers: { authorization: `Bearer ${SECRET}` },
    }),
  );
}

async function summaryOf(res: Response): Promise<Record<string, unknown>> {
  const body = (await res.json()) as { data: Record<string, unknown> };
  return body.data;
}

const mailText = (): string => (send.mock.calls[0] as unknown as [{ text: string }])[0].text;

describe('error records indexed per day', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    store.reset();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(REPORT_AT));
    vi.stubEnv('CRON_SECRET', SECRET);
    vi.stubEnv('RESEND_API_KEY', 're_test_key');
    vi.doMock('@/lib/redis', () => ({ getRedis: () => ({ ...store.redis(), scan }) }));
    vi.doMock('@/lib/server/client-ip', () => ({ getClientIp: () => '127.0.0.1' }));
    vi.doMock('@/lib/rate-limit', () => ({
      getErrorLogLimit: () => ({ limit: async () => ({ success: true }) }),
      getErrorLogDailyLimit: () => ({ limit: async () => ({ success: true }) }),
      getErrorLogIpDailyLimit: () => ({ limit: async () => ({ success: true }) }),
    }));
    vi.doMock('@/lib/ip-hash', () => ({ hashIp: async () => 'hashed-ip-test' }));
    vi.doMock('@/lib/log', async () => (await import('@/__tests__/helpers/modules')).logModule());
    vi.doMock('resend', async () =>
      (await import('@/__tests__/helpers/modules')).resendModule(send),
    );
    send.mockResolvedValue({ data: { id: 'mail-id' }, error: null });
    scan.mockRejectedValue(new Error('the digest must not scan the shared store'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it('adds the release and fingerprint to the day index with the record TTL', async () => {
    await report('boom');
    const fingerprint = errorFingerprint({ message: 'boom' });
    const dayKey = `errday:${DIGEST_DAY}`;
    expect([...(members.get(dayKey) ?? [])]).toEqual([`${RELEASE}:${fingerprint}`]);
    expect(ttls.get(dayKey)).toBe(WEEK_SECONDS);
  });

  it('keeps one index entry however often a fingerprint repeats', async () => {
    await report('boom');
    await report('boom');
    await report('boom');
    expect(members.get(`errday:${DIGEST_DAY}`)?.size).toBe(1);
  });

  it('lets the digest find a fingerprint through the index without scanning the store', async () => {
    await report('boom');
    vi.setSystemTime(new Date(DIGEST_AT));
    for (let key = 0; key < NOISE_KEY_COUNT; key += 1) values.set(`ask:noise:${key}`, key);
    const res = await digest();
    expect(res.status).toBe(200);
    expect(scan).not.toHaveBeenCalled();
    const summary = await summaryOf(res);
    expect(summary.fingerprints).toBe(1);
    expect(summary.truncated).toBe(false);
    expect(mailText()).toContain(errorFingerprint({ message: 'boom' }));
  });

  it('counts the repeats of an indexed fingerprint', async () => {
    await report('boom');
    await report('boom');
    vi.setSystemTime(new Date(DIGEST_AT));
    await digest();
    expect(mailText()).toMatch(/\b2x/);
  });

  it('reads only the index of the previous UTC day', async () => {
    vi.setSystemTime(new Date(OTHER_DAY_REPORT_AT));
    await report('boom');
    vi.setSystemTime(new Date(DIGEST_AT));
    const res = await digest();
    expect((await summaryOf(res)).fingerprints).toBe(0);
    expect(send).not.toHaveBeenCalled();
  });

  it('ignores an index member that is not release and fingerprint', async () => {
    members.set(`errday:${DIGEST_DAY}`, new Set(['garbage', 'a:b:c']));
    vi.setSystemTime(new Date(DIGEST_AT));
    const res = await digest();
    expect(res.status).toBe(200);
    expect((await summaryOf(res)).fingerprints).toBe(0);
  });

  it('reports truncated when the index never reaches its last page', async () => {
    pages.sscan = () => [OPEN_CURSOR, [`${RELEASE}:${errorFingerprint({ message: 'boom' })}`]];
    vi.setSystemTime(new Date(DIGEST_AT));
    const res = await digest();
    expect((await summaryOf(res)).truncated).toBe(true);
  });
});
