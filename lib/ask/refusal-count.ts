import 'server-only';

import { dailyCounterKey, incrementDailyCounter } from '@/lib/ask/daily-counter';
import { log } from '@/lib/log';
import { describeError } from '@/lib/log-error';

const REFUSAL_COUNTER_PREFIX = 'ask:refused';

export type AskRefusalStatus =
  | 'rate-limited'
  | 'dedup-rejected'
  | 'budget-exhausted'
  | 'budget-store-unavailable';

export function askRefusalKey(date: string, status: AskRefusalStatus): string {
  return dailyCounterKey(REFUSAL_COUNTER_PREFIX, date, status);
}

export async function countAskRefusal(status: AskRefusalStatus, now = new Date()): Promise<void> {
  try {
    await incrementDailyCounter(REFUSAL_COUNTER_PREFIX, status, now);
  } catch (err) {
    log.error('ask refusal counter write failed', { status, error: describeError(err) });
  }
}
