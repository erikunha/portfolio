import 'server-only';

import { getRedis } from '@/lib/rate-limit';
import { utcDay } from '@/lib/time';

const COUNTER_TTL_DAYS = 32;
export const MONTH_TTL_S = COUNTER_TTL_DAYS * 24 * 60 * 60;

export function dailyCounterKey(prefix: string, date: string, key: string): string {
  return `${prefix}:${date}:${key}`;
}

export async function incrementDailyCounter(
  prefix: string,
  key: string,
  now = new Date(),
): Promise<void> {
  const redisKey = dailyCounterKey(prefix, utcDay(now), key);
  const pipe = getRedis().pipeline();
  pipe.incr(redisKey);
  pipe.expire(redisKey, MONTH_TTL_S, 'NX');
  await pipe.exec();
}
