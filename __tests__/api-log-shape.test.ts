import { NextRequest } from 'next/server';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

describe('/api/log endpoint', () => {
  const redisSetMock = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    redisSetMock.mockReset();
    vi.doMock('@/lib/rate-limit', () => ({
      getClientIp: vi.fn(() => '127.0.0.1'),
      getErrorLogLimit: vi.fn(() => ({ limit: vi.fn(async () => ({ success: true })) })),
      getRedis: vi.fn(() => ({ set: redisSetMock })),
    }));
    vi.doMock('@/lib/ip-hash', () => ({ hashIp: vi.fn(async () => 'hashed-ip-test') }));
    vi.doMock('@/lib/log', () => ({
      log: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    }));
  });

  afterEach(() => {
    vi.doUnmock('@/lib/rate-limit');
    vi.doUnmock('@/lib/ip-hash');
    vi.doUnmock('@/lib/log');
  });

  function makeRequest(body: Record<string, unknown>): NextRequest {
    return new NextRequest('http://localhost/api/log', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });
  }

  it('persists a valid error to KV with the err: prefix and a 30-day TTL', async () => {
    redisSetMock.mockResolvedValueOnce('OK');
    const { POST } = await import('@/app/api/log/route');
    const res = await POST(makeRequest({ level: 'error', message: 'boom in the browser' }));

    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; requestId: string };
    expect(body.ok).toBe(true);
    expect(body.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.headers.get('x-request-id')).toBe(body.requestId);

    expect(redisSetMock).toHaveBeenCalledOnce();
    const [key, , opts] = redisSetMock.mock.calls[0] ?? [];
    expect(String(key)).toMatch(/^err:/);
    expect(opts).toEqual({ ex: 2_592_000 });
  });

  it('stores no ipHash in the err: record (personal-data-free design)', async () => {
    redisSetMock.mockResolvedValueOnce('OK');
    const { POST } = await import('@/app/api/log/route');
    await POST(makeRequest({ level: 'error', message: 'boom' }));

    const [, value] = redisSetMock.mock.calls[0] ?? [];
    const record = JSON.parse(String(value)) as Record<string, unknown>;
    expect('ipHash' in record).toBe(false);
    expect(record.message).toBe('boom');
  });

  it('skips KV persistence for [smoke]-prefixed messages', async () => {
    const { POST } = await import('@/app/api/log/route');
    const res = await POST(makeRequest({ level: 'error', message: '[smoke] CI probe' }));
    expect(res.status).toBe(200);
    expect(redisSetMock).not.toHaveBeenCalled();
  });

  it('rejects a malformed payload with a 400 validation error', async () => {
    const { POST } = await import('@/app/api/log/route');
    const res = await POST(makeRequest({ level: 'debug', message: 'x' }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { ok: false; error: { code: string } };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('validation_failed');
  });

  it('returns storage_unavailable (503) when the KV write throws', async () => {
    redisSetMock.mockRejectedValueOnce(new Error('Upstash down'));
    const { POST } = await import('@/app/api/log/route');
    const res = await POST(makeRequest({ level: 'error', message: 'boom' }));
    expect(res.status).toBe(503);
    const body = (await res.json()) as { ok: false; error: { code: string } };
    expect(body.error.code).toBe('storage_unavailable');
  });
});

describe('lib/ip-hash', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('hashIp returns a stable 16-char hex digest, distinct per IP', async () => {
    const { hashIp } = await import('@/lib/ip-hash');
    const a1 = await hashIp('203.0.113.7');
    const a2 = await hashIp('203.0.113.7');
    const b = await hashIp('198.51.100.1');

    expect(a1).toBe(a2);
    expect(a1).toMatch(/^[0-9a-f]{16}$/);
    expect(a1).not.toBe(b);
  });
});

describe('client error bridge', () => {
  let bridge: typeof import('@/lib/error-bridge.client');

  beforeAll(async () => {
    bridge = await import('@/lib/error-bridge.client');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('POSTs a structured payload to /api/log on an unhandled window error', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    window.dispatchEvent(
      new ErrorEvent('error', { message: 'kaboom-unique', error: new Error('kaboom-unique') }),
    );

    expect(fetchMock).toHaveBeenCalledWith('/api/log', expect.objectContaining({ method: 'POST' }));
    const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const init = call[1];
    const payload = JSON.parse(String(init.body)) as { level: string; message: string };
    expect(payload.level).toBe('error');
    expect(payload.message).toBe('kaboom-unique');
  });

  it('dedupes a replayed identical error inside the 100ms tail window', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const err = new Error('replayed-unique');
    window.dispatchEvent(new ErrorEvent('error', { message: 'replayed-unique', error: err }));
    window.dispatchEvent(new ErrorEvent('error', { message: 'replayed-unique', error: err }));
    window.dispatchEvent(new ErrorEvent('error', { message: 'replayed-unique', error: err }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('exposes a MAX_DEDUP_SIZE cap to bound the dedup Map', () => {
    expect(typeof bridge.MAX_DEDUP_SIZE).toBe('number');
    expect(bridge.MAX_DEDUP_SIZE).toBeGreaterThan(0);
  });
});
