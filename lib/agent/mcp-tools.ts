import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { type AskOnceOutcome, askOnce } from '@/lib/ask/ask-once';
import { HIRING_PROFILE, HiringProfileSchema } from '@/lib/hiring-profile';

const MIN_QUESTION_LENGTH = 1;
const MAX_QUESTION_LENGTH = 500;

const FORGET_ENDPOINT_PATH = '/api/log/forget';

function forgetNote(requestId: string): string {
  return `request id ${requestId}: POST {"requestId":"${requestId}"} to ${FORGET_ENDPOINT_PATH} to delete this exchange from the ask log.`;
}

function toolResult({ ok, text, requestId }: AskOnceOutcome) {
  return {
    content: [
      { type: 'text' as const, text },
      ...(requestId ? [{ type: 'text' as const, text: forgetNote(requestId) }] : []),
    ],
    ...(ok ? {} : { isError: true as const }),
    ...(requestId ? { _meta: { requestId } } : {}),
  };
}

function profileResult() {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(HIRING_PROFILE) }],
    structuredContent: HIRING_PROFILE,
  };
}

export function registerAgentTools(server: McpServer): void {
  server.registerTool(
    'get_profile',
    {
      title: 'Get hiring profile',
      description:
        "Return Erik Cunha's structured HiringProfile: employers, primary/secondary stack, quantified receipts, education, and availability. Read-only; same data as /api/erik.json.",
      inputSchema: z.object({}),
      outputSchema: HiringProfileSchema,
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    async () => profileResult(),
  );

  server.registerTool(
    'ask_erik',
    {
      title: 'Ask Erik',
      description:
        "Ask a natural-language question about Erik Cunha's experience, stack, projects, or availability. Answered by Claude Haiku 5.5 grounded only in the site's CV context. Rate limit: the caller's address is forwarded, so the ask limit of ~8 requests/hour and the 60-second duplicate-question check apply per caller; a shared monthly dollar budget is the hard cost cap. Failures set isError. The result carries the request id; POST it to /api/log/forget to delete the stored exchange.",
      inputSchema: z.object({
        question: z
          .string()
          .min(MIN_QUESTION_LENGTH)
          .max(MAX_QUESTION_LENGTH)
          .describe('A natural-language question about Erik.'),
      }),
      annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: true },
    },
    async ({ question }, ctx) => toolResult(await askOnce(question, ctx.http?.req?.headers)),
  );
}
