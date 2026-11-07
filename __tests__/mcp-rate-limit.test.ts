// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

const limit = vi.hoisted(() => vi.fn());

vi.mock('@/lib/rate-limit', () => ({
  getClientIp: vi.fn((req: Request) => req.headers.get('x-forwarded-for') ?? 'unknown'),
  getMcpLimit: vi.fn(() => ({ limit })),
}));
vi.mock('@/app/api/ask/route', () => ({
  POST: vi.fn(async () => new Response('answer')),
}));
vi.mock('@/lib/log', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const GET_PROFILE_CALL = JSON.stringify({
  jsonrpc: '2.0',
  id: 1,
  method: 'tools/call',
  params: { name: 'get_profile', arguments: {} },
});

function call(): Request {
  return new Request('https://www.erikunha.dev/api/mcp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      'x-forwarded-for': '203.0.113.9',
    },
    body: GET_PROFILE_CALL,
  });
}

describe('/api/mcp rate limit', () => {
  beforeEach(() => {
    limit.mockReset();
  });

  it('limits get_profile, which never reaches the ask limiter', async () => {
    limit.mockResolvedValue({ success: false, reset: Date.now() + 30_000 });
    const { POST } = await import('@/app/api/mcp/route');
    const res = await POST(call());

    expect(res.status).toBe(429);
    expect(Number(res.headers.get('Retry-After'))).toBeGreaterThan(0);
    expect(await res.json()).toMatchObject({ ok: false, error: { code: 'rate_limited' } });
    expect(limit).toHaveBeenCalledWith('203.0.113.9');
  });

  it('serves the tool while the caller is under the limit', async () => {
    limit.mockResolvedValue({ success: true });
    const { POST } = await import('@/app/api/mcp/route');
    const res = await POST(call());

    expect(res.status).toBe(200);
    expect(await res.text()).toContain('erikunha');
  });

  it('fails open when the limiter is unavailable', async () => {
    limit.mockRejectedValue(new Error('redis down'));
    const { POST } = await import('@/app/api/mcp/route');
    const res = await POST(call());

    expect(res.status).toBe(200);
  });
});
