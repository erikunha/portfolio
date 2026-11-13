import { z } from 'zod';

import {
  askConversationKey,
  askLogDatesInTtl,
  askLogKey,
  isAskLogKey,
  storedConversationId,
} from '@/lib/ask-log';
import { contactMessageKey, removePendingContact } from '@/lib/contact-outbox';
import { log } from '@/lib/log';
import { getForgetLimit, getRedis } from '@/lib/rate-limit';
import { defineHandler, err, ok } from '@/lib/server/route';

const ForgetPayload = z.object({
  requestId: z.uuid().toLowerCase(),
});

const MAX_FORGET_BODY_BYTES = 1024;
const SMOKE_UUID = '00000000-0000-4000-8000-000000000000';

async function conversationKeys(requestKeys: readonly string[]): Promise<string[]> {
  const redis = getRedis();
  const stored = await redis.mget<unknown[]>(...requestKeys);
  const conversationId = storedConversationId(stored);
  if (conversationId === null) return [];
  const index = askConversationKey(conversationId);
  const members = await redis.smembers(index);
  return [...members.filter(isAskLogKey), index];
}

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

    const requestKeys = askLogDatesInTtl(new Date()).map((date) =>
      askLogKey(date, targetRequestId),
    );

    let deleted = 0;
    let conversation = false;
    try {
      const siblings = await conversationKeys(requestKeys);
      conversation = siblings.length > 0;
      const candidateKeys = [
        ...new Set([...requestKeys, ...siblings, contactMessageKey(targetRequestId)]),
      ];
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

    log.info('forget request processed', { requestId, targetRequestId, deleted, conversation });
    return ok({ requestId });
  },
});

export const POST = handleForget;
