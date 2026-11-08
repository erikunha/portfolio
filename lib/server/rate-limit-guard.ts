import 'server-only';

import { unstable_rethrow } from 'next/navigation';
import { log } from '@/lib/log';
import { describeError } from '@/lib/log-error';
import { getClientIp } from '@/lib/rate-limit';
import { err } from '@/lib/server/route';
import { RETRY_AFTER_HEADER, retryAfterSeconds } from '@/lib/stream-protocol';

const TOO_MANY_REQUESTS_STATUS = 429;

interface Limiter {
  limit(key: string): Promise<{ success: boolean; reset?: number }>;
}

export function withRateLimit<TReq extends Request>(
  handler: (req: TReq) => Promise<Response>,
  getLimiter: () => Limiter,
  message: string,
): (req: TReq) => Promise<Response> {
  return async (req) => {
    try {
      const { success, reset } = await getLimiter().limit(getClientIp(req));
      if (!success) {
        const retryAfter = retryAfterSeconds(reset, Date.now());
        return err({
          requestId: crypto.randomUUID(),
          status: TOO_MANY_REQUESTS_STATUS,
          code: 'rate_limited',
          message,
          ...(retryAfter === null
            ? {}
            : { extraHeaders: { [RETRY_AFTER_HEADER]: String(retryAfter) } }),
        });
      }
    } catch (limitErr) {
      unstable_rethrow(limitErr);
      log.warn('rate-limit unavailable, allowing request', { error: describeError(limitErr) });
    }
    return handler(req);
  };
}
