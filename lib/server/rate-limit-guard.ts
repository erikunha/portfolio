import 'server-only';

import { unstable_rethrow } from 'next/navigation';
import { HTTP_STATUS } from '@/lib/http-status';
import { log } from '@/lib/log';
import { describeError } from '@/lib/log-error';
import type { ClientRateLimiter } from '@/lib/rate-limit';
import { clientRateLimitKey } from '@/lib/server/rate-limit-key';
import { err } from '@/lib/server/route';
import { RETRY_AFTER_HEADER, retryAfterSeconds } from '@/lib/stream-protocol';

export function withRateLimit<TReq extends Request>(
  handler: (req: TReq) => Promise<Response>,
  getLimiter: () => ClientRateLimiter,
  message: string,
): (req: TReq) => Promise<Response> {
  return async (req) => {
    try {
      const { success, reset } = await getLimiter().limit(await clientRateLimitKey(req));
      if (!success) {
        const retryAfter = retryAfterSeconds(reset, Date.now());
        return err({
          requestId: crypto.randomUUID(),
          status: HTTP_STATUS.tooManyRequests,
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
