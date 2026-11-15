import { type Duration, Ratelimit } from '@upstash/ratelimit';
import { askReservationCost } from '@/lib/ask/input-reservation';
import { ASK_MAX_OUTPUT_TOKENS } from '@/lib/ask/limits';
import { ASK_BUDGET_UNITS_PER_USD, askBudgetCost } from '@/lib/ask/usage';
import { FORGET_WINDOW, FORGET_WINDOW_REQUESTS } from '@/lib/forget-limits';
import { log } from '@/lib/log';
import { getRedis } from '@/lib/redis';
import type { RateLimitIdentifier } from '@/lib/server/rate-limit-key';
import { utcDay } from '@/lib/time';

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

export const MONTHLY_BUDGET_USD = 3;
const DAILY_BUDGET_DIVISOR = 20;
const MONTHLY_BUDGET_UNITS = MONTHLY_BUDGET_USD * ASK_BUDGET_UNITS_PER_USD;
const DAILY_BUDGET_UNITS = MONTHLY_BUDGET_UNITS / DAILY_BUDGET_DIVISOR;
const BUDGET_WINDOW_S = 60 * 60 * 24 * 32;
const DAILY_BUDGET_WINDOW_S = 60 * 60 * 24 * 2;

const BUDGET_WARN_PCT = 0.8;

export type BudgetStore = {
  capacity: number;
  dailyCapacity: number;
  reserve(budgetKey: string, tokens: number, windowSeconds?: number): Promise<number>;
  release(budgetKey: string, tokens: number): Promise<void>;
  chargeOverage(budgetKey: string, tokens: number): Promise<void>;
};

const redisBudgetStore: BudgetStore = {
  capacity: MONTHLY_BUDGET_UNITS,
  dailyCapacity: DAILY_BUDGET_UNITS,
  async reserve(budgetKey, tokens, windowSeconds = BUDGET_WINDOW_S) {
    const pipe = getRedis().pipeline();
    pipe.incrby(budgetKey, tokens);
    pipe.expire(budgetKey, windowSeconds, 'NX');
    const [used] = await pipe.exec<[number, number]>();
    return used;
  },
  async release(budgetKey, tokens) {
    await getRedis().decrby(budgetKey, tokens);
  },
  async chargeOverage(budgetKey, tokens) {
    await getRedis().incrby(budgetKey, tokens);
  },
};

let budgetStore: BudgetStore = redisBudgetStore;

export function setBudgetStore(store: BudgetStore): void {
  budgetStore = store;
}

export function createEvalBudgetStore(requests: number): BudgetStore {
  const used = new Map<string, number>();
  const capacity = requests * askReservationCost(ASK_MAX_OUTPUT_TOKENS);
  return {
    capacity,
    dailyCapacity: capacity,
    async reserve(budgetKey, tokens) {
      const total = (used.get(budgetKey) ?? 0) + tokens;
      used.set(budgetKey, total);
      return total;
    },
    async release(budgetKey, tokens) {
      used.set(budgetKey, (used.get(budgetKey) ?? 0) - tokens);
    },
    chargeOverage: async () => undefined,
  };
}

export function getBudgetKey(): string {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `ask:spend:${yyyy}-${mm}`;
}

export function getDailyBudgetKey(): string {
  return `ask:spend:day:${utcDay(new Date())}`;
}

export type BudgetRefusalReason = 'month' | 'day' | 'store';

type BudgetReservationKeys = {
  reserved: number;
  pct: number;
  budgetKey: string;
  dailyKey: string;
};

export type BudgetReservation =
  | ({ allowed: true } & BudgetReservationKeys)
  | ({ allowed: false; reason: BudgetRefusalReason } & BudgetReservationKeys);

async function refundReservation(keys: string[], tokens: number): Promise<void> {
  for (const key of keys) {
    try {
      await budgetStore.release(key, tokens);
    } catch (refundErr) {
      log.error('budget reservation refund-on-reject failed', { key, err: refundErr });
    }
  }
}

export async function reserveBudget(maxOutputTokens: number): Promise<BudgetReservation> {
  const reserved = askReservationCost(maxOutputTokens);
  const budgetKey = getBudgetKey();
  const dailyKey = getDailyBudgetKey();
  const denied = (reason: BudgetRefusalReason, pct: number): BudgetReservation => ({
    allowed: false,
    reason,
    reserved: 0,
    pct,
    budgetKey,
    dailyKey,
  });
  try {
    const monthlyPct = (await budgetStore.reserve(budgetKey, reserved)) / budgetStore.capacity;
    if (monthlyPct > 1) {
      await refundReservation([budgetKey], reserved);
      return denied('month', monthlyPct);
    }
    let dailyPct: number;
    try {
      dailyPct =
        (await budgetStore.reserve(dailyKey, reserved, DAILY_BUDGET_WINDOW_S)) /
        budgetStore.dailyCapacity;
    } catch (dailyErr) {
      await refundReservation([budgetKey], reserved);
      throw dailyErr;
    }
    if (dailyPct > 1) {
      await refundReservation([budgetKey, dailyKey], reserved);
      log.warn('daily budget slice exhausted', { dailyPct, monthlyPct });
      return denied('day', Math.max(monthlyPct, dailyPct));
    }
    const pct = Math.max(monthlyPct, dailyPct);
    if (pct >= BUDGET_WARN_PCT) log.warn('budget approaching cap', { monthlyPct, dailyPct });
    return { allowed: true, reserved, pct, budgetKey, dailyKey };
  } catch (err) {
    log.error('budget reservation failed, rejecting request', { err });
    return denied('store', 0);
  }
}

export async function settleBudget(
  reserved: number,
  actualInputTokens: number,
  actualOutputTokens: number,
  budgetKey: string,
  dailyKey?: string,
  cache: { cacheReadTokens: number; cacheWriteTokens: number } = {
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
  },
): Promise<void> {
  if (reserved <= 0) {
    log.warn('budget settlement skipped: no positive reservation', { budgetKey });
    return;
  }
  const actual = askBudgetCost({
    billedInputTokens: actualInputTokens,
    outputTokens: actualOutputTokens,
    ...cache,
  });
  const refund = reserved - actual;
  if (refund === 0) return;
  const keys = dailyKey === undefined ? [budgetKey] : [budgetKey, dailyKey];
  for (const key of keys) {
    if (refund < 0) {
      try {
        await budgetStore.chargeOverage(key, -refund);
      } catch (err) {
        log.error('budget settlement overage charge failed', { key, err });
      }
    } else {
      try {
        await budgetStore.release(key, refund);
      } catch (err) {
        log.error('budget settlement refund failed', { key, err });
      }
    }
  }
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
