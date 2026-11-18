import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const SECRET = 'test-cron-secret-0123456789';
const RUN_AT = '2026-11-18T05:00:00.000Z';
const DIGEST_DAY = '2026-11-17';
const FP_A = 'a'.repeat(16);
const TOKEN = 'sk_live_9f8e7d6c5b4a';
const store = new Map<string, unknown>();
const scan = vi.fn();
const send = vi.fn(
  async (): Promise<{ data: { id: string } | null; error: { message: string } | null }> => ({
    data: { id: 'mail-id' },
    error: null,
  }),
);

vi.mock('@/lib/redis', () => ({
  getRedis: () => ({
    scan,
    mget: async (...keys: string[]) => keys.map((key) => store.get(key) ?? null),
    pipeline: () => ({ set: vi.fn().mockReturnThis(), exec: vi.fn(async () => []) }),
  }),
}));
vi.mock('resend', async () => (await import('@/__tests__/helpers/modules')).resendModule(send));
vi.mock('@/lib/log', async () => (await import('@/__tests__/helpers/modules')).logModule());

const recordKey = `err:r1:${DIGEST_DAY}:${FP_A}`;

async function mailTextFor(message: string, asJson = false): Promise<string> {
  const record = { message, level: 'error' };
  store.set(recordKey, asJson ? JSON.stringify(record) : record);
  scan.mockResolvedValue(['0', [recordKey]]);
  const { GET } = await import('@/app/api/error-digest/route');
  await GET(
    new NextRequest('http://localhost/api/error-digest', {
      method: 'GET',
      headers: { authorization: `Bearer ${SECRET}` },
    }),
  );
  return (send.mock.calls[0] as unknown as [{ text: string }])[0].text;
}

describe('GET /api/error-digest mail text', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    store.clear();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(RUN_AT));
    vi.stubEnv('CRON_SECRET', SECRET);
    vi.stubEnv('RESEND_API_KEY', 're_test_key');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it('replaces a URL with its query string and token by a placeholder', async () => {
    const text = await mailTextFor(
      `Failed to fetch https://api.example.com/v1/items?token=${TOKEN}&u=1`,
    );
    expect(text).not.toContain(TOKEN);
    expect(text).not.toContain('api.example.com');
    expect(text).toContain('Failed to fetch <url>');
  });

  it('replaces http, uppercase and several URLs in one message', async () => {
    const text = await mailTextFor(
      `HTTP://a.example/x?k=${TOKEN} then http://b.example/y?k=${TOKEN} failed`,
    );
    expect(text).not.toContain(TOKEN);
    expect(text).not.toContain('example');
    expect(text.match(/<url>/g)).toHaveLength(2);
  });

  it('strips URLs from a record stored as a JSON string', async () => {
    const text = await mailTextFor(`bad ${`https://x.example/?t=${TOKEN}`}`, true);
    expect(text).not.toContain(TOKEN);
  });

  it('removes a URL before the message is cut to its length cap', async () => {
    const long = `${'w '.repeat(75)}https://x.example/?t=${TOKEN}`;
    const text = await mailTextFor(long);
    expect(text).not.toContain(TOKEN);
    expect(text).not.toContain('https');
  });

  it('keeps a message without a URL unchanged', async () => {
    const text = await mailTextFor('x is undefined at render');
    expect(text).toContain('x is undefined at render');
    expect(text).not.toContain('<url>');
  });
});
