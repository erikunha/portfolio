import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const RELEASE = 'a1b2c3d4e5f6';
const DIGEST = '2918476530';
const OVERSIZED = 'x'.repeat(200);
const KEY_PARTS = 4;

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

  async function post(extra: Record<string, unknown>): Promise<Response> {
    const { POST } = await import('@/app/api/log/route');
    return POST(
      new NextRequest('http://localhost/api/log', {
        method: 'POST',
        body: JSON.stringify({ level: 'error', message: 'boom', ...extra }),
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  }

  function storedKey(): string {
    return String(redisSetMock.mock.calls[0]?.[0]);
  }

  function storedRecord(): Record<string, unknown> {
    return JSON.parse(String(redisSetMock.mock.calls[0]?.[1])) as Record<string, unknown>;
  }

  it('stores the release, language, motion, viewport and digest on the record', async () => {
    const res = await post({
      release: RELEASE,
      lang: 'pt-BR',
      motion: 'reduce',
      vw: 390,
      digest: DIGEST,
    });
    expect(res.status).toBe(200);
    expect(storedRecord()).toMatchObject({
      release: RELEASE,
      lang: 'pt-BR',
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
    ['lang', { lang: OVERSIZED }],
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
});
