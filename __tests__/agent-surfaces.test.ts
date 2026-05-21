// @vitest-environment node
//
// __tests__/agent-surfaces.test.ts
//
// Runs in the `node` environment, not the project-default `jsdom`. The MCP
// route-handler test below drives the real `mcp-handler` streamable-HTTP
// adapter, whose chunk-type check (`chunk instanceof Uint8Array`) fails under
// jsdom — jsdom installs its own `Uint8Array`/`Buffer` globals, so a typed
// array minted by the MCP SDK fails the `instanceof` against jsdom's copy.
// The `node` environment matches the real Node serverless runtime this route
// ships on (`export const runtime = 'nodejs'`). None of the other assertions
// here need a DOM.
//
// Task 1.5 — agent-readiness surfaces.
//
// Asserts the three machine-readable surfaces this site exposes for AI
// agents are well-formed and wired correctly:
//
//  1. `public/.well-known/agent.json` — a static capability manifest. Must
//     parse as JSON, name the `/api/ask` endpoint so an agent reading the
//     manifest can discover the Q&A surface, and declare the MCP transport
//     precisely as `streamable-http`.
//  2. The MCP server tool set — must expose exactly `get_profile` and
//     `ask_erik`, and `get_profile` must return an object whose `@type` is
//     `HiringProfile` (the same contract `/api/erik.json` upholds).
//  3. The MCP route handler at `app/api/[transport]/route.ts` — the exported
//     `POST` must answer a JSON-RPC `initialize` request sent to the real
//     `/api/mcp` URL with a valid (non-404, non-error) MCP response. This is
//     the regression guard for the `basePath` config: `mcp-handler` derives
//     its streamable-HTTP endpoint from `basePath` and exact-matches it
//     against `url.pathname`; a wrong `basePath` 404s every request, and the
//     tool-surface tests above would not catch it because they bypass the
//     handler entirely.
//
// The MCP tool-surface assertions exercise the real `registerAgentTools`
// registration against a real `@modelcontextprotocol/sdk` `McpServer` — the
// same function the route handler wires into `createMcpHandler` — so the test
// covers the production tool surface, not a stand-in.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { describe, expect, it, vi } from 'vitest';
import { registerAgentTools } from '@/lib/agent/mcp-tools';

// `ask_erik` re-invokes the real /api/ask POST handler. Mock the route module
// so the tool-surface test never makes a live Anthropic/Redis call — the test
// asserts the *tool wiring*, not the model. The ask path itself is covered by
// the dedicated /api/ask suite.
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

/** Spin up an in-memory MCP server with the production tools registered. */
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
    // The manifest must somewhere reference /api/ask so an agent can discover
    // the Q&A surface. Serialized-form search keeps this resilient to the
    // exact key the path lives under.
    expect(JSON.stringify(manifest)).toContain('/api/ask');
  });

  it('declares the MCP transport precisely as streamable-http', () => {
    const manifest = JSON.parse(readFileSync(AGENT_JSON_PATH, 'utf8')) as {
      mcp?: { transport?: string; url?: string };
    };
    // The MCP endpoint is POST-only streamable HTTP — `GET /api/mcp` returns
    // 405 by MCP spec. The transport field must say so precisely, not the
    // imprecise `http`.
    expect(manifest.mcp?.transport).toBe('streamable-http');
    expect(manifest.mcp?.url).toBe('https://erikunha.dev/api/mcp');
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
});

// Reads one SSE stream body and returns the first `data:` line's JSON payload.
// `mcp-handler`'s streamable-HTTP transport answers `initialize` with a
// `text/event-stream` body framed as `event: message\ndata: <json>`.
async function readFirstSseMessage(res: Response): Promise<Record<string, unknown>> {
  const body = await res.text();
  const dataLine = body.split('\n').find((line) => line.startsWith('data:'));
  if (!dataLine) throw new Error(`no SSE data line in body: ${JSON.stringify(body)}`);
  return JSON.parse(dataLine.slice('data:'.length).trim());
}

describe('MCP route handler — /api/[transport]/route.ts', () => {
  // This is the regression guard the tool-surface tests cannot provide: it
  // drives the EXPORTED route handler at the REAL `/api/mcp` URL. `mcp-handler`
  // derives its streamable-HTTP endpoint from the `basePath` config and
  // exact-matches it against `url.pathname`; a wrong `basePath` makes every
  // POST fall through to a 404. The tool-surface tests bypass the handler, so
  // a `basePath` regression would ship green without this test.
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

    // Not a 404 — the `basePath` resolves the request to this handler.
    expect(res.status).toBe(200);

    const message = await readFirstSseMessage(res);
    // A well-formed JSON-RPC initialize result, not a JSON-RPC error envelope.
    expect(message.jsonrpc).toBe('2.0');
    expect(message.id).toBe(1);
    expect(message.error).toBeUndefined();
    const result = message.result as Record<string, unknown> | undefined;
    expect(result).toBeDefined();
    expect(result?.protocolVersion).toBe('2025-06-18');
    expect((result?.serverInfo as { name?: string })?.name).toBe('erikunha.dev');
    // The SDK advertises the `tools` capability automatically on registerTool.
    expect(result?.capabilities).toHaveProperty('tools');
  });

  it('rejects GET at /api/mcp with 405 (streamable-http is POST-only)', async () => {
    const { GET } = await import('@/app/api/[transport]/route');

    const req = new Request('http://localhost:3000/api/mcp', {
      method: 'GET',
      headers: { accept: 'text/event-stream' },
    });

    const res = await GET(req as unknown as Parameters<typeof GET>[0]);
    // MCP streamable-HTTP is POST-only — confirms the `streamable-http`
    // transport label in agent.json is accurate.
    expect(res.status).toBe(405);
  });
});
