// @vitest-environment node

import {
  CLIENT_CAPABILITIES_META_KEY,
  CLIENT_INFO_META_KEY,
  PROTOCOL_VERSION_META_KEY,
} from '@modelcontextprotocol/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { STREAM_ERR_SENTINEL } from '@/lib/stream-protocol';

const REQUEST_ID = '6f1d7c2a-3b4e-4c5d-8e9f-0a1b2c3d4e5f';
const CALLER_IP = '203.0.113.7';

const askPost = vi.hoisted(() => vi.fn());

vi.mock('@/app/api/ask/route', () => ({ POST: askPost }));
vi.mock('@/lib/log', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

function answer(body: string, init: ResponseInit = {}): Response {
  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Request-Id': REQUEST_ID },
    ...init,
  });
}

async function askErik(headers: Record<string, string> = {}) {
  const { POST } = await import('@/app/api/mcp/route');
  const res = await POST(
    new Request('http://localhost:3000/api/mcp', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        'mcp-protocol-version': '2026-07-28',
        'mcp-method': 'tools/call',
        'mcp-name': 'ask_erik',
        ...headers,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'ask_erik',
          arguments: { question: 'What is your primary stack?' },
          _meta: {
            [PROTOCOL_VERSION_META_KEY]: '2026-07-28',
            [CLIENT_CAPABILITIES_META_KEY]: {},
            [CLIENT_INFO_META_KEY]: { name: 'mcp-ask-tool-test', version: '1' },
          },
        },
      }),
    }),
  );
  const body = await res.text();
  const data = body
    .split('\n')
    .find((line) => line.startsWith('data:'))
    ?.slice('data:'.length);
  const message = JSON.parse(data ?? body) as {
    result: {
      isError?: boolean;
      content: Array<{ type: string; text: string }>;
      _meta?: Record<string, unknown>;
    };
  };
  return message.result;
}

describe('ask_erik MCP tool', () => {
  beforeEach(() => {
    askPost.mockReset();
    askPost.mockImplementation(async () => answer('the answer'));
  });

  it('forwards the caller address, so the ask limiter and the 60s duplicate check key on the caller', async () => {
    await askErik({ 'x-forwarded-for': `${CALLER_IP}, 10.0.0.1` });

    const forwarded = askPost.mock.calls[0]?.[0] as Request;
    expect(forwarded.headers.get('x-forwarded-for')).toBe(`${CALLER_IP}, 10.0.0.1`);
  });

  it('sends no address header when the MCP request carried none', async () => {
    await askErik();

    const forwarded = askPost.mock.calls[0]?.[0] as Request;
    expect(forwarded.headers.get('x-forwarded-for')).toBeNull();
    expect(forwarded.headers.get('x-real-ip')).toBeNull();
  });

  it('marks an upstream HTTP error as a tool error', async () => {
    askPost.mockResolvedValue(
      new Response(JSON.stringify({ error: 'rate limit exceeded' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await askErik();

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toBe('rate limit exceeded');
  });

  it('marks a stream that ended in an error sentinel as a tool error and keeps the partial answer', async () => {
    askPost.mockResolvedValue(answer(`partial text${STREAM_ERR_SENTINEL}interrupted`));

    const result = await askErik();

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('partial text');
    expect(result.content[0]?.text).toContain('interrupted');
  });

  it('does not mark a normal answer as an error', async () => {
    const result = await askErik();

    expect(result.isError).toBeUndefined();
    expect(result.content[0]?.text).toBe('the answer');
  });

  it('returns the request id, in the result metadata and in a second text block, so the exchange can be forgotten', async () => {
    const result = await askErik();

    expect(result._meta).toMatchObject({ requestId: REQUEST_ID });
    const note = result.content[1]?.text ?? '';
    expect(note).toContain(REQUEST_ID);
    expect(note).toContain('/api/log/forget');
  });

  it('returns the request id on a tool error too', async () => {
    askPost.mockResolvedValue(
      new Response(JSON.stringify({ error: 'budget' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json', 'X-Request-Id': REQUEST_ID },
      }),
    );

    const result = await askErik();

    expect(result.isError).toBe(true);
    expect(result._meta).toMatchObject({ requestId: REQUEST_ID });
  });
});
