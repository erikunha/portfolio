import { isIP } from 'node:net';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis, type Requester } from '@upstash/redis';
import { askReservationCost } from '@/lib/ask/input-reservation';
import { ASK_MAX_OUTPUT_TOKENS } from '@/lib/ask/limits';
import { ASK_BUDGET_UNITS_PER_USD, askBudgetCost } from '@/lib/ask/usage';
import { FORGET_WINDOW, FORGET_WINDOW_REQUESTS } from '@/lib/forget-limits';
import { log } from '@/lib/log';
import type { RateLimitIdentifier } from '@/lib/server/rate-limit-key';

const REDIS_RETRIES = 1;
const REDIS_RETRY_BACKOFF_MS = 50;

type LimitResult = { success: boolean; reset?: number };

export interface ClientRateLimiter {
  limit(identifier: RateLimitIdentifier): Promise<LimitResult>;
}

export interface GlobalRateLimiter {
  limit(): Promise<LimitResult>;
}

let _redis: Redis | undefined;
let _askLimit: Ratelimit | undefined;
let _contactLimit: Ratelimit | undefined;

export const REDIS_ENV_PAIRS = [
  { url: 'UPSTASH_REDIS_REST_URL', token: 'UPSTASH_REDIS_REST_TOKEN' },
  { url: 'KV_REST_API_URL', token: 'KV_REST_API_TOKEN' },
] as const;
const REDIS_ENV_NAMES = REDIS_ENV_PAIRS.map(({ url, token }) => `${url} and ${token}`).join(' or ');

export class RedisNotConfiguredError extends Error {
  constructor() {
    super(`Redis is not configured: ${REDIS_ENV_NAMES} must be set`);
    this.name = 'RedisNotConfiguredError';
  }
}

const notConfiguredRequester: Requester = {
  request: () => Promise.reject(new RedisNotConfiguredError()),
};

function rejectedClient(): Redis {
  return new Redis(notConfiguredRequester);
}

export function hasRedisCredentials(): boolean {
  return REDIS_ENV_PAIRS.some(({ url, token }) => Boolean(process.env[url] && process.env[token]));
}

export function getRedis(): Redis {
  if (_redis) return _redis;
  if (!hasRedisCredentials()) return rejectedClient();
  const instance = Redis.fromEnv({
    retry: { retries: REDIS_RETRIES, backoff: () => REDIS_RETRY_BACKOFF_MS },
  });
  _redis = instance;
  return instance;
}

export function getAskLimit(): ClientRateLimiter {
  if (!_askLimit) {
    _askLimit = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(8, '1 h'),
      prefix: 'rl:ask',
    });
  }
  return _askLimit;
}

export function getContactLimit(): ClientRateLimiter {
  if (!_contactLimit) {
    _contactLimit = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(3, '10 m'),
      prefix: 'rl:contact',
    });
  }
  return _contactLimit;
}

const MCP_LIMIT_REQUESTS = 60;

let _mcpLimit: Ratelimit | undefined;

export function getMcpLimit(): ClientRateLimiter {
  if (!_mcpLimit) {
    _mcpLimit = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(MCP_LIMIT_REQUESTS, '1 m'),
      prefix: 'rl:mcp',
    });
  }
  return _mcpLimit;
}

let _healthzLimit: Ratelimit | undefined;

export function getHealthzLimit(): ClientRateLimiter {
  if (!_healthzLimit) {
    _healthzLimit = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(120, '1 m'),
      prefix: 'rl:healthz',
    });
  }
  return _healthzLimit;
}

let _lighthouseLimit: Ratelimit | undefined;

export function getLighthouseLimit(): ClientRateLimiter {
  if (!_lighthouseLimit) {
    _lighthouseLimit = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(30, '1 m'),
      prefix: 'rl:lighthouse',
    });
  }
  return _lighthouseLimit;
}

let _errorLogLimit: Ratelimit | undefined;

export function getErrorLogLimit(): ClientRateLimiter {
  if (!_errorLogLimit) {
    _errorLogLimit = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(10, '1 m'),
      prefix: 'rl:errlog',
    });
  }
  return _errorLogLimit;
}

const ERROR_LOG_DAILY_CAP = 500;
const ERROR_LOG_IP_DAILY_CAP = 50;

const ERROR_LOG_GLOBAL_KEY = 'global';

let _errorLogDailyLimit: GlobalRateLimiter | undefined;

export function getErrorLogDailyLimit(): GlobalRateLimiter {
  if (!_errorLogDailyLimit) {
    const shared = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.fixedWindow(ERROR_LOG_DAILY_CAP, '1 d'),
      prefix: 'rl:errlog:day',
    });
    _errorLogDailyLimit = { limit: () => shared.limit(ERROR_LOG_GLOBAL_KEY) };
  }
  return _errorLogDailyLimit;
}

