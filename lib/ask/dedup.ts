import { log } from '@/lib/log';
import { getRedis } from '@/lib/redis';

const QUESTION_HASH_LENGTH = 16;
const DEDUP_LOCK_VALUE = '1';
const DEDUP_LOCK_TTL_S = 60;
const DEDUP_LOCK_ACQUIRED = 'OK';

async function identicalQuestionKey(ipHash: string, question: string): Promise<string> {
  const qBytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(question));
  const qHash = Buffer.from(qBytes).toString('hex').slice(0, QUESTION_HASH_LENGTH);
  return `ask:dedup:${ipHash}:${qHash}`;
}

export async function releaseIdenticalQuestion(
  ipHash: string | null,
  question: string,
): Promise<void> {
  if (ipHash === null) return;
  try {
    await getRedis().del(await identicalQuestionKey(ipHash, question));
  } catch (err) {
    log.error('identical-question release failed, the lock expires on its own', { err });
  }
}

export async function checkIdenticalQuestion(
  ipHash: string | null,
  question: string,
): Promise<{ allowed: boolean }> {
  if (ipHash === null) return { allowed: true };
  try {
    const key = await identicalQuestionKey(ipHash, question);
    const result = await getRedis().set(key, DEDUP_LOCK_VALUE, {
      nx: true,
      ex: DEDUP_LOCK_TTL_S,
    });
    return { allowed: result === DEDUP_LOCK_ACQUIRED };
  } catch (err) {
    log.error('identical-question check failed, allowing', { err });
    return { allowed: true };
  }
}
