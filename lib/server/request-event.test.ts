// @vitest-environment node

import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { withRateLimit } from '@/lib/server/rate-limit-guard';
import { defineHandler, ok } from '@/lib/server/route';

const logInfo = vi.hoisted(() => vi.fn());
const limit = vi.hoisted(() => vi.fn());

vi.mock('@/lib/log', async () =>
  (await import('@/__tests__/helpers/modules')).logModule({ info: logInfo }),
);
vi.mock('@/lib/server/client-ip', () => ({ getClientIp: vi.fn(() => '203.0.113.77') }));
vi.mock('@/lib/ip-hash', () => ({ hashIp: vi.fn(async () => 'hashed-ip-test') }));

const REQUEST_EVENT_MESSAGE = 'api request';
const BODY_LIMIT = 4096;
const SLOW_HANDLER_MS = 250;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EVENT_KEYS = ['durationMs', 'outcome', 'rateLimited', 'requestId', 'route', 'status'];

const Schema = z.object({ name: z.string().min(1) });

interface RequestEvent {
  route: string;
  status: number;
  durationMs: number;
  outcome: string;
  requestId: string;
  rateLimited: boolean;
}

function events(): RequestEvent[] {
  return logInfo.mock.calls
    .filter(([message]) => message === REQUEST_EVENT_MESSAGE)
    .map(([, ctx]) => ctx as RequestEvent);
}

function post(body: unknown, init: { url?: string; headers?: Record<string, string> } = {}) {
  return new NextRequest(init.url ?? 'http://localhost/api/test', {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', ...init.headers },
  });
}

function build(
  handler: (ctx: { requestId: string }) => Promise<Response> = async ({ requestId }) =>
    ok({ requestId }),
) {
  return defineHandler({
    schema: Schema,
    maxBodyBytes: BODY_LIMIT,
    rateLimit: () => ({ limit }),
    handler,
  });
}

describe('request event: defineHandler', () => {
  beforeEach(() => {
    logInfo.mockClear();
    limit.mockReset();
    limit.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('emits one ok event carrying route, status, duration and the response request id', async () => {
    const POST = build();

    const res = await POST(post({ name: 'erik' }));

    expect(res.status).toBe(200);
    const [event, ...rest] = events();
    expect(rest).toEqual([]);
    expect(event).toMatchObject({
      route: '/api/test',
      status: 200,
      outcome: 'ok',
      rateLimited: false,
      requestId: res.headers.get('x-request-id'),
    });
    expect(event?.requestId).toMatch(UUID_PATTERN);
    expect(event?.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('measures the duration of the whole request in milliseconds', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'performance'] });
    const POST = build(async ({ requestId }) => {
      vi.advanceTimersByTime(SLOW_HANDLER_MS);
      return ok({ requestId });
    });

    await POST(post({ name: 'erik' }));

    expect(events()[0]?.durationMs).toBe(SLOW_HANDLER_MS);
  });

  it('classifies a validation failure as one client error event', async () => {
    const POST = build();

    const res = await POST(post({ name: '' }));

    expect(res.status).toBe(400);
    expect(events()).toEqual([
      expect.objectContaining({
        status: 400,
        outcome: 'client_error',
        rateLimited: false,
        requestId: res.headers.get('x-request-id'),
      }),
    ]);
  });

  it('classifies a cross-site refusal, decided before any body read, as one client error event', async () => {
    const POST = build();

    const res = await POST(post({ name: 'erik' }, { headers: { 'sec-fetch-site': 'cross-site' } }));

    expect(res.status).toBe(403);
    expect(events()).toEqual([expect.objectContaining({ status: 403, outcome: 'client_error' })]);
  });

  it('classifies a handler that returns a 5xx as one server error event', async () => {
    const POST = build(async () => new Response('down', { status: 503 }));

    await POST(post({ name: 'erik' }));

    expect(events()).toEqual([expect.objectContaining({ status: 503, outcome: 'server_error' })]);
  });

  it('emits one server error event and still rejects when the handler throws', async () => {
    const POST = build(async () => {
      throw new Error('boom');
    });

    await expect(POST(post({ name: 'erik' }))).rejects.toThrow('boom');

    const [event, ...rest] = events();
    expect(rest).toEqual([]);
    expect(event).toMatchObject({ status: 500, outcome: 'server_error', rateLimited: false });
    expect(event?.requestId).toMatch(UUID_PATTERN);
  });

  it('flags a rate limited request and reports the id the 429 body carries', async () => {
    limit.mockResolvedValue({ success: false });
    const handler = vi.fn(async () => ok({ requestId: 'unused' }));
    const POST = build(handler);

    const res = await POST(post({ name: 'erik' }));

    expect(res.status).toBe(429);
    expect(handler).not.toHaveBeenCalled();
    expect(events()).toEqual([
      expect.objectContaining({
        status: 429,
        outcome: 'rate_limited',
        rateLimited: true,
        requestId: res.headers.get('x-request-id'),
      }),
    ]);
  });

  it('does not flag a request served while the limiter is unavailable', async () => {
    limit.mockRejectedValue(new Error('redis down'));
    const POST = build();

    const res = await POST(post({ name: 'erik' }));

    expect(res.status).toBe(200);
    expect(events()).toEqual([expect.objectContaining({ outcome: 'ok', rateLimited: false })]);
  });

  it('serves the response when the logger itself throws', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    logInfo.mockImplementationOnce(() => {
      throw new Error('logger down');
    });
    const POST = build();

    const res = await POST(post({ name: 'erik' }));

    expect(res.status).toBe(200);
    expect(consoleError).toHaveBeenCalledTimes(1);
    consoleError.mockRestore();
  });

  it('keeps the query string, body and client address out of the event', async () => {
    const POST = build();

    await POST(
      post(
        { name: 'private-name-value' },
        {
          url: 'http://localhost/api/test?token=query-secret',
          headers: { 'x-forwarded-for': '198.51.100.9' },
        },
      ),
    );

    const [event] = events();
    expect(Object.keys(event ?? {}).sort()).toEqual(EVENT_KEYS);
    expect(event?.route).toBe('/api/test');
    const serialised = JSON.stringify(event);
    for (const leaked of ['query-secret', 'private-name-value', '198.51.100.9', '203.0.113.77']) {
      expect(serialised).not.toContain(leaked);
    }
    expect(serialised).not.toContain('hashed-ip-test');
  });
});

