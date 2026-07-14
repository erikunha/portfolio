import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { POST as askPost } from '@/app/api/ask/route';
import { HIRING_PROFILE } from '@/lib/hiring-profile';
import { parseStreamChunk } from '@/lib/stream-protocol';

function textResult(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}

async function runAsk(question: string): Promise<string> {
  const req = new Request('https://www.erikunha.dev/api/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  });

  const res = await askPost(req as unknown as Parameters<typeof askPost>[0]);

  if (!res.ok) {
    let message = `ask endpoint returned ${res.status}`;
    try {
      const body = (await res.json()) as { error?: unknown };
      if (typeof body.error === 'string') message = body.error;
      // biome-ignore lint/suspicious/noEmptyBlockStatements: intentional no-op
    } catch (_parseErr) {}
    return message;
  }

  const raw = await res.text();
  const chunk = parseStreamChunk(raw);
  if (!chunk.ok) {
    return chunk.displayText
      ? `${chunk.displayText}\n\n[upstream error: ${chunk.errorMessage}]`
      : `error: ${chunk.errorMessage}`;
  }
  return chunk.displayText || '(empty answer)';
}

export function registerAgentTools(server: McpServer): void {
  server.registerTool(
    'get_profile',
    {
      title: 'Get hiring profile',
      description:
        "Return Erik Cunha's structured HiringProfile: employers, primary/secondary stack, quantified receipts, work authorization, education, and availability. Read-only; same data as /api/erik.json.",
      inputSchema: {},
    },
    async () => textResult(JSON.stringify(HIRING_PROFILE)),
  );

  server.registerTool(
    'ask_erik',
    {
      title: 'Ask Erik',
      description:
        "Ask a natural-language question about Erik Cunha's experience, stack, projects, or availability. Answered by Claude Haiku 4.5 grounded only in the site's CV context. Rate limit: MCP calls carry no client IP, so all callers worldwide share ONE global bucket of ~8 requests/hour total (not per-caller); a shared monthly token budget is the hard cost cap.",
      inputSchema: {
        question: z.string().min(1).max(500).describe('A natural-language question about Erik.'),
      },
    },
    async ({ question }) => textResult(await runAsk(question)),
  );
}
