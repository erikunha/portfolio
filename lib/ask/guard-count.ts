import 'server-only';

import { dailyCounterKey, incrementDailyCounter } from '@/lib/ask/daily-counter';
import type { GuardFinding } from '@/lib/ask/output-guard';
import { log } from '@/lib/log';
import { describeError } from '@/lib/log-error';

const GUARD_COUNTER_PREFIX = 'ask:guard';

export function askGuardKey(date: string, kind: GuardFinding['kind']): string {
  return dailyCounterKey(GUARD_COUNTER_PREFIX, date, kind);
}

export async function countAskGuardFinding(
  kind: GuardFinding['kind'],
  now = new Date(),
): Promise<void> {
  try {
    await incrementDailyCounter(GUARD_COUNTER_PREFIX, kind, now);
  } catch (err) {
    log.error('ask guard counter write failed', { kind, error: describeError(err) });
  }
}