describe('request event: withRateLimit', () => {
  const MCP_URL = 'https://www.erikunha.dev/api/mcp?session=query-secret';

  beforeEach(() => {
    logInfo.mockClear();
    limit.mockReset();
  });

  function guarded(handler: (req: Request) => Promise<Response>) {
    return withRateLimit(handler, () => ({ limit }), 'too many requests');
  }

  it('emits one rate limited event, and runs no handler, when the limiter denies', async () => {
    limit.mockResolvedValue({ success: false });
    const handler = vi.fn(async () => new Response('served'));

    const res = await guarded(handler)(new Request(MCP_URL, { method: 'POST' }));

    expect(res.status).toBe(429);
    expect(handler).not.toHaveBeenCalled();
    expect(events()).toEqual([
      expect.objectContaining({
        route: '/api/mcp',
        status: 429,
        outcome: 'rate_limited',
        rateLimited: true,
        requestId: res.headers.get('x-request-id'),
      }),
    ]);
  });

  it('emits one event with the handler status when the request passes', async () => {
    limit.mockResolvedValue({ success: true });

    await guarded(async () => new Response('served', { status: 201 }))(new Request(MCP_URL));

    expect(events()).toEqual([
      expect.objectContaining({
        route: '/api/mcp',
        status: 201,
        outcome: 'ok',
        rateLimited: false,
      }),
    ]);
    expect(JSON.stringify(events())).not.toContain('query-secret');
  });

  it('emits one event with the handler status when the limiter is unavailable', async () => {
    limit.mockRejectedValue(new Error('redis down'));

    await guarded(async () => new Response('bad', { status: 400 }))(new Request(MCP_URL));

    expect(events()).toEqual([
      expect.objectContaining({ status: 400, outcome: 'client_error', rateLimited: false }),
    ]);
  });

  it('emits one server error event and still rejects when the handler throws', async () => {
    limit.mockResolvedValue({ success: true });

    await expect(
      guarded(async () => {
        throw new Error('boom');
      })(new Request(MCP_URL)),
    ).rejects.toThrow('boom');

    expect(events()).toEqual([
      expect.objectContaining({ status: 500, outcome: 'server_error', rateLimited: false }),
    ]);
  });
});
