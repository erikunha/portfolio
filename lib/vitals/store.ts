import type { Redis } from '@upstash/redis';

import { HOURS_PER_DAY, isoWeek, SECONDS_PER_HOUR } from '@/lib/time';
import type { VitalRecord } from '@/lib/vitals/records';

const VITALS_KEY_PREFIX = 'vitals';
const KEY_SEPARATOR = ':';
const TTL_DAYS = 21;

export const VITALS_TTL_S = TTL_DAYS * HOURS_PER_DAY * SECONDS_PER_HOUR;
export const VITALS_WEEK_MAX_RECORDS = 6000;

export function weekCapWarning(count: number): string | undefined {
  return count >= VITALS_WEEK_MAX_RECORDS
    ? `warning: the week list is at its ${VITALS_WEEK_MAX_RECORDS} record cap, the oldest records are dropped`
    : undefined;
}

export function vitalsKey(week: string): string {
  return `${VITALS_KEY_PREFIX}${KEY_SEPARATOR}${week}`;
}

export async function storeVitals(
  redis: Pick<Redis, 'multi'>,
  records: readonly VitalRecord[],
  now: Date,
): Promise<void> {
  if (records.length === 0) return;
  const key = vitalsKey(isoWeek(now));
  await redis
    .multi()
    .lpush(key, ...records.map((record) => JSON.stringify(record)))
    .ltrim(key, 0, VITALS_WEEK_MAX_RECORDS - 1)
    .expire(key, VITALS_TTL_S)
    .exec();
}
