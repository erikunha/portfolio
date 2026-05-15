import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

let _redis: Redis | undefined;
let _askLimit: Ratelimit | undefined;
let _contactLimit: Ratelimit | undefined;

export function getRedis(): Redis {
  return (_redis ??= Redis.fromEnv());
}

export function getAskLimit(): Ratelimit {
  if (!_askLimit) {
    _askLimit = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(8, '1 h'),
      prefix: 'rl:ask',
    });
  }
  return _askLimit;
}

export function getContactLimit(): Ratelimit {
  if (!_contactLimit) {
    _contactLimit = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(3, '10 m'),
      prefix: 'rl:contact',
    });
  }
  return _contactLimit;
}

// Monthly token budget — 400,000 tokens ≈ $0.40 at Haiku input pricing.
// Hard cap at 100%; warn at 80%.
const MONTHLY_TOKEN_BUDGET = 400_000;

export function getBudgetKey(): string {
  const now  = new Date();
  const yyyy = now.getUTCFullYear();
  const mm   = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `ask:tokens:${yyyy}-${mm}`;
}

export async function checkBudget(): Promise<{ allowed: boolean; pct: number }> {
  try {
    const used = (await getRedis().get<number>(getBudgetKey())) ?? 0;
    const pct  = used / MONTHLY_TOKEN_BUDGET;
    if (pct >= 1)   return { allowed: false, pct };
    if (pct >= 0.8) console.warn(`[ask] budget at ${Math.round(pct * 100)}% — approaching cap`);
    return { allowed: true, pct };
  } catch (err) {
    // Fail open: don't block users for Redis infra issues.
    console.error('[ask] budget check failed, proceeding without cap', err);
    return { allowed: true, pct: 0 };
  }
}

// Fire-and-forget — never awaited on the response path.
export function incrementBudget(inputTokens: number, outputTokens: number): void {
  const total = inputTokens + outputTokens;
  if (total <= 0) return;
  getRedis()
    .incrby(getBudgetKey(), total)
    .then(() => {
      // Set 32-day TTL on first write so the key expires naturally.
      getRedis().expire(getBudgetKey(), 60 * 60 * 24 * 32, 'NX').catch(() => undefined);
    })
    .catch((err) => console.error('[ask] budget increment failed', err));
}
