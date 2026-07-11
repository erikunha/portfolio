import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { log } from '@/lib/log';

let _redis: Redis | undefined;
let _askLimit: Ratelimit | undefined;
let _contactLimit: Ratelimit | undefined;

export function getRedis(): Redis {
  if (_redis) return _redis;
  const instance = Redis.fromEnv();
  _redis = instance;
  return instance;
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

let _healthzLimit: Ratelimit | undefined;

export function getHealthzLimit(): Ratelimit {
  if (!_healthzLimit) {
    _healthzLimit = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(120, '1 m'),
      prefix: 'rl:healthz',
    });
  }
  return _healthzLimit;
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

const MONTHLY_TOKEN_BUDGET = 3_000_000;
const BUDGET_WINDOW_S = 60 * 60 * 24 * 32;

const RESERVED_INPUT_TOKENS = 2200;

export function getBudgetKey(): string {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `ask:tokens:${yyyy}-${mm}`;
}

export async function reserveBudget(
  maxOutputTokens: number,
): Promise<{ allowed: boolean; reserved: number; pct: number; budgetKey: string }> {
  const reserved = RESERVED_INPUT_TOKENS + maxOutputTokens;
  const budgetKey = getBudgetKey();
  try {
    const pipe = getRedis().pipeline();
    pipe.incrby(budgetKey, reserved);
    pipe.expire(budgetKey, BUDGET_WINDOW_S, 'NX');
    const [used] = await pipe.exec<[number, number]>();
    const pct = used / MONTHLY_TOKEN_BUDGET;
    if (pct > 1) {
      try {
        await getRedis().decrby(budgetKey, reserved);
      } catch (refundErr) {
        log.error('budget reservation refund-on-reject failed', { err: refundErr });
      }
      return { allowed: false, reserved: 0, pct, budgetKey };
    }
    if (pct >= 0.8) log.warn('budget approaching cap', { pct });
    return { allowed: true, reserved, pct, budgetKey };
  } catch (err) {
    log.error('budget reservation failed, proceeding without cap', { err });
    return { allowed: true, reserved: 0, pct: 0, budgetKey };
  }
}

export async function settleBudget(
  reserved: number,
  actualInputTokens: number,
  actualOutputTokens: number,
  budgetKey: string,
): Promise<void> {
  if (reserved <= 0) {
    log.warn(
      'budget settlement skipped — reserved=0 (Redis fail-open bypassed cap for this request)',
      { budgetKey },
    );
    return;
  }
  const actual = actualInputTokens + actualOutputTokens;
  const refund = reserved - actual;
  if (refund <= 0) return;
  try {
    await getRedis().decrby(budgetKey, refund);
  } catch (err) {
    log.error('budget settlement refund failed', { err });
  }
}

export async function checkIdenticalQuestion(
  ipHash: string,
  question: string,
): Promise<{ allowed: boolean }> {
  try {
    const qBytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(question));
    const qHash = Buffer.from(qBytes).toString('hex').slice(0, 16);
    const key = `ask:dedup:${ipHash}:${qHash}`;
    const result = await getRedis().set(key, '1', { nx: true, ex: 60 });
    return { allowed: result === 'OK' };
  } catch (err) {
    log.error('identical-question check failed, allowing', { err });
    return { allowed: true };
  }
}
