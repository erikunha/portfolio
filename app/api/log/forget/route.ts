import { z } from 'zod';

import { log } from '@/lib/log';
import { getForgetLimit, getRedis } from '@/lib/rate-limit';
import { defineHandler, err, ok } from '@/lib/server/route';

const ForgetPayload = z.object({
  requestId: z.string().uuid(),
});

const SMOKE_UUID = '00000000-0000-4000-8000-000000000000';

function lastNDates(n: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export const POST = defineHandler({
  schema: ForgetPayload,
  rateLimit: getForgetLimit,
  rateLimitErrorMessage: 'too many forget requests',
  async handler({ body, requestId }) {
    const { requestId: targetRequestId } = body;

    if (targetRequestId === SMOKE_UUID) {
      return ok({ requestId });
    }

    const candidateKeys = lastNDates(90).map((d) => `ask:log:${d}:${targetRequestId}`);

    let deleted = 0;
    try {
      deleted = await getRedis().del(...candidateKeys);
    } catch (kvErr) {
      log.error('forget KV delete failed', { requestId, targetRequestId, err: kvErr });
      return err({
        requestId,
        status: 503,
        code: 'storage_unavailable',
        message: 'storage unavailable',
      });
    }

    log.info('forget request processed', { requestId, targetRequestId, deleted });
    return ok({ requestId });
  },
});
