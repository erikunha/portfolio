// @vitest-environment node

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import {
  CLIENT_CAPABILITIES_META_KEY,
  CLIENT_INFO_META_KEY,
  InMemoryTransport,
  McpServer,
  PROTOCOL_VERSION_META_KEY,
  SERVER_INFO_META_KEY,
} from '@modelcontextprotocol/server';
import { describe, expect, it, vi } from 'vitest';
import { registerAgentTools } from '@/lib/agent/mcp-tools';
import { HIRING_PROFILE } from '@/lib/hiring-profile';

vi.mock('@/app/api/ask/route', () => ({
  POST: vi.fn(
    async () =>
      new Response('mocked answer text', {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      }),
  ),
}));

const AGENT_JSON_PATH = path.resolve(__dirname, '../public/.well-known/agent.json');

async function connectTestClient(): Promise<Client> {
  const server = new McpServer({ name: 'test', version: '0.0.0' });
  registerAgentTools(server);

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  return client;
}

describe('public/.well-known/agent.json', () => {
  it('parses as valid JSON', () => {
    const raw = readFileSync(AGENT_JSON_PATH, 'utf8');
    expect(() => JSON.parse(raw)).not.toThrow();
  });

  it('names the /api/ask endpoint', () => {
    const manifest = JSON.parse(readFileSync(AGENT_JSON_PATH, 'utf8'));
    expect(JSON.stringify(manifest)).toContain('/api/ask');
  });

  it('declares the MCP transport precisely as streamable-http', () => {
    const manifest = JSON.parse(readFileSync(AGENT_JSON_PATH, 'utf8')) as {
      mcp?: { transport?: string; url?: string };
    };
    expect(manifest.mcp?.transport).toBe('streamable-http');
    expect(manifest.mcp?.url).toBe('https://www.erikunha.dev/api/mcp');
  });

  it('advertises no work-authorization data the profile no longer publishes', async () => {
    const manifest = JSON.parse(readFileSync(AGENT_JSON_PATH, 'utf8')) as {
      profiles?: Array<{ description?: string }>;
      work_auth?: Record<string, unknown>;
    };
    expect(
      manifest.work_auth,
      'the profile publishes an empty work-authorization record, so no description may promise work-authorization data',
    ).toEqual({});
    for (const profile of manifest.profiles ?? []) {
      expect(
        profile.description ?? '',
        'a manifest description must not promise a field the endpoint no longer returns',
      ).not.toMatch(/work authorization/i);
    }

    const client = await connectTestClient();
    try {
      const { tools } = await client.listTools();
      for (const tool of tools) {
        expect(
          tool.description ?? '',
          `MCP tool "${tool.name}" must not promise a field the profile no longer returns`,
        ).not.toMatch(/work authorization/i);
      }
    } finally {
      await client.close();
    }
  });
});

describe('MCP server tool surface', () => {
  it('exposes exactly the tools get_profile and ask_erik', async () => {
    const client = await connectTestClient();
    try {
      const { tools } = await client.listTools();
      const names = tools.map((t) => t.name).sort();
      expect(names).toEqual(['ask_erik', 'get_profile']);
    } finally {
      await client.close();
    }
  });

  it('get_profile returns an object with @type === HiringProfile', async () => {
    const client = await connectTestClient();
    try {
      const result = await client.callTool({ name: 'get_profile', arguments: {} });
      const block = (result.content as Array<{ type: string; text: string }>)[0];
      expect(block?.type).toBe('text');
      const profile = JSON.parse(block?.text ?? '{}') as Record<string, unknown>;
      expect(profile['@type']).toBe('HiringProfile');
    } finally {
      await client.close();
    }
  });

  it('ask_erik returns the answer text from the real ask path', async () => {
    const client = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'ask_erik',
        arguments: { question: 'What is your primary stack?' },
      });
      const block = (result.content as Array<{ type: string; text: string }>)[0];
      expect(block?.type).toBe('text');
      expect(block?.text).toContain('mocked answer text');
    } finally {
      await client.close();
    }
  });

  it('ask_erik surfaces the error message when the ask endpoint returns non-2xx JSON', async () => {
    const { POST: askMock } = await import('@/app/api/ask/route');
    (askMock as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'rate limit exceeded' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const client = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'ask_erik',
        arguments: { question: 'Will this hit the rate limit?' },
      });
      const block = (result.content as Array<{ type: string; text: string }>)[0];
      expect(block?.text).toBe('rate limit exceeded');
    } finally {
      await client.close();
    }
  });

  it('ask_erik surfaces a status fallback when the non-2xx response is not JSON', async () => {
    const { POST: askMock } = await import('@/app/api/ask/route');
    (askMock as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response('not json', {
        status: 503,
        headers: { 'Content-Type': 'text/plain' },
      }),
    );

    const client = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'ask_erik',
        arguments: { question: 'Trigger a 503' },
      });
      const block = (result.content as Array<{ type: string; text: string }>)[0];
      expect(block?.text).toContain('503');
    } finally {
      await client.close();
    }
  });
});

