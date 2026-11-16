import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const RELEASE = 'a1b2c3d4e5f6';
const DIGEST = '2918476530';
const OVERSIZED = 'x'.repeat(200);
const KEY_PARTS = 4;
const MAX_USER_AGENT_CHARS = 500;

describe('/api/log release context', () => {
  const redisSetMock = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    redisSetMock.mockReset();
    redisSetMock.mockResolvedValue('OK');
    vi.doMock('@/lib/redis', () => ({ getRedis: vi.fn(() => ({ set: redisSetMock })) }));
    vi.doMock('@/lib/server/client-ip', () => ({ getClientIp: vi.fn(() => '127.0.0.1') }));
    vi.doMock('@/lib/rate-limit', () => ({
      getErrorLogLimit: vi.fn(() => ({ limit: vi.fn(async () => ({ success: true })) })),
      getErrorLogDailyLimit: vi.fn(() => ({ limit: vi.fn(async () => ({ success: true })) })),
      getErrorLogIpDailyLimit: vi.fn(() => ({ limit: vi.fn(async () => ({ success: true })) })),
    }));
    vi.doMock('@/lib/ip-hash', () => ({ hashIp: vi.fn(async () => 'hashed-ip-test') }));
    vi.doMock('@/lib/log', () => ({
      log: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    }));
  });

  afterEach(() => {
    vi.doUnmock('@/lib/rate-limit');
    vi.doUnmock('@/lib/server/client-ip');
    vi.doUnmock('@/lib/redis');
    vi.doUnmock('@/lib/ip-hash');
    vi.doUnmock('@/lib/log');
  });

  async function post(
    extra: Record<string, unknown>,
    headers: Record<string, string> = {},
  ): Promise<Response> {
    const { POST } = await import('@/app/api/log/route');
    return POST(
      new NextRequest('http://localhost/api/log', {
        method: 'POST',
        body: JSON.stringify({ level: 'error', message: 'boom', ...extra }),
        headers: { 'Content-Type': 'application/json', ...headers },
      }),
    );
  }

  function storedKey(): string {
    return String(redisSetMock.mock.calls[0]?.[0]);
  }

  function storedRecord(): Record<string, unknown> {
    return JSON.parse(String(redisSetMock.mock.calls[0]?.[1])) as Record<string, unknown>;
  }

  it('stores the release, motion, viewport and digest on the record', async () => {
    const res = await post({
      release: RELEASE,
      motion: 'reduce',
      vw: 390,
      digest: DIGEST,
    });
    expect(res.status).toBe(200);
    expect(storedRecord()).toMatchObject({
      release: RELEASE,
      motion: 'reduce',
      vw: 390,
      digest: DIGEST,
    });
  });

  it('keys the record by release so one deploy can be listed with SCAN err:<release>:*', async () => {
    await post({ release: RELEASE });
    const parts = storedKey().split(':');
    expect(parts).toHaveLength(KEY_PARTS);
    expect(parts[0]).toBe('err');
    expect(parts[1]).toBe(RELEASE);
  });

  it('files a report with no release under one fixed segment, keeping the key shape', async () => {
    await post({});
    const parts = storedKey().split(':');
    expect(parts).toHaveLength(KEY_PARTS);
    expect(parts[1]).toBe('unknown');
  });

  it('refuses a release that could add key segments or scan patterns', async () => {
    for (const release of ['a:b', 'a*', 'a b', 'a[0-9]', '']) {
      const res = await post({ release });
      expect(res.status, release).toBe(400);
    }
    expect(redisSetMock).not.toHaveBeenCalled();
  });

  it.each([
    ['release', { release: OVERSIZED }],
    ['motion', { motion: OVERSIZED }],
    ['digest', { digest: OVERSIZED }],
  ])('refuses an oversized %s', async (_name, extra) => {
    const res = await post(extra);
    expect(res.status).toBe(400);
    expect(redisSetMock).not.toHaveBeenCalled();
  });

  it.each([
    ['negative', -1],
    ['fractional', 390.5],
    ['absurd', 1_000_000],
    ['not a number', '390'],
  ])('refuses a %s viewport width', async (_name, vw) => {
    const res = await post({ vw });
    expect(res.status).toBe(400);
    expect(redisSetMock).not.toHaveBeenCalled();
  });

  it.each([
    ['https://erikunha.dev/pt/cv', 'pt-BR'],
    ['https://erikunha.dev/pt', 'pt-BR'],
    ['https://erikunha.dev/links/en', 'en-US'],
    ['https://erikunha.dev/', 'en-US'],
  ])('derives the language of %s from its path: %s', async (url, lang) => {
    await post({ url });
    expect(storedRecord()).toMatchObject({ lang });
  });

  it.each([
    ['a missing url', {}],
    ['an empty url', { url: '' }],
    ['an unparsable url', { url: 'not a url' }],
  ])('records no language for %s', async (_name, extra) => {
    const res = await post(extra);
    expect(res.status).toBe(200);
    expect('lang' in storedRecord()).toBe(false);
  });

  it('ignores a language the client sends, since the path decides it', async () => {
    await post({ url: 'https://erikunha.dev/pt', lang: 'xx' });
    expect(storedRecord()).toMatchObject({ lang: 'pt-BR' });
  });

  it('takes the user agent from the request header', async () => {
    await post({}, { 'User-Agent': 'jsdom-test-agent' });
    expect(storedRecord()).toMatchObject({ userAgent: 'jsdom-test-agent' });
  });

  it('cuts the user agent to 500 characters', async () => {
    await post({}, { 'User-Agent': 'u'.repeat(900) });
    expect(String(storedRecord().userAgent)).toHaveLength(MAX_USER_AGENT_CHARS);
  });

  it('ignores a user agent the client sends in the body', async () => {
    await post({ userAgent: 'spoofed' }, { 'User-Agent': 'real-agent' });
    expect(storedRecord()).toMatchObject({ userAgent: 'real-agent' });
  });

  it('records no user agent when the request has none', async () => {
    await post({ userAgent: 'spoofed' }, { 'User-Agent': '' });
    expect('userAgent' in storedRecord()).toBe(false);
  });
});
