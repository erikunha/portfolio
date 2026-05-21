// __tests__/agent-surfaces.test.ts
//
// Task 1.5 — agent-readiness surfaces.
//
// Asserts the two new machine-readable surfaces this site exposes for AI
// agents are well-formed and wired correctly:
//
//  1. `public/.well-known/agent.json` — a static capability manifest. Must
//     parse as JSON and name the `/api/ask` endpoint so an agent reading the
//     manifest can discover the Q&A surface.
//  2. The MCP server tool set — must expose exactly `get_profile` and
//     `ask_erik`, and `get_profile` must return an object whose `@type` is
//     `HiringProfile` (the same contract `/api/erik.json` upholds).
//
// The MCP assertions exercise the real `registerAgentTools` registration
// against a real `@modelcontextprotocol/sdk` `McpServer` — the same function
// the route handler wires into `createMcpHandler` — so the test covers the
// production tool surface, not a stand-in.

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
