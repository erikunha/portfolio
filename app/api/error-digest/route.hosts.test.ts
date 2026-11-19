import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const SECRET = 'cron-secret-for-tests';
const RUN_AT = '2026-11-18T05:00:00.000Z';
const DIGEST_DAY = '2026-11-17';
const FP_A = 'a'.repeat(16);
const TOKEN = 'query-token-must-not-leak';
const store = new Map<string, unknown>();
const send = vi.fn(
  async (): Promise<{ data: { id: string } | null; error: { message: string } | null }> => ({
    data: { id: 'mail-id' },
    error: null,
  }),
);

vi.mock('@/lib/redis', () => ({
  getRedis: () => ({
    sscan: async () => ['0', [`r1:${FP_A}`]],
    mget: async (...keys: string[]) => keys.map((key) => store.get(key) ?? null),
    pipeline: () => ({ set: vi.fn().mockReturnThis(), exec: vi.fn(async () => []) }),
  }),
}));
vi.mock('resend', async () => (await import('@/__tests__/helpers/modules')).resendModule(send));
vi.mock('@/lib/log', async () => (await import('@/__tests__/helpers/modules')).logModule());

async function mailTextFor(message: string): Promise<string> {
  store.set(`err:r1:${DIGEST_DAY}:${FP_A}`, { message, level: 'error' });
  const { GET } = await import('@/app/api/error-digest/route');
  await GET(
    new NextRequest('http://localhost/api/error-digest', {
      method: 'GET',
      headers: { authorization: `Bearer ${SECRET}` },
    }),
  );
  return (send.mock.calls[0] as unknown as [{ text: string }])[0].text;
}

describe('GET /api/error-digest mail text with bare domains', () => {
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

  it.each([
    ['a domain with a path', 'Failed to load evil.example/login now', 'evil.example'],
    ['a bare domain', 'Reported by evil.example today', 'evil.example'],
    ['a subdomain with a port, path and token', `Sent to api.evil.com:8443/v1?t=${TOKEN}`, TOKEN],
    ['an uppercase domain', 'Redirected to WWW.EVIL.ORG/Login', 'EVIL'],
    ['the site own domain', 'Posted to erikunha.dev/api/log', 'erikunha'],
    ['a domain that ends the sentence', 'Please visit evil.example.', 'evil'],
  ])('replaces %s with the placeholder', async (_name, message, leaked) => {
    const text = await mailTextFor(message);
    expect(text).not.toContain(leaked);
    expect(text).toContain('<url>');
  });

  it('replaces several domains in one message', async () => {
    const text = await mailTextFor('a.evil.example/x then b.evil.org/y');
    expect(text.match(/<url>/g)).toHaveLength(2);
    expect(text).not.toContain('evil');
  });

  it('removes a bare domain before the message is cut to its length cap', async () => {
    const text = await mailTextFor(`${'w '.repeat(75)}evil.example/login?t=${TOKEN}`);
    expect(text).not.toContain(TOKEN);
    expect(text).not.toContain('evil');
  });

  it.each([
    "Cannot read properties of undefined (reading 'x')",
    'Unexpected token < in app.js',
    'Failed at react-dom.development.js:1234:5',
    'Error in components/page.tsx',
    'Cannot find module ./styles.css',
    'this.props.items is undefined',
    'document.getElementById is not a function',
    'console.error is not a function',
    'Promise.all rejected after 5.5 seconds',
    'Unsupported version v1.2.3 of the runtime',
  ])('keeps ordinary text unchanged: %s', async (message) => {
    const text = await mailTextFor(message);
    expect(text).toContain(message);
    expect(text).not.toContain('<url>');
  });
});
