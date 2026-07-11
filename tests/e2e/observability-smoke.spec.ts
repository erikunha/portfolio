import { expect, test } from '@playwright/test';

const SYNTHETIC_REQUEST_ID = '00000000-0000-4000-8000-000000000000';

test.describe('observability smoke', () => {
  test('/api/log accepts a structured error payload (unified envelope)', async ({ request }) => {
    const res = await request.post('/api/log', {
      data: {
        level: 'error',
        message: '[smoke] synthetic test error',
        stack: 'Error: smoke\n  at test',
        url: 'http://localhost:3000/smoke',
        userAgent: 'playwright/smoke',
        ts: new Date().toISOString(),
      },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true });
    expect(typeof body.requestId).toBe('string');
    expect(res.headers()['x-request-id']).toBeTruthy();
  });

  test('/api/log rejects an invalid payload with 400 + validation_failed', async ({ request }) => {
    const res = await request.post('/api/log', {
      data: { not_a_valid_field: 'oops' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body).toMatchObject({ ok: false, error: { code: 'validation_failed' } });
  });

  test('/api/log/forget accepts a UUID requestId and returns unified envelope', async ({
    request,
  }) => {
    const res = await request.post('/api/log/forget', {
      data: { requestId: SYNTHETIC_REQUEST_ID },
    });
    const status = res.status();
    if (status === 429) {
      if (process.env.CI) throw new Error('Rate-limit hit in CI — check window configuration');
      return;
    }
    expect(status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true });
    expect(typeof body.requestId).toBe('string');
    expect(body.deleted).toBeUndefined();
  });

  test('/api/log/forget rejects non-UUID requestId with 400 + validation_failed', async ({
    request,
  }) => {
    const res = await request.post('/api/log/forget', {
      data: { requestId: 'not-a-uuid' },
    });
    const status = res.status();
    if (status === 429) {
      if (process.env.CI) throw new Error('Rate-limit hit in CI — check window configuration');
      return;
    }
    expect(status).toBe(400);
    const body = await res.json();
    expect(body).toMatchObject({ ok: false, error: { code: 'validation_failed' } });
  });

  test('GET /api/healthz is reachable and returns valid JSON shape', async ({ request }) => {
    const res = await request.get('/api/healthz');
    expect([200, 503]).toContain(res.status());
    const body = (await res.json()) as { status: string; sha: string; psiLastRun: string | null };
    expect(['ok', 'degraded']).toContain(body.status);
    expect(typeof body.sha).toBe('string');
    expect(body.sha.length).toBeGreaterThan(0);
    expect(body.psiLastRun === null || typeof body.psiLastRun === 'string').toBe(true);
  });

  test('GET /.well-known/agent.json returns a valid capability manifest', async ({ request }) => {
    const res = await request.get('/.well-known/agent.json');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toMatch(/application\/json/);
    const body = (await res.json()) as {
      mcp?: { transport?: string; url?: string; tools?: string[] };
      endpoints?: Array<{ url?: string }>;
    };
    expect(body.mcp?.transport).toBe('streamable-http');
    expect(body.mcp?.url).toMatch(/\/api\/mcp$/);
    expect(body.mcp?.tools).toContain('get_profile');
    expect(body.mcp?.tools).toContain('ask_erik');
    expect(body.endpoints?.some((e) => e.url?.includes('/api/ask'))).toBe(true);
  });

  test('POST /api/mcp initialize returns a valid MCP SSE response', async ({ request }) => {
    const res = await request.post('/api/mcp', {
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      data: {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'smoke-test', version: '1.0.0' },
        },
      },
    });
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toMatch(/text\/event-stream/);
    const body = await res.text();
    const dataLine = body.split('\n').find((line) => line.startsWith('data:'));
    if (!dataLine)
      throw new Error(`no SSE data: line in /api/mcp response: ${JSON.stringify(body)}`);
    const message = JSON.parse(dataLine.slice('data:'.length).trim()) as {
      jsonrpc?: string;
      result?: {
        serverInfo?: { name?: string };
        capabilities?: Record<string, unknown>;
      };
      error?: unknown;
    };
    expect(message.jsonrpc).toBe('2.0');
    expect(message.error).toBeUndefined();
    expect(message.result?.serverInfo?.name).toBeTruthy();
    expect(message.result?.capabilities).toHaveProperty('tools');
  });
});
