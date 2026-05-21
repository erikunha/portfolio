// __tests__/api-log-shape.test.ts
// Behavioral test (CG3): exercises the /api/log endpoint, lib/ip-hash, and the
// client error bridge end-to-end, instead of grepping their source text.
//
//  - /api/log endpoint: POST a structured error, assert the KV write uses the
//    `err:` key prefix + 30-day TTL, the success envelope, the smoke-prefix
//    bypass, the personal-data-free record (no ipHash), and the
//    storage-unavailable error path.
//  - lib/ip-hash: hashIp produces a stable 16-char SHA-256-derived hex digest.
//  - lib/error-bridge.client: an unhandled window error POSTs a structured
//    payload to /api/log, and the dedup window suppresses replayed errors.

import { NextRequest } from 'next/server';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// --- /api/log endpoint -------------------------------------------------------
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
    expect(opts).toEqual({ ex: 2_592_000 }); // 30 days
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
    // `level` must be 'error' | 'warn'; 'debug' is invalid.
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

// --- lib/ip-hash -------------------------------------------------------------
describe('lib/ip-hash', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('hashIp returns a stable 16-char hex digest, distinct per IP', async () => {
    const { hashIp } = await import('@/lib/ip-hash');
    const a1 = await hashIp('203.0.113.7');
    const a2 = await hashIp('203.0.113.7');
    const b = await hashIp('198.51.100.1');

    // Deterministic — same IP hashes identically (rate-limit accounting relies
    // on this), and the digest is the documented 16-hex-char SHA-256 slice.
    expect(a1).toBe(a2);
    expect(a1).toMatch(/^[0-9a-f]{16}$/);
    // Different IPs map to different hashes.
    expect(a1).not.toBe(b);
  });
});

// --- lib/error-bridge.client -------------------------------------------------
// The bridge registers window listeners as a module side effect with no
// teardown hook. Import it exactly ONCE for this block (no resetModules) so
// only a single listener set is attached; each test uses a unique error
// message so the per-module dedup Map never cross-contaminates tests.
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

    // React's error replay fires the same error 2-3x in <50ms — only the
    // first should be POSTed.
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
