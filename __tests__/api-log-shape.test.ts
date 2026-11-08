import { NextRequest } from 'next/server';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

describe('/api/log endpoint', () => {
  const redisSetMock = vi.fn();
  const dailyLimitMock = vi.fn();
  const ipDailyLimitMock = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    redisSetMock.mockReset();
    dailyLimitMock.mockReset();
    dailyLimitMock.mockResolvedValue({ success: true });
    ipDailyLimitMock.mockReset();
    ipDailyLimitMock.mockResolvedValue({ success: true });
    vi.doMock('@/lib/rate-limit', () => ({
      getClientIp: vi.fn(() => '127.0.0.1'),
      getErrorLogLimit: vi.fn(() => ({ limit: vi.fn(async () => ({ success: true })) })),
      getErrorLogDailyLimit: vi.fn(() => ({ limit: dailyLimitMock })),
      getErrorLogIpDailyLimit: vi.fn(() => ({ limit: ipDailyLimitMock })),
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

  it('persists a valid error to KV with the err: prefix and a 7-day TTL', async () => {
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
    expect(opts).toEqual({ ex: 604_800 });
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

  it('stops writing records once the daily cap is spent, still answering ok so a flood cannot fill the store', async () => {
    dailyLimitMock.mockResolvedValueOnce({ success: false });
    const { POST } = await import('@/app/api/log/route');
    const res = await POST(makeRequest({ level: 'error', message: 'flood' }));
    expect(res.status).toBe(200);
    expect(redisSetMock).not.toHaveBeenCalled();
  });

  it('stops one IP from spending the shared daily cap, still answering ok', async () => {
    ipDailyLimitMock.mockResolvedValueOnce({ success: false });
    const { POST } = await import('@/app/api/log/route');
    const res = await POST(makeRequest({ level: 'error', message: 'one ip flood' }));
    expect(res.status).toBe(200);
    expect(redisSetMock).not.toHaveBeenCalled();
    expect(
      dailyLimitMock,
      'a record dropped for one IP must not consume the shared daily budget',
    ).not.toHaveBeenCalled();
  });

  it('keys the per-IP daily cap on the salted ip hash, never the raw address', async () => {
    redisSetMock.mockResolvedValueOnce('OK');
    const { POST } = await import('@/app/api/log/route');
    await POST(makeRequest({ level: 'error', message: 'who' }));
    expect(ipDailyLimitMock).toHaveBeenCalledWith('hashed-ip-test');
  });

  it('stores at most 4 KB of a stack trace', async () => {
    redisSetMock.mockResolvedValueOnce('OK');
    const { POST } = await import('@/app/api/log/route');
    await POST(makeRequest({ level: 'error', message: 'deep', stack: 's'.repeat(16000) }));
    const [, value] = redisSetMock.mock.calls[0] ?? [];
    const record = JSON.parse(String(value)) as { stack: string };
    expect(record.stack).toHaveLength(4096);
  });

  it('keeps recording when the daily cap check itself fails', async () => {
    dailyLimitMock.mockRejectedValueOnce(new Error('Upstash down'));
    redisSetMock.mockResolvedValueOnce('OK');
    const { POST } = await import('@/app/api/log/route');
    const res = await POST(makeRequest({ level: 'error', message: 'still wanted' }));
    expect(res.status).toBe(200);
    expect(redisSetMock).toHaveBeenCalledOnce();
  });

  it('rejects a ts longer than an ISO timestamp so the field cannot carry payload', async () => {
    const { POST } = await import('@/app/api/log/route');
    const res = await POST(makeRequest({ level: 'error', message: 'x', ts: 't'.repeat(200) }));
    expect(res.status).toBe(400);
    expect(redisSetMock).not.toHaveBeenCalled();
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
