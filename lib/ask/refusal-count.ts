import 'server-only';

import { log } from '@/lib/log';
import { describeError } from '@/lib/log-error';
import { getRedis } from '@/lib/rate-limit';

const ISO_DATE_LENGTH = 10;
const REFUSAL_COUNTER_TTL_S = 32 * 24 * 60 * 60;

export type AskRefusalStatus = 'rate-limited' | 'dedup-rejected' | 'budget-exhausted';

export function askRefusalKey(date: string, status: AskRefusalStatus): string {
  return `ask:refused:${date}:${status}`;
}

export async function countAskRefusal(status: AskRefusalStatus, now = new Date()): Promise<void> {
  const key = askRefusalKey(now.toISOString().slice(0, ISO_DATE_LENGTH), status);
  try {
    const pipe = getRedis().pipeline();
    pipe.incr(key);
    pipe.expire(key, REFUSAL_COUNTER_TTL_S, 'NX');
    await pipe.exec();
  } catch (err) {
    log.error('ask refusal counter write failed', { status, error: describeError(err) });
  }
}
