import { startAsk } from '@/lib/ask/stream';
import { env } from '@/lib/env';
import { log } from '@/lib/log';
import { REQUEST_ID_HEADER } from '@/lib/stream-protocol';

try {
  log.info('kill-switch on cold start', { askEnabled: env.ASK_ENABLED ?? 'unset' });
} catch {
  console.error('[ask] logger unavailable on cold start');
}

async function handleAsk(req: Request): Promise<Response> {
  const start = await startAsk(req);
  if (!start.ok) return start.response;

  return new Response(start.readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      [REQUEST_ID_HEADER]: start.requestId,
    },
  });
}

export const POST = handleAsk;
