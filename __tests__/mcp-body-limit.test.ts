// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/mcp/route';

vi.mock('@/app/api/ask/route', () => ({
  POST: vi.fn(async () => new Response('answer')),
}));

const MAX_MCP_BODY_BYTES = 4096;
const MCP_URL = 'https://www.erikunha.dev/api/mcp';
const initialize = JSON.stringify({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'body-limit-test', version: '1' },
  },
});

function request(body: string | ReadableStream<Uint8Array>, contentLength?: string): Request {
  const headers = new Headers({
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
  });
  if (contentLength !== undefined) headers.set('Content-Length', contentLength);
  return new Request(MCP_URL, { method: 'POST', headers, body, duplex: 'half' } as RequestInit);
}

describe('/api/mcp request body limit', () => {
  it('rejects an oversized Content-Length before reading the body', async () => {
    const req = request(initialize, String(MAX_MCP_BODY_BYTES + 1));
    const response = await POST(req);
    expect(response.status).toBe(413);
    expect(req.bodyUsed).toBe(false);
    expect(await response.json()).toEqual({
      ok: false,
      requestId: response.headers.get('X-Request-Id'),
      error: {
        code: 'payload_too_large',
        message: 'request body exceeds the 4096-byte limit',
      },
    });
    expect(response.headers.get('X-Request-Id')).toEqual(expect.any(String));
  });

  it('rejects Content-Length beyond the finite number range without reading', async () => {
    const req = request(initialize, '9'.repeat(400));
    const response = await POST(req);
    expect(response.status).toBe(413);
    expect(req.bodyUsed).toBe(false);
  });

  it.each([undefined, '1', 'invalid'])(
    'rejects oversized bytes with Content-Length %s',
    async (length) => {
      const response = await POST(request(initialize.padEnd(MAX_MCP_BODY_BYTES + 1), length));
      expect(response.status).toBe(413);
    },
  );

  it('counts UTF-8 bytes rather than characters', async () => {
    const body = initialize.replace('body-limit-test', '界'.repeat(1400));
    expect(body.length).toBeLessThan(MAX_MCP_BODY_BYTES);
    expect(new TextEncoder().encode(body).byteLength).toBeGreaterThan(MAX_MCP_BODY_BYTES);
    const response = await POST(request(body));
    expect(response.status).toBe(413);
  });

  it('cancels an oversized stream before reading the rest', async () => {
    const cancel = vi.fn();
    let pulls = 0;
    const body = new ReadableStream<Uint8Array>(
      {
        pull(controller) {
          pulls += 1;
          if (pulls <= 2) controller.enqueue(new Uint8Array(MAX_MCP_BODY_BYTES));
          else controller.error(new Error('read beyond the limit'));
        },
        cancel,
      },
      { highWaterMark: 0 },
    );
    const response = await POST(request(body));
    expect(response.status).toBe(413);
    expect(pulls).toBe(2);
    expect(cancel).toHaveBeenCalledOnce();
  });

  it('reports a stream that fails mid-read as invalid_body, not invalid_json', async () => {
    const body = new ReadableStream<Uint8Array>(
      {
        pull(controller) {
          controller.error(new Error('connection reset'));
        },
      },
      { highWaterMark: 0 },
    );
    const response = await POST(request(body));
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe('invalid_body');
  });

  it('rejects oversized malformed JSON as too large before parsing', async () => {
    const response = await POST(request('{'.repeat(MAX_MCP_BODY_BYTES + 1)));
    expect(response.status).toBe(413);
  });

  it.each([initialize, initialize.padEnd(MAX_MCP_BODY_BYTES)])(
    'accepts initialize within or exactly at the byte limit',
    async (body) => {
      const response = await POST(request(body, String(new TextEncoder().encode(body).byteLength)));
      expect(response.status).toBe(200);
      expect(await response.text()).toContain('"serverInfo"');
    },
  );

  it('fits the largest escaped tool question and its JSON-RPC envelope', async () => {
    const body = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: 'ask_erik', arguments: { question: '\u0001'.repeat(500) } },
    });
    expect(new TextEncoder().encode(body).byteLength).toBeLessThan(MAX_MCP_BODY_BYTES);
    const response = await POST(request(body));
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('answer');
  });
});
