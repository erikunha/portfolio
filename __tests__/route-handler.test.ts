import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { HandlerContext } from '@/lib/server/route';

const TEST_BODY_LIMIT = 4096;

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

describe('lib/server/route: defineHandler', () => {
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
      maxBodyBytes: TEST_BODY_LIMIT,
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
      maxBodyBytes: TEST_BODY_LIMIT,
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
    expect(rateLimitMock, 'the limiter is keyed by the salted hash').toHaveBeenCalledWith(
      'hashed-ip-test',
    );
  });

  it('tells the client how long to wait: Retry-After in whole seconds from the limiter reset', async () => {
    const nowMs = 1_700_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(nowMs);
    rateLimitMock.mockImplementationOnce(
      async () => ({ success: false, reset: nowMs + 90_500 }) as { success: boolean },
    );
    const { defineHandler, ok } = await import('@/lib/server/route');
    const POST = defineHandler({
      schema: TestSchema,
      maxBodyBytes: TEST_BODY_LIMIT,
      rateLimit: () => ({ limit: rateLimitMock }),
      handler: async ({ requestId }) => ok({ requestId }),
    });

    const res = await POST(makeRequest({ name: 'erik', count: 1 }));

    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBe('91');
    vi.restoreAllMocks();
  });

  it('omits Retry-After when the limiter gives no usable reset', async () => {
    rateLimitMock.mockImplementationOnce(async () => ({ success: false }));
    const { defineHandler, ok } = await import('@/lib/server/route');
    const POST = defineHandler({
      schema: TestSchema,
      maxBodyBytes: TEST_BODY_LIMIT,
      rateLimit: () => ({ limit: rateLimitMock }),
      handler: async ({ requestId }) => ok({ requestId }),
    });

    const res = await POST(makeRequest({ name: 'erik', count: 1 }));

    expect(res.status).toBe(429);
    expect(res.headers.has('retry-after')).toBe(false);
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
      maxBodyBytes: TEST_BODY_LIMIT,
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
      maxBodyBytes: TEST_BODY_LIMIT,
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
      maxBodyBytes: TEST_BODY_LIMIT,
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
      maxBodyBytes: TEST_BODY_LIMIT,
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
    expect(captured, 'the raw client address must never reach a handler').not.toHaveProperty('ip');
    expect(captured?.requestId).toMatch(/^[0-9a-f]{8}-/);
  });
});

describe('lib/server/route: ok/err helpers', () => {
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

describe('lib/server/route: cross-site requests', () => {
  beforeEach(() => {
    vi.resetModules();
    rateLimitMock.mockReset();
    rateLimitMock.mockImplementation(async () => ({ success: true }));
  });

  const post = (fetchSite?: string) =>
    new NextRequest('http://localhost/api/test', {
      method: 'POST',
      body: JSON.stringify({ name: 'erik', count: 1 }),
      headers: {
        'Content-Type': 'text/plain',
        ...(fetchSite === undefined ? {} : { 'Sec-Fetch-Site': fetchSite }),
      },
    });

  async function build() {
    const { defineHandler, ok } = await import('@/lib/server/route');
    const handlerSpy = vi.fn(async ({ requestId }: { requestId: string }) => ok({ requestId }));
    const POST = defineHandler({
      schema: TestSchema,
      maxBodyBytes: TEST_BODY_LIMIT,
      rateLimit: () => ({ limit: rateLimitMock }),
      handler: handlerSpy,
    });
    return { POST, handlerSpy };
  }

  it.each(['cross-site', 'same-site'])(
    'rejects a browser request whose Sec-Fetch-Site is %s before it spends the visitor rate limit',
    async (site) => {
      const { POST, handlerSpy } = await build();
      const res = await POST(post(site));
      expect(res.status).toBe(403);
      const body = (await res.json()) as { ok: false; error: { code: string } };
      expect(body.error.code).toBe('forbidden_origin');
      expect(res.headers.get('x-request-id')).toBeTruthy();
      expect(rateLimitMock).not.toHaveBeenCalled();
      expect(handlerSpy).not.toHaveBeenCalled();
    },
  );

  it.each(['same-origin', 'none', undefined])(
    'lets Sec-Fetch-Site %s through (own pages, address bar, non-browser clients)',
    async (site) => {
      const { POST, handlerSpy } = await build();
      const res = await POST(post(site));
      expect(res.status).toBe(200);
      expect(handlerSpy).toHaveBeenCalledOnce();
    },
  );
});

describe('lib/server/route: ip hash outage', () => {
  beforeEach(() => {
    vi.resetModules();
    hashIpMock.mockReset();
    rateLimitMock.mockReset();
    rateLimitMock.mockImplementation(async () => ({ success: true }));
  });

  it('answers 503 storage_unavailable in the envelope when the salt cannot be resolved', async () => {
    hashIpMock.mockRejectedValueOnce(new Error('redis down'));
    const { defineHandler, ok } = await import('@/lib/server/route');
    const handlerSpy = vi.fn(async () => ok({ requestId: 'never' }));
    const POST = defineHandler({
      schema: TestSchema,
      maxBodyBytes: TEST_BODY_LIMIT,
      rateLimit: () => ({ limit: rateLimitMock }),
      handler: handlerSpy,
    });

    const res = await POST(makeRequest({ name: 'erik', count: 1 }));

    expect(res.status).toBe(503);
    const body = (await res.json()) as { ok: false; requestId: string; error: { code: string } };
    expect(body.error.code).toBe('storage_unavailable');
    expect(res.headers.get('x-request-id')).toBe(body.requestId);
    expect(handlerSpy).not.toHaveBeenCalled();
  });
});
