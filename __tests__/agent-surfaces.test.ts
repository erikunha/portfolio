// @vitest-environment node

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { describe, expect, it, vi } from 'vitest';
import { registerAgentTools } from '@/lib/agent/mcp-tools';

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

async function readFirstSseMessage(res: Response): Promise<Record<string, unknown>> {
  const body = await res.text();
  const dataLine = body.split('\n').find((line) => line.startsWith('data:'));
  if (!dataLine) throw new Error(`no SSE data line in body: ${JSON.stringify(body)}`);
  return JSON.parse(dataLine.slice('data:'.length).trim());
}

describe('MCP route handler — /api/[transport]/route.ts', () => {
  it('answers a JSON-RPC initialize POST at /api/mcp with a valid MCP result', async () => {
    const { POST } = await import('@/app/api/[transport]/route');

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

    const res = await POST(req as unknown as Parameters<typeof POST>[0]);

    expect(res.status).toBe(200);

    const message = await readFirstSseMessage(res);
    expect(message.jsonrpc).toBe('2.0');
    expect(message.id).toBe(1);
    expect(message.error).toBeUndefined();
    const result = message.result as Record<string, unknown> | undefined;
    expect(result).toBeDefined();
    expect(result?.protocolVersion).toBe('2025-06-18');
    expect((result?.serverInfo as { name?: string })?.name).toBe('erikunha.dev');
    expect(result?.capabilities).toHaveProperty('tools');
  });

  it('rejects GET at /api/mcp with 405 (streamable-http is POST-only)', async () => {
    const { GET } = await import('@/app/api/[transport]/route');

    const req = new Request('http://localhost:3000/api/mcp', {
      method: 'GET',
      headers: { accept: 'text/event-stream' },
    });

    const res = await GET(req as unknown as Parameters<typeof GET>[0]);
    expect(res.status).toBe(405);
  });
});
