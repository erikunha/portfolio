import { preflightAsk } from '@/lib/ask/preflight';
import { createAskStream } from '@/lib/ask/stream';
import { env } from '@/lib/env';
import { log } from '@/lib/log';
import { afterResponse } from '@/lib/server/after-response';
import { REQUEST_ID_HEADER } from '@/lib/stream-protocol';

try {
  log.info('kill-switch on cold start', { askEnabled: env.ASK_ENABLED ?? 'unset' });
} catch {
  console.error('[ask] logger unavailable on cold start');
}

async function handleAsk(req: Request): Promise<Response> {
  const preflight = await preflightAsk(req);
  if (!preflight.ok) return preflight.response;

  const { readable, settle } = createAskStream(preflight.context);
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
