import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { HandlerContext } from '@/lib/server/route';

const rateLimitMock = vi.fn(async () => ({ success: true }));
const hashIpMock = vi.fn(async () => 'hashed-ip-test');

vi.mock('@/lib/rate-limit', () => ({
  getClientIp: vi.fn(() => '127.0.0.1'),
}));

vi.mock('@/lib/ip-hash', () => ({
  hashIp: hashIpMock,
}));

vi.mock('@/lib/log', () => ({
  log: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/test', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

const TestSchema = z.object({
  name: z.string().min(1),
  count: z.number().int().positive(),
});

describe('lib/server/route — defineHandler', () => {
  beforeEach(() => {
    vi.resetModules();
    rateLimitMock.mockReset();
    rateLimitMock.mockImplementation(async () => ({ success: true }));
    hashIpMock.mockClear();
  });

  it('returns the success envelope with X-Request-Id when handler resolves', async () => {
    const { defineHandler, ok } = await import('@/lib/server/route');
    const POST = defineHandler({
      schema: TestSchema,
      rateLimit: () => ({ limit: rateLimitMock }),
      async handler({ body, requestId }) {
        return ok({ requestId, data: { echoed: body.name, count: body.count } });
      },
    });

    const res = await POST(makeRequest({ name: 'erik', count: 3 }));

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: true;
      requestId: string;
      data: { echoed: string; count: number };
    };
    expect(body.ok).toBe(true);
    expect(body.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(body.data).toEqual({ echoed: 'erik', count: 3 });
    expect(res.headers.get('x-request-id')).toBe(body.requestId);
  });

  it('returns 429 + error envelope when the rate limit denies', async () => {
    rateLimitMock.mockImplementationOnce(async () => ({ success: false }));
    const { defineHandler, ok } = await import('@/lib/server/route');
    const handlerSpy = vi.fn(async () => ok({ requestId: 'never' }));
    const POST = defineHandler({
      schema: TestSchema,
      rateLimit: () => ({ limit: rateLimitMock }),
      rateLimitErrorMessage: 'slow down',
      handler: handlerSpy,
    });

    const res = await POST(makeRequest({ name: 'erik', count: 1 }));

    expect(res.status).toBe(429);
    const body = (await res.json()) as {
      ok: false;
      requestId: string;
      error: { code: string; message: string };
    };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('rate_limited');
    expect(body.error.message).toBe('slow down');
    expect(res.headers.get('x-request-id')).toBe(body.requestId);
    expect(handlerSpy).not.toHaveBeenCalled();
    expect(hashIpMock).not.toHaveBeenCalled();
  });

  it('fails open on Redis outage (rate-limit factory throws)', async () => {
    const flakyLimiter = () => ({
      limit: vi.fn(async () => {
        throw new Error('Upstash unavailable');
      }),
    });
    const { defineHandler, ok } = await import('@/lib/server/route');
    const POST = defineHandler({
      schema: TestSchema,
      rateLimit: flakyLimiter,
      async handler({ requestId }) {
        return ok({ requestId, data: { reached: true } });
      },
    });

    const res = await POST(makeRequest({ name: 'erik', count: 1 }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: true; data: { reached: boolean } };
    expect(body.data.reached).toBe(true);
  });

  it('returns 400 invalid_json when the body is not parseable', async () => {
    const { defineHandler, ok } = await import('@/lib/server/route');
    const POST = defineHandler({
      schema: TestSchema,
      rateLimit: () => ({ limit: rateLimitMock }),
      async handler({ requestId }) {
        return ok({ requestId });
      },
    });

    const malformed = new NextRequest('http://localhost/api/test', {
      method: 'POST',
      body: '{this-is-not-json',
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(malformed);

    expect(res.status).toBe(400);
    const body = (await res.json()) as { ok: false; error: { code: string } };
    expect(body.error.code).toBe('invalid_json');
  });

  it('returns 400 validation_failed with zod issues when schema rejects', async () => {
    const { defineHandler, ok } = await import('@/lib/server/route');
    const POST = defineHandler({
      schema: TestSchema,
      rateLimit: () => ({ limit: rateLimitMock }),
      async handler({ requestId }) {
        return ok({ requestId });
      },
    });

    const res = await POST(makeRequest({ name: '', count: -1 }));

    expect(res.status).toBe(400);
    const body = (await res.json()) as {
      ok: false;
      error: { code: string; issues: unknown };
    };
    expect(body.error.code).toBe('validation_failed');
    expect(Array.isArray(body.error.issues)).toBe(true);
    expect((body.error.issues as unknown[]).length).toBeGreaterThan(0);
  });

  it('passes ipHash to handler context only after rate-limit + parse + validate pass', async () => {
    const { defineHandler } = await import('@/lib/server/route');
    type Body = z.infer<typeof TestSchema>;
    let captured: HandlerContext<Body> | undefined;
    const POST = defineHandler({
      schema: TestSchema,
      rateLimit: () => ({ limit: rateLimitMock }),
      async handler(ctx) {
        captured = ctx;
        return new Response(null, { status: 200 });
      },
    });

    await POST(makeRequest({ name: 'erik', count: 1 }));

    expect(captured).toBeDefined();
    expect(captured?.body).toEqual({ name: 'erik', count: 1 });
    expect(captured?.ipHash).toBe('hashed-ip-test');
    expect(captured?.ip).toBe('127.0.0.1');
    expect(captured?.requestId).toMatch(/^[0-9a-f]{8}-/);
  });
});

describe('lib/server/route — ok/err helpers', () => {
  it('ok() omits data when undefined', async () => {
    const { ok } = await import('@/lib/server/route');
    const res = ok({ requestId: 'rid-abc' });
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toEqual({ ok: true, requestId: 'rid-abc' });
    expect('data' in body).toBe(false);
  });

  it('ok() includes data when provided', async () => {
    const { ok } = await import('@/lib/server/route');
    const res = ok({ requestId: 'rid-abc', data: { count: 5 } });
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toEqual({ ok: true, requestId: 'rid-abc', data: { count: 5 } });
  });

  it('err() shapes the envelope and sets X-Request-Id', async () => {
    const { err } = await import('@/lib/server/route');
    const res = err({
      requestId: 'rid-xyz',
      status: 403,
      code: 'forbidden',
      message: 'no',
    });
    expect(res.status).toBe(403);
    expect(res.headers.get('x-request-id')).toBe('rid-xyz');
    const body = (await res.json()) as {
      ok: false;
      requestId: string;
      error: { code: string; message: string };
    };
    expect(body).toEqual({
      ok: false,
      requestId: 'rid-xyz',
      error: { code: 'forbidden', message: 'no' },
    });
  });

  it('err() supports extra headers (e.g. Retry-After)', async () => {
    const { err } = await import('@/lib/server/route');
    const res = err({
      requestId: 'rid',
      status: 429,
      code: 'rate_limited',
      message: 'wait',
      extraHeaders: { 'Retry-After': '60' },
    });
    expect(res.headers.get('Retry-After')).toBe('60');
    expect(res.headers.get('x-request-id')).toBe('rid');
  });
});
