import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createErrorStore } from '@/__tests__/helpers/error-store';
import { errorFingerprint } from '@/lib/error-fingerprint';

const SECRET = 'cron-secret-for-tests';
const REPORT_AT = '2026-11-17T12:00:00.000Z';
const DIGEST_AT = '2026-11-18T05:00:00.000Z';
const DIGEST_DAY = '2026-11-17';
const RELEASE = 'abc1234';
const WEEK_SECONDS = 604_800;
const MAX_STORED_STACK_CHARS = 4096;
const SEEDED_URL = 'https://evil.example/login';
const REAL_URL = 'https://erikunha.dev/pt';
const SEEDED_MESSAGE = 'Cannot load chunk 1 from evil.example';
const REAL_MESSAGE = 'Cannot load chunk 2 from evil.example';
const SEEDED_STACK = 'at load (https://evil.example/app.js:1:1)';
const REAL_STACK = 'at load (https://erikunha.dev/_next/app.js:9:9)';

const store = createErrorStore();
const send = vi.fn(
  async (): Promise<{ data: { id: string } | null; error: { message: string } | null }> => ({
    data: { id: 'mail-id' },
    error: null,
  }),
);

async function report(body: Record<string, unknown>): Promise<Response> {
  const { POST } = await import('@/app/api/log/route');
  return POST(
    new NextRequest('http://localhost/api/log', {
      method: 'POST',
      body: JSON.stringify({ level: 'error', release: RELEASE, ...body }),
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

const fingerprintOf = (message: string, stack?: string): string =>
  errorFingerprint({ message, stack });
const recordKey = (message: string, stack?: string): string =>
  `err:${RELEASE}:${DIGEST_DAY}:${fingerprintOf(message, stack)}`;
const sampleKey = (message: string, stack?: string): string =>
  `errlast:${RELEASE}:${DIGEST_DAY}:${fingerprintOf(message, stack)}`;
const stored = (key: string): Record<string, unknown> =>
  JSON.parse(String(store.values.get(key))) as Record<string, unknown>;
const mailText = (): string => (send.mock.calls[0] as unknown as [{ text: string }])[0].text;

describe('latest error sample beside the first record', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    store.reset();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(REPORT_AT));
    vi.stubEnv('CRON_SECRET', SECRET);
    vi.stubEnv('RESEND_API_KEY', 're_test_key');
    vi.doMock('@/lib/redis', () => ({ getRedis: () => store.redis() }));
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
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it('keeps the first record and stores the newest report under its own key with the same TTL', async () => {
    await report({ message: SEEDED_MESSAGE, url: SEEDED_URL, stack: SEEDED_STACK });
    await report({ message: REAL_MESSAGE, url: REAL_URL, stack: REAL_STACK });
    expect(fingerprintOf(SEEDED_MESSAGE, SEEDED_STACK)).toBe(
      fingerprintOf(REAL_MESSAGE, REAL_STACK),
    );
    expect(stored(recordKey(SEEDED_MESSAGE, SEEDED_STACK)).url).toBe(SEEDED_URL);
    const sample = stored(sampleKey(SEEDED_MESSAGE, SEEDED_STACK));
    expect(sample.url).toBe(REAL_URL);
    expect(sample.message).toBe(REAL_MESSAGE);
    expect(sample.stack).toBe(REAL_STACK);
    expect(store.ttls.get(sampleKey(SEEDED_MESSAGE, SEEDED_STACK))).toBe(WEEK_SECONDS);
  });

  it('writes the sample for the first report of a fingerprint too', async () => {
    await report({ message: SEEDED_MESSAGE, url: SEEDED_URL });
    expect(stored(sampleKey(SEEDED_MESSAGE)).url).toBe(SEEDED_URL);
  });

  it('bounds the stored sample stack', async () => {
    const stack = 's'.repeat(MAX_STORED_STACK_CHARS * 2);
    await report({ message: SEEDED_MESSAGE, stack });
    expect(String(stored(sampleKey(SEEDED_MESSAGE, stack)).stack)).toHaveLength(
      MAX_STORED_STACK_CHARS,
    );
  });

  it('keeps one sample key per fingerprint however often it repeats', async () => {
    await report({ message: SEEDED_MESSAGE });
    await report({ message: REAL_MESSAGE });
    await report({ message: REAL_MESSAGE });
    const sampleKeys = [...store.values.keys()].filter((key) => key.startsWith('errlast:'));
    expect(sampleKeys).toHaveLength(1);
  });

  it('shows the digest the latest message, not the first writer message', async () => {
    await report({ message: SEEDED_MESSAGE, url: SEEDED_URL });
    await report({ message: REAL_MESSAGE, url: REAL_URL });
    vi.setSystemTime(new Date(DIGEST_AT));
    await digest();
    expect(mailText()).toContain('chunk 2');
    expect(mailText()).not.toContain('chunk 1');
  });

  it('falls back to the first record when the sample has expired', async () => {
    await report({ message: SEEDED_MESSAGE });
    store.values.delete(sampleKey(SEEDED_MESSAGE));
    vi.setSystemTime(new Date(DIGEST_AT));
    await digest();
    expect(mailText()).toContain('chunk 1');
  });
});