let _errorLogIpDailyLimit: Ratelimit | undefined;

export function getErrorLogIpDailyLimit(): ClientRateLimiter {
  if (!_errorLogIpDailyLimit) {
    _errorLogIpDailyLimit = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.fixedWindow(ERROR_LOG_IP_DAILY_CAP, '1 d'),
      prefix: 'rl:errlog:ipday',
    });
  }
  return _errorLogIpDailyLimit;
}

let _forgetLimit: Ratelimit | undefined;

export function getForgetLimit(): ClientRateLimiter {
  if (!_forgetLimit) {
    _forgetLimit = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(FORGET_WINDOW_REQUESTS, FORGET_WINDOW),
      prefix: 'rl:forget',
    });
  }
  return _forgetLimit;
}

const UNKNOWN_CLIENT_IP = 'unknown';
const IPV6_GROUP_COUNT = 8;
const IPV6_PREFIX_GROUPS = 4;
const IPV6_HEX_RADIX = 16;
const IPV4_MAPPED_PREFIX = '::ffff:';
const IPV4_OCTET_BITS = 8;
const IP_KIND = { invalid: 0, v4: 4 } as const;

function ipv4ToGroups(ipv4: string): string[] {
  const [a = 0, b = 0, c = 0, d = 0] = ipv4.split('.').map(Number);
  const high = (a << IPV4_OCTET_BITS) | b;
  const low = (c << IPV4_OCTET_BITS) | d;
  return [high.toString(IPV6_HEX_RADIX), low.toString(IPV6_HEX_RADIX)];
}

function ipv6Groups(ip: string): string[] {
  const dotted = ip.match(/^(.*:)(\d+\.\d+\.\d+\.\d+)$/);
  const text = dotted ? `${dotted[1]}${ipv4ToGroups(dotted[2] ?? '').join(':')}` : ip;
  const [head = '', tail] = text.split('::');
  const headGroups = head ? head.split(':') : [];
  const tailGroups = tail ? tail.split(':') : [];
  const missing = IPV6_GROUP_COUNT - headGroups.length - tailGroups.length;
  const fill = tail === undefined ? [] : Array<string>(missing).fill('0');
  return [...headGroups, ...fill, ...tailGroups].map((group) =>
    Number.parseInt(group, IPV6_HEX_RADIX).toString(IPV6_HEX_RADIX),
  );
}

function rateLimitBucket(ip: string): string {
  const kind = isIP(ip);
  if (kind === IP_KIND.invalid) return UNKNOWN_CLIENT_IP;
  if (kind === IP_KIND.v4) return ip;
  if (
    ip.toLowerCase().startsWith(IPV4_MAPPED_PREFIX) &&
    isIP(ip.slice(IPV4_MAPPED_PREFIX.length)) === IP_KIND.v4
  ) {
    return ip.slice(IPV4_MAPPED_PREFIX.length);
  }
  return `${ipv6Groups(ip).slice(0, IPV6_PREFIX_GROUPS).join(':')}::/64`;
}

export function getClientIp(req: { headers: Headers }): string {
  const raw =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? req.headers.get('x-real-ip');
  return raw ? rateLimitBucket(raw) : UNKNOWN_CLIENT_IP;
}

export const MONTHLY_BUDGET_USD = 3;
const DAILY_BUDGET_DIVISOR = 20;
const MONTHLY_BUDGET_UNITS = MONTHLY_BUDGET_USD * ASK_BUDGET_UNITS_PER_USD;
const DAILY_BUDGET_UNITS = MONTHLY_BUDGET_UNITS / DAILY_BUDGET_DIVISOR;
const BUDGET_WINDOW_S = 60 * 60 * 24 * 32;
const DAILY_BUDGET_WINDOW_S = 60 * 60 * 24 * 2;

const BUDGET_WARN_PCT = 0.8;
const ISO_DATE_LENGTH = 10;

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
  return `ask:spend:day:${new Date().toISOString().slice(0, ISO_DATE_LENGTH)}`;
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

async function identicalQuestionKey(ipHash: string, question: string): Promise<string> {
  const qBytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(question));
  const qHash = Buffer.from(qBytes).toString('hex').slice(0, 16);
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
    const result = await getRedis().set(key, '1', { nx: true, ex: 60 });
    return { allowed: result === 'OK' };
  } catch (err) {
    log.error('identical-question check failed, allowing', { err });
    return { allowed: true };
  }
}
