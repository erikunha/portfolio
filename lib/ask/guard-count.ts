import 'server-only';

import type { GuardFinding } from '@/lib/ask/output-guard';
import { log } from '@/lib/log';
import { getRedis } from '@/lib/rate-limit';

const ISO_DATE_LENGTH = 10;
const GUARD_COUNTER_TTL_S = 32 * 24 * 60 * 60;

export function askGuardKey(date: string, kind: GuardFinding['kind']): string {
  return `ask:guard:${date}:${kind}`;
}

export async function countAskGuardFinding(
  kind: GuardFinding['kind'],
  now = new Date(),
): Promise<void> {
  const key = askGuardKey(now.toISOString().slice(0, ISO_DATE_LENGTH), kind);
  try {
    const pipe = getRedis().pipeline();
    pipe.incr(key);
    pipe.expire(key, GUARD_COUNTER_TTL_S, 'NX');
    await pipe.exec();
  } catch (err) {
    log.error('ask guard counter write failed', { kind, err });
  }
}
