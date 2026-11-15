import { type Duration, Ratelimit } from '@upstash/ratelimit';
import { FORGET_WINDOW, FORGET_WINDOW_REQUESTS } from '@/lib/forget-limits';
import { log } from '@/lib/log';
import { getRedis } from '@/lib/redis';
import type { RateLimitIdentifier } from '@/lib/server/rate-limit-key';

export {
  type BudgetRefusalReason,
  type BudgetReservation,
  type BudgetStore,
  getBudgetKey,
  getDailyBudgetKey,
  MONTHLY_BUDGET_USD,
  reserveBudget,
  setBudgetStore,
  settleBudget,
} from '@/lib/ask/budget';
export { createEvalBudgetStore } from '@/lib/eval/budget-store';
export {
  getRedis,
  hasRedisCredentials,
  REDIS_ENV_PAIRS,
  RedisNotConfiguredError,
} from '@/lib/redis';
export { getClientIp } from '@/lib/server/client-ip';

type LimitResult = { success: boolean; reset?: number };

export interface ClientRateLimiter {
  limit(identifier: RateLimitIdentifier): Promise<LimitResult>;
}

export interface GlobalRateLimiter {
  limit(): Promise<LimitResult>;
}

type LimiterSpec = {
  algorithm: 'slidingWindow' | 'fixedWindow';
  limit: number;
  window: Duration;
  prefix: string;
};

const ERROR_LOG_DAILY_CAP = 500;
const ERROR_LOG_IP_DAILY_CAP = 50;
const ERROR_LOG_GLOBAL_KEY = 'global';

const LIMITERS = {
  ask: { algorithm: 'slidingWindow', limit: 8, window: '1 h', prefix: 'rl:ask' },
  contact: { algorithm: 'slidingWindow', limit: 3, window: '10 m', prefix: 'rl:contact' },
  mcp: { algorithm: 'slidingWindow', limit: 60, window: '1 m', prefix: 'rl:mcp' },
  healthz: { algorithm: 'slidingWindow', limit: 120, window: '1 m', prefix: 'rl:healthz' },
  lighthouse: { algorithm: 'slidingWindow', limit: 30, window: '1 m', prefix: 'rl:lighthouse' },
  errorLog: { algorithm: 'slidingWindow', limit: 10, window: '1 m', prefix: 'rl:errlog' },
  errorLogDaily: {
    algorithm: 'fixedWindow',
    limit: ERROR_LOG_DAILY_CAP,
    window: '1 d',
    prefix: 'rl:errlog:day',
  },
  errorLogIpDaily: {
    algorithm: 'fixedWindow',
    limit: ERROR_LOG_IP_DAILY_CAP,
    window: '1 d',
    prefix: 'rl:errlog:ipday',
  },
  forget: {
    algorithm: 'slidingWindow',
    limit: FORGET_WINDOW_REQUESTS,
    window: FORGET_WINDOW,
    prefix: 'rl:forget',
  },
} as const satisfies Record<string, LimiterSpec>;

type LimiterName = keyof typeof LIMITERS;

const limiters = new Map<LimiterName, Ratelimit>();

function limiterFor(name: LimiterName): Ratelimit {
  const cached = limiters.get(name);
  if (cached) return cached;
  const { algorithm, limit, window, prefix } = LIMITERS[name];
  const built = new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit[algorithm](limit, window),
    prefix,
  });
  limiters.set(name, built);
  return built;
}

export function getAskLimit(): ClientRateLimiter {
  return limiterFor('ask');
}

export function getContactLimit(): ClientRateLimiter {
  return limiterFor('contact');
}

export function getMcpLimit(): ClientRateLimiter {
  return limiterFor('mcp');
}

export function getHealthzLimit(): ClientRateLimiter {
  return limiterFor('healthz');
}

export function getLighthouseLimit(): ClientRateLimiter {
  return limiterFor('lighthouse');
}

export function getErrorLogLimit(): ClientRateLimiter {
  return limiterFor('errorLog');
}

let _errorLogDailyLimit: GlobalRateLimiter | undefined;

export function getErrorLogDailyLimit(): GlobalRateLimiter {
  if (!_errorLogDailyLimit) {
    const shared = limiterFor('errorLogDaily');
    _errorLogDailyLimit = { limit: () => shared.limit(ERROR_LOG_GLOBAL_KEY) };
  }
  return _errorLogDailyLimit;
}

export function getErrorLogIpDailyLimit(): ClientRateLimiter {
  return limiterFor('errorLogIpDaily');
}

export function getForgetLimit(): ClientRateLimiter {
  return limiterFor('forget');
}

const QUESTION_HASH_LENGTH = 16;
const DEDUP_LOCK_VALUE = '1';
const DEDUP_LOCK_TTL_S = 60;
const DEDUP_LOCK_ACQUIRED = 'OK';

async function identicalQuestionKey(ipHash: string, question: string): Promise<string> {
  const qBytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(question));
  const qHash = Buffer.from(qBytes).toString('hex').slice(0, QUESTION_HASH_LENGTH);
  return `ask:dedup:${ipHash}:${qHash}`;
}

export async function releaseIdenticalQuestion(ipHash: string, question: string): Promise<void> {
  try {
    await getRedis().del(await identicalQuestionKey(ipHash, question));
  } catch (err) {
    log.error('identical-question release failed, the lock expires on its own', { err });
  }
}

export async function checkIdenticalQuestion(
  ipHash: string,
  question: string,
): Promise<{ allowed: boolean }> {
  try {
    const key = await identicalQuestionKey(ipHash, question);
    const result = await getRedis().set(key, DEDUP_LOCK_VALUE, {
      nx: true,
      ex: DEDUP_LOCK_TTL_S,
    });
    return { allowed: result === DEDUP_LOCK_ACQUIRED };
  } catch (err) {
    log.error('identical-question check failed, allowing', { err });
    return { allowed: true };
  }
}