async function readMcpMessage(res: Response): Promise<Record<string, unknown>> {
  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) return res.json();
  if (!contentType.includes('text/event-stream')) {
    throw new Error(`unsupported MCP content type: ${contentType}`);
  }
  const body = await res.text();
  const dataLine = body
    .split('\n')
    .find((line) => line.startsWith('data:') && line.slice('data:'.length).trim());
  if (!dataLine) throw new Error(`no SSE data line in body: ${JSON.stringify(body)}`);
  return JSON.parse(dataLine.slice('data:'.length).trim());
}

describe('MCP response parsing', () => {
  it.each([
    ['application/json; charset=utf-8', '{"jsonrpc":"2.0","id":1,"result":{}}'],
    ['text/event-stream', 'event: message\ndata: {"jsonrpc":"2.0","id":1,"result":{}}\n\n'],
    [
      'text/event-stream',
      'data: \n\nevent: message\ndata: {"jsonrpc":"2.0","id":1,"result":{}}\n\n',
    ],
  ])('reads a JSON-RPC message from %s', async (contentType, body) => {
    const message = await readMcpMessage(
      new Response(body, { headers: { 'content-type': contentType } }),
    );
    expect(message).toEqual({ jsonrpc: '2.0', id: 1, result: {} });
  });
});

async function postModernMcpMessage(method: string, params: Record<string, unknown> = {}) {
  const { POST } = await import('@/app/api/mcp/route');
  return POST(
    new Request('http://localhost:3000/api/mcp', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        'mcp-protocol-version': '2026-07-28',
        'mcp-method': method,
        ...(typeof params.name === 'string' ? { 'mcp-name': params.name } : {}),
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method,
        params: {
          ...params,
          _meta: {
            [PROTOCOL_VERSION_META_KEY]: '2026-07-28',
            [CLIENT_CAPABILITIES_META_KEY]: {},
            [CLIENT_INFO_META_KEY]: { name: 'agent-surfaces-test', version: '1' },
          },
        },
      }),
    }),
  );
}

