import { z } from 'zod';

import { log } from '@/lib/log';
import {
  getErrorLogDailyLimit,
  getErrorLogIpDailyLimit,
  getErrorLogLimit,
  getRedis,
} from '@/lib/rate-limit';
import { defineHandler, err, ok } from '@/lib/server/route';

const SMOKE_PREFIX = '[smoke]';
const MAX_LOG_BODY_BYTES = 32_768;

const ERR_KV_TTL_S = 7 * 24 * 60 * 60;
const MAX_STORED_STACK_CHARS = 4096;
const MAX_TS_LENGTH = 64;

const ErrorPayload = z.object({
  level: z.enum(['error', 'warn']),
  message: z.string().min(1).max(2000),
  stack: z.string().max(16000).optional(),
  url: z.string().max(2000).optional(),
  userAgent: z.string().max(500).optional(),
  ts: z.string().max(MAX_TS_LENGTH).optional(),
});

const handleLog = defineHandler({
  schema: ErrorPayload,
  maxBodyBytes: MAX_LOG_BODY_BYTES,
  rateLimit: getErrorLogLimit,
  rateLimitErrorMessage: 'too many error reports',
  async handler({ body, ipHash, requestId }) {
    if (body.message.toLowerCase().startsWith(SMOKE_PREFIX)) {
      return ok({ requestId });
    }

    try {
      const { success: underIpDailyCap } = await getErrorLogIpDailyLimit().limit(ipHash);
      if (!underIpDailyCap) {
        log.warn('error-log per-IP daily cap reached, dropping record', { requestId });
        return ok({ requestId });
      }
    } catch (capErr) {
      log.warn('error-log per-IP daily cap unavailable, recording anyway', {
        requestId,
        err: capErr,
      });
    }

    try {
      const { success: underDailyCap } = await getErrorLogDailyLimit().limit();
      if (!underDailyCap) {
        log.warn('error-log daily cap reached, dropping record', { requestId });
        return ok({ requestId });
      }
    } catch (capErr) {
      log.warn('error-log daily cap unavailable, recording anyway', { requestId, err: capErr });
    }

    const errId = crypto.randomUUID();
    const today = new Date().toISOString().slice(0, 10);
    const key = `err:${today}:${errId}`;

    const record = {
      ...body,
      ...(body.stack === undefined ? {} : { stack: body.stack.slice(0, MAX_STORED_STACK_CHARS) }),
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

export const POST = handleLog;
