// lib/agent/mcp-tools.ts
//
// Tool registration for the read-only MCP (Model Context Protocol) server
// hosted at `app/api/[transport]/route.ts`. Factored out of the route file so the
// production tool surface can be exercised directly in a unit test against a
// real `McpServer` (see `__tests__/agent-surfaces.test.ts`) — `createMcpHandler`
// returns an HTTP handler that is awkward to drive in-process, the registration
// function is not.
//
// Two tools, both read-only, no auth, no new infrastructure:
//   - get_profile : returns the shared HIRING_PROFILE (one source of truth with
//                   /api/erik.json — see lib/hiring-profile.ts).
//   - ask_erik    : re-invokes the real /api/ask POST handler and returns the
//                   answer text. The Claude call, rate limit, budget cap, and
//                   prompt-injection guard are NOT re-implemented here — the
//                   route handler is the single owner of that path.

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { POST as askPost } from '@/app/api/ask/route';
import { HIRING_PROFILE } from '@/lib/hiring-profile';
import { parseStreamChunk } from '@/lib/stream-protocol';

/** An MCP tool result content block — plain text payload. */
function textResult(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}

/**
 * Drive the real /api/ask POST handler in-process and return the answer text.
 *
 * The route streams `text/plain`; on a mid-stream upstream failure it appends
 * the NUL-byte sentinel. `parseStreamChunk` splits the visible answer from any
 * sentinel-marked error — the same parser the browser client uses — so the MCP
 * tool surfaces an upstream failure as an explicit message instead of leaking
 * the raw sentinel into an agent's context.
 *
 * `/api/ask` is `force-dynamic` and reads the request body + headers only; a
 * synthetic same-origin POST is a faithful caller. This is the documented
 * "reuse the real ask path" seam — no second Claude integration exists.
 *
 * KNOWN, ACCEPTED LIMITATION — shared rate-limit bucket. This synthetic Request
 * carries no `x-forwarded-for` / `x-real-ip` header, so `getClientIp`
 * (lib/rate-limit.ts) returns the literal string `'unknown'` for every MCP
 * `ask_erik` call. Consequently ALL `ask_erik` calls worldwide key to the same
 * IP and share ONE 8/hour `rl:ask` rate-limit bucket and one identical-question
 * dedup bucket. This is intentional and not mitigated: per-caller limiting for
 * MCP would be disproportionate for a single-author portfolio, and the monthly
 * Anthropic token budget cap (lib/rate-limit.ts `reserveBudget`) is the real
 * cost backstop. See DECISIONS.md (2026-05-21).
 */
async function runAsk(question: string): Promise<string> {
  const req = new Request('https://erikunha.dev/api/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  });

  // The ask route's POST is typed for NextRequest but only touches the subset
  // (json(), headers) that a plain Request satisfies; the cast is the seam.
  const res = await askPost(req as unknown as Parameters<typeof askPost>[0]);

  // Non-2xx responses from the ask route are JSON error envelopes
  // ({ error: string }) — rate limit, budget exhausted, injection rejected,
  // bad input. Surface the message rather than the raw body.
  if (!res.ok) {
    let message = `ask endpoint returned ${res.status}`;
    try {
      const body = (await res.json()) as { error?: unknown };
      if (typeof body.error === 'string') message = body.error;
    } catch {
      // Non-JSON error body — keep the status-code fallback message.
    }
    return message;
  }

  const raw = await res.text();
  const { displayText, errorMessage } = parseStreamChunk(raw);
  if (errorMessage) {
    return displayText
      ? `${displayText}\n\n[upstream error: ${errorMessage}]`
      : `error: ${errorMessage}`;
  }
  return displayText || '(empty answer)';
}

/**
 * Register the read-only agent tools on an MCP server instance. Called by the
 * route handler's `createMcpHandler` init callback and, independently, by the
 * test — both get the identical, single-sourced tool surface.
 */
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