describe('MCP route handler at /api/mcp', () => {
  it('answers a JSON-RPC initialize POST at /api/mcp with a valid MCP result', async () => {
    const { POST } = await import('@/app/api/mcp/route');

    const req = new Request('http://localhost:3000/api/mcp', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'agent-surfaces-test', version: '1' },
        },
      }),
    });

    const res = await POST(req);

    expect(res.status).toBe(200);

    const message = await readMcpMessage(res);
    expect(message.jsonrpc).toBe('2.0');
    expect(message.id).toBe(1);
    expect(message.error).toBeUndefined();
    const result = message.result as Record<string, unknown> | undefined;
    expect(result).toBeDefined();
    expect(result?.protocolVersion).toBe('2025-06-18');
    expect((result?.serverInfo as { name?: string })?.name).toBe('erikunha.dev');
    expect(result?.capabilities).toHaveProperty('tools');
  });

  it('answers modern server/discover without an initialize handshake or session', async () => {
    const res = await postModernMcpMessage('server/discover');
    expect(res.status).toBe(200);
    expect(res.headers.get('mcp-session-id')).toBeNull();
    const message = await readMcpMessage(res);
    expect(message).toMatchObject({
      jsonrpc: '2.0',
      id: 1,
      result: {
        supportedVersions: ['2026-07-28'],
        _meta: { [SERVER_INFO_META_KEY]: { name: 'erikunha.dev', version: '1.0.0' } },
        capabilities: { tools: {} },
      },
    });
    expect(message.error).toBeUndefined();
  });

  it('rejects modern subscriptions/listen with a complete JSON error instead of an open SSE stream', async () => {
    const res = await postModernMcpMessage('subscriptions/listen', {
      notifications: { toolsListChanged: true },
    });

    try {
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('application/json');
      const reader = res.body?.getReader();
      expect(reader).toBeDefined();
      try {
        const chunk = await reader?.read();
        expect(chunk?.done).toBe(false);
        expect(JSON.parse(new TextDecoder().decode(chunk?.value))).toEqual({
          jsonrpc: '2.0',
          id: 1,
          error: { code: -32603, message: 'Subscription limit reached' },
        });
        expect(await reader?.read()).toEqual({ done: true, value: undefined });
      } finally {
        await reader?.cancel();
        reader?.releaseLock();
      }
    } finally {
      if (!res.bodyUsed) await res.body?.cancel();
    }
  });

  it('lists both tools and their object schemas through the modern route', async () => {
    const res = await postModernMcpMessage('tools/list');
    expect(res.status).toBe(200);
    const message = await readMcpMessage(res);
    expect(message.error).toBeUndefined();
    const result = message.result as {
      tools: Array<{ name: string; inputSchema: Record<string, unknown> }>;
    };
    expect(result.tools.map((tool) => tool.name).sort()).toEqual(['ask_erik', 'get_profile']);
    expect(result.tools.find((tool) => tool.name === 'get_profile')?.inputSchema).toMatchObject({
      type: 'object',
      properties: {},
    });
    expect(result.tools.find((tool) => tool.name === 'ask_erik')?.inputSchema).toMatchObject({
      type: 'object',
      properties: { question: { type: 'string', minLength: 1, maxLength: 500 } },
      required: ['question'],
    });
  });

  it('returns the unchanged profile through a modern tools/call request', async () => {
    const res = await postModernMcpMessage('tools/call', { name: 'get_profile', arguments: {} });
    expect(res.status).toBe(200);
    const message = await readMcpMessage(res);
    expect(message.error).toBeUndefined();
    expect(message.result).toMatchObject({
      content: [{ type: 'text', text: JSON.stringify(HIRING_PROFILE) }],
    });
  });

  it('calls the ask endpoint with the question and returns its text through the modern route', async () => {
    const { POST: askMock } = await import('@/app/api/ask/route');
    vi.mocked(askMock).mockClear();
    const res = await postModernMcpMessage('tools/call', {
      name: 'ask_erik',
      arguments: { question: 'What is your primary stack?' },
    });
    expect(res.status).toBe(200);
    const message = await readMcpMessage(res);
    expect(message.error).toBeUndefined();
    expect(message.result).toMatchObject({
      content: [{ type: 'text', text: 'mocked answer text' }],
    });
    expect(askMock).toHaveBeenCalledTimes(1);
    const forwardedRequest = vi.mocked(askMock).mock.calls[0]?.[0];
    expect(forwardedRequest?.url).toBe('https://www.erikunha.dev/api/ask');
    expect(forwardedRequest?.method).toBe('POST');
    expect(await forwardedRequest?.json()).toEqual({ question: 'What is your primary stack?' });
  });

  it.each([{}, { question: '' }, { question: 'a'.repeat(501) }, { question: 42 }])(
    'rejects invalid ask_erik arguments before calling the ask endpoint: %j',
    async (args) => {
      const { POST: askMock } = await import('@/app/api/ask/route');
      vi.mocked(askMock).mockClear();
      const res = await postModernMcpMessage('tools/call', { name: 'ask_erik', arguments: args });
      expect(res.status).toBe(200);
      const message = await readMcpMessage(res);
      expect(message.error).toBeUndefined();
      expect(message.result).toMatchObject({ isError: true });
      expect(askMock).not.toHaveBeenCalled();
    },
  );

  it('rejects GET at /api/mcp with 405 (streamable-http is POST-only)', async () => {
    const { GET } = await import('@/app/api/mcp/route');

    const req = new Request('http://localhost:3000/api/mcp', {
      method: 'GET',
      headers: { accept: 'text/event-stream' },
    });

    const res = await GET(req);
    expect(res.status).toBe(405);
  });
});
