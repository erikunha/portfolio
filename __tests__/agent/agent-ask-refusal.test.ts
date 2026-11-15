// @vitest-environment node

import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport, McpServer } from '@modelcontextprotocol/server';
import { describe, expect, it, vi } from 'vitest';
import { askErrors } from '@/content/ask-errors';
import { registerAgentTools } from '@/lib/agent/mcp-tools';
import { REFUSAL_PREFIX, STREAM_ERR_SENTINEL } from '@/lib/stream-protocol';

const REFUSAL_LINE = askErrors.en.refused;

vi.mock('@/app/api/ask/route', () => ({
  POST: vi.fn(
    async () =>
      new Response(`partial words${STREAM_ERR_SENTINEL}${REFUSAL_PREFIX}${REFUSAL_LINE}`, {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      }),
  ),
}));

async function connectTestClient(): Promise<Client> {
  const server = new McpServer({ name: 'test', version: '0.0.0' });
  registerAgentTools(server);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  return client;
}

describe('ask_erik on a model refusal', () => {
  it('returns the refusal as a normal result without the wire prefix', async () => {
    const client = await connectTestClient();
    try {
      const result = await client.callTool({
        name: 'ask_erik',
        arguments: { question: 'What is your primary stack?' },
      });
      const block = (result.content as Array<{ type: string; text: string }>)[0];
      expect(result.isError).not.toBe(true);
      expect(block?.text).toContain(REFUSAL_LINE);
      expect(block?.text).not.toContain(REFUSAL_PREFIX);
      expect(block?.text).not.toContain('upstream error');
    } finally {
      await client.close();
    }
  });
});
