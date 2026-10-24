import 'server-only';

import { getRedis } from '@/lib/rate-limit';

const OUTBOX_KEY = 'contact:outbox';
const ATTEMPTS_KEY = 'contact:outbox:attempts';
const FIRST_PENDING_INDEX = 0;
const LAST_PENDING_INDEX = -1;
const INITIAL_ATTEMPTS = 0;
const ATTEMPT_INCREMENT = 1;
const INCREMENT_PENDING_ATTEMPTS = `
if redis.call('ZSCORE', KEYS[1], ARGV[1]) == false then
  return nil
end
return redis.call('HINCRBY', KEYS[2], ARGV[1], ARGV[2])
`;

export const CONTACT_MESSAGE_TTL_SECONDS = 60 * 60 * 24 * 90;
export const CONTACT_MAX_RETRY_ATTEMPTS = 3;
export const CONTACT_MAX_RETRY_AGE_MS = 7 * 24 * 60 * 60 * 1_000;

export interface ContactMessage {
  name: string;
  email: string;
  message: string;
  receivedAt: string;
  ipHash: string;
}

export const contactMessageKey = (msgId: string) => `contact:msg:${msgId}`;

export async function enqueueContact(msgId: string, receivedAt: string): Promise<void> {
  const transaction = getRedis().multi();
  transaction.hset(ATTEMPTS_KEY, { [msgId]: INITIAL_ATTEMPTS });
  transaction.zadd(OUTBOX_KEY, { member: msgId, score: Date.parse(receivedAt) });
  await transaction.exec();
}

export function getPendingContactIds(): Promise<string[]> {
  return getRedis().zrange<string[]>(OUTBOX_KEY, FIRST_PENDING_INDEX, LAST_PENDING_INDEX);
}

export function getContactMessage(msgId: string): Promise<ContactMessage | null> {
  return getRedis().get<ContactMessage>(contactMessageKey(msgId));
}

export async function getContactAttempts(msgId: string): Promise<number> {
  return (await getRedis().hget<number>(ATTEMPTS_KEY, msgId)) ?? INITIAL_ATTEMPTS;
}

export function incrementContactAttempts(msgId: string): Promise<number | null> {
  return getRedis().eval<[string, number], number | null>(
    INCREMENT_PENDING_ATTEMPTS,
    [OUTBOX_KEY, ATTEMPTS_KEY],
    [msgId, ATTEMPT_INCREMENT],
  );
}

export async function removePendingContact(msgId: string): Promise<void> {
  const transaction = getRedis().multi();
  transaction.zrem(OUTBOX_KEY, msgId);
  transaction.hdel(ATTEMPTS_KEY, msgId);
  await transaction.exec();
}
