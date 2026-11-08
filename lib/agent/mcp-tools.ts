import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { POST as askPost } from '@/app/api/ask/route';
import { social } from '@/content/social';
import { HIRING_PROFILE } from '@/lib/hiring-profile';
import { parseStreamChunk, REQUEST_ID_HEADER } from '@/lib/stream-protocol';

const MIN_QUESTION_LENGTH = 1;
const MAX_QUESTION_LENGTH = 500;

const FORWARDED_CLIENT_HEADERS = ['x-forwarded-for', 'x-real-ip'] as const;

const ASK_ENDPOINT_URL = `${social.site}/api/ask`;

const FORGET_ENDPOINT_PATH = '/api/log/forget';

type AskOutcome = { ok: boolean; text: string; requestId: string | null };

function forwardedClientHeaders(source: Headers | undefined): Record<string, string> {
  const forwarded: Record<string, string> = {};
  for (const name of FORWARDED_CLIENT_HEADERS) {
    const value = source?.get(name);
    if (value) forwarded[name] = value;
  }
  return forwarded;
}

function forgetNote(requestId: string): string {
  return `request id ${requestId}: POST {"requestId":"${requestId}"} to ${FORGET_ENDPOINT_PATH} to delete this exchange from the ask log.`;
}

function toolResult({ ok, text, requestId }: AskOutcome) {
  return {
    content: [
      { type: 'text' as const, text },
      ...(requestId ? [{ type: 'text' as const, text: forgetNote(requestId) }] : []),
    ],
    ...(ok ? {} : { isError: true as const }),
    ...(requestId ? { _meta: { requestId } } : {}),
  };
}

async function runAsk(question: string, clientHeaders: Headers | undefined): Promise<AskOutcome> {
  const req = new Request(ASK_ENDPOINT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...forwardedClientHeaders(clientHeaders) },
    body: JSON.stringify({ question }),
  });

  const res = await askPost(req as unknown as Parameters<typeof askPost>[0]);
  const requestId = res.headers.get(REQUEST_ID_HEADER);

  if (!res.ok) {
    let message = `ask endpoint returned ${res.status}`;
    try {
      const body = (await res.json()) as { error?: unknown };
      if (typeof body.error === 'string') message = body.error;
      // biome-ignore lint/suspicious/noEmptyBlockStatements: intentional no-op
    } catch (_parseErr) {}
    return { ok: false, text: message, requestId };
  }

  const raw = await res.text();
  const chunk = parseStreamChunk(raw);
  if (!chunk.ok) {
    const text = chunk.displayText
      ? `${chunk.displayText}\n\n[upstream error: ${chunk.errorMessage}]`
      : `error: ${chunk.errorMessage}`;
    return { ok: false, text, requestId };
  }
  return { ok: true, text: chunk.displayText || '(empty answer)', requestId };
}

function textResult(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}

export function registerAgentTools(server: McpServer): void {
  server.registerTool(
    'get_profile',
    {
      title: 'Get hiring profile',
      description:
        "Return Erik Cunha's structured HiringProfile: employers, primary/secondary stack, quantified receipts, education, and availability. Read-only; same data as /api/erik.json.",
      inputSchema: z.object({}),
    },
    async () => textResult(JSON.stringify(HIRING_PROFILE)),
  );

  server.registerTool(
    'ask_erik',
    {
      title: 'Ask Erik',
      description:
        "Ask a natural-language question about Erik Cunha's experience, stack, projects, or availability. Answered by Claude Haiku 4.5 grounded only in the site's CV context. Rate limit: the caller's address is forwarded, so the ask limit of ~8 requests/hour and the 60-second duplicate-question check apply per caller; a shared monthly token budget is the hard cost cap. Failures set isError. The result carries the request id; POST it to /api/log/forget to delete the stored exchange.",
      inputSchema: z.object({
        question: z
          .string()
          .min(MIN_QUESTION_LENGTH)
          .max(MAX_QUESTION_LENGTH)
          .describe('A natural-language question about Erik.'),
      }),
    },
    async ({ question }, ctx) => toolResult(await runAsk(question, ctx.http?.req?.headers)),
  );
}
