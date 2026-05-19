import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { log } from '@/lib/log';

let _redis: Redis | undefined;
let _askLimit: Ratelimit | undefined;
let _contactLimit: Ratelimit | undefined;

export function getRedis(): Redis {
  if (!_redis) _redis = Redis.fromEnv();
  return _redis;
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

let _errorLogLimit: Ratelimit | undefined;

export function getErrorLogLimit(): Ratelimit {
  if (!_errorLogLimit) {
    _errorLogLimit = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(10, '1 m'),
      prefix: 'rl:errlog',
    });
  }
  return _errorLogLimit;
}

let _forgetLimit: Ratelimit | undefined;

export function getForgetLimit(): Ratelimit {
  if (!_forgetLimit) {
    _forgetLimit = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(5, '1 h'),
      prefix: 'rl:forget',
    });
  }
  return _forgetLimit;
}

export function getClientIp(req: import('next/server').NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  );
}

// Monthly token budget — 400,000 tokens ≈ $0.40 at Haiku input pricing.
// Hard cap at 100%; warn at 80%.
const MONTHLY_TOKEN_BUDGET = 400_000;
const BUDGET_WINDOW_S = 60 * 60 * 24 * 32;

export function getBudgetKey(): string {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `ask:tokens:${yyyy}-${mm}`;
}

export async function checkBudget(): Promise<{ allowed: boolean; pct: number }> {
  try {
    const used = (await getRedis().get<number>(getBudgetKey())) ?? 0;
    const pct = used / MONTHLY_TOKEN_BUDGET;
    if (pct >= 1) return { allowed: false, pct };
    if (pct >= 0.8) log.warn('budget approaching cap', { pct });
    return { allowed: true, pct };
  } catch (err) {
    // Fail open: don't block users for Redis infra issues.
    log.error('budget check failed, proceeding without cap', { err });
    return { allowed: true, pct: 0 };
  }
}

export async function incrementBudget(inputTokens: number, outputTokens: number): Promise<void> {
  const total = inputTokens + outputTokens;
  if (total <= 0) return;
  const key = getBudgetKey();
  try {
    const pipe = getRedis().pipeline();
    pipe.incrby(key, total);
    pipe.expire(key, BUDGET_WINDOW_S, 'NX');
    await pipe.exec<[number, number]>();
  } catch (err) {
    log.error('budget increment failed', { err });
  }
}
