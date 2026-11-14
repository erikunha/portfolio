import { z } from 'zod';

import {
  askConversationKey,
  askLogDatesInTtl,
  askLogKey,
  isAskLogKey,
  markForgotten,
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
const DELETE_CHUNK_SIZE = 100;
const SMOKE_UUID = '00000000-0000-4000-8000-000000000000';

type ConversationScope = { conversationId: string | null; keys: string[] };

async function conversationScope(requestKeys: readonly string[]): Promise<ConversationScope> {
  const redis = getRedis();
  const stored = await redis.mget<unknown[]>(...requestKeys);
  const conversationId = storedConversationId(stored);
  if (conversationId === null) return { conversationId, keys: [] };
  const index = askConversationKey(conversationId);
  const members = await redis.smembers(index);
  return { conversationId, keys: [...members.filter(isAskLogKey), index] };
}

async function deleteInChunks(keys: readonly string[]): Promise<number> {
  const redis = getRedis();
  let deleted = 0;
  for (let start = 0; start < keys.length; start += DELETE_CHUNK_SIZE) {
    deleted += await redis.del(...keys.slice(start, start + DELETE_CHUNK_SIZE));
  }
  return deleted;
}

async function markForgottenBestEffort(ids: readonly string[], requestId: string): Promise<void> {
  try {
    await markForgotten(ids);
  } catch (markErr) {
    log.error('forget tombstone write failed', { requestId, err: markErr });
  }
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
      await markForgottenBestEffort([targetRequestId], requestId);
      const scope = await conversationScope(requestKeys);
      conversation = scope.keys.length > 0;
      if (scope.conversationId !== null) {
        await markForgottenBestEffort([scope.conversationId], requestId);
      }
      const candidateKeys = [
        ...new Set([...requestKeys, ...scope.keys, contactMessageKey(targetRequestId)]),
      ];
      deleted = await deleteInChunks(candidateKeys);
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
