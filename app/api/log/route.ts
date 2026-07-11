import { z } from 'zod';

import { log } from '@/lib/log';
import { getErrorLogLimit, getRedis } from '@/lib/rate-limit';
import { defineHandler, err, ok } from '@/lib/server/route';

const SMOKE_PREFIX = '[smoke]';

const ERR_KV_TTL_S = 30 * 24 * 60 * 60;

const ErrorPayload = z.object({
  level: z.enum(['error', 'warn']),
  message: z.string().min(1).max(2000),
  stack: z.string().max(16000).optional(),
  url: z.string().max(2000).optional(),
  userAgent: z.string().max(500).optional(),
  ts: z.string().optional(),
});

export const POST = defineHandler({
  schema: ErrorPayload,
  rateLimit: getErrorLogLimit,
  rateLimitErrorMessage: 'too many error reports',
  async handler({ body, requestId }) {
    if (body.message.toLowerCase().startsWith(SMOKE_PREFIX)) {
      return ok({ requestId });
    }

    const errId = crypto.randomUUID();
    const today = new Date().toISOString().slice(0, 10);
    const key = `err:${today}:${errId}`;

    const record = {
      ...body,
      errId,
      capturedAt: new Date().toISOString(),
    };

    try {
      await getRedis().set(key, JSON.stringify(record), { ex: ERR_KV_TTL_S });
    } catch (kvErr) {
      log.error('error-log KV write failed', { requestId, errId, err: kvErr });
      return err({
        requestId,
        status: 503,
        code: 'storage_unavailable',
        message: 'storage unavailable',
      });
    }

    return ok({ requestId });
  },
});
