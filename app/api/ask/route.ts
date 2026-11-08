import { askErrors } from '@/content/ask-errors';
import { type AskContext, askError, preflightAsk } from '@/lib/ask/preflight';
import { type AskStream, createAskStream } from '@/lib/ask/stream';
import { env } from '@/lib/env';
import { log } from '@/lib/log';
import { describeError } from '@/lib/log-error';
import { releaseIdenticalQuestion, settleBudget } from '@/lib/rate-limit';
import { afterResponse } from '@/lib/server/after-response';
import { REQUEST_ID_HEADER } from '@/lib/stream-protocol';

try {
  log.info('kill-switch on cold start', { askEnabled: env.ASK_ENABLED ?? 'unset' });
} catch {
  console.error('[ask] logger unavailable on cold start');
}

const INTERNAL_ERROR_STATUS = 500;

const NO_TOKENS_USED = 0;

async function startStream(context: AskContext): Promise<AskStream | Response> {
  try {
    return createAskStream(context);
  } catch (startErr) {
    log.error('ask stream could not start', {
      requestId: context.requestId,
      error: describeError(startErr),
    });
    await settleBudget(
      context.reserved,
      NO_TOKENS_USED,
      NO_TOKENS_USED,
      context.budgetKey,
      context.dailyKey,
    );
    await releaseIdenticalQuestion(context.ipHash, context.question);
    return askError(
      context.requestId,
      askErrors[context.answerLocale].interrupted,
      INTERNAL_ERROR_STATUS,
    );
  }
}

async function handleAsk(req: Request): Promise<Response> {
  const preflight = await preflightAsk(req);
  if (!preflight.ok) return preflight.response;

  const stream = await startStream(preflight.context);
  if (stream instanceof Response) return stream;
  const { readable, settle } = stream;
  afterResponse(settle);

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      [REQUEST_ID_HEADER]: preflight.context.requestId,
    },
  });
}

export const POST = handleAsk;
