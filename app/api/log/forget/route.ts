import { z } from 'zod';

import { askLogDatesInTtl, askLogKey } from '@/lib/ask-log';
import { contactMessageKey, removePendingContact } from '@/lib/contact-outbox';
import { log } from '@/lib/log';
import { getForgetLimit, getRedis } from '@/lib/rate-limit';
import { defineHandler, err, ok } from '@/lib/server/route';

const ForgetPayload = z.object({
  requestId: z.string().uuid().toLowerCase(),
});

const MAX_FORGET_BODY_BYTES = 1024;
const SMOKE_UUID = '00000000-0000-4000-8000-000000000000';

const handleForget = defineHandler({
  schema: ForgetPayload,
  maxBodyBytes: MAX_FORGET_BODY_BYTES,
  rateLimit: getForgetLimit,
  rateLimitErrorMessage: 'too many forget requests',
  async handler({ body, requestId }) {
    const { requestId: targetRequestId } = body;

    if (targetRequestId === SMOKE_UUID) {
      return ok({ requestId });
    }

    const candidateKeys = [
      ...askLogDatesInTtl(new Date()).map((date) => askLogKey(date, targetRequestId)),
      contactMessageKey(targetRequestId),
    ];

    let deleted = 0;
    try {
      deleted = await getRedis().del(...candidateKeys);
      await removePendingContact(targetRequestId);
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

export const POST = handleForget;
