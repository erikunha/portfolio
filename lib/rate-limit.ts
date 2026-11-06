import { isIP } from 'node:net';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis, type Requester } from '@upstash/redis';
import { ASK_MAX_OUTPUT_TOKENS } from '@/lib/ask/limits';
import { log } from '@/lib/log';

const REDIS_RETRIES = 1;
const REDIS_RETRY_BACKOFF_MS = 50;

let _redis: Redis | undefined;
let _askLimit: Ratelimit | undefined;
let _contactLimit: Ratelimit | undefined;

const REDIS_ENV_PAIRS = [
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

export function getClientIp(req: import('next/server').NextRequest): string {
  const raw =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? req.headers.get('x-real-ip');
  return raw ? rateLimitBucket(raw) : UNKNOWN_CLIENT_IP;
}

const MONTHLY_TOKEN_BUDGET = 3_000_000;
const BUDGET_WINDOW_S = 60 * 60 * 24 * 32;

const RESERVED_INPUT_TOKENS = 2200;

export type BudgetStore = {
  capacity: number;
  reserve(budgetKey: string, tokens: number): Promise<number>;
  release(budgetKey: string, tokens: number): Promise<void>;
};

const redisBudgetStore: BudgetStore = {
  capacity: MONTHLY_TOKEN_BUDGET,
  async reserve(budgetKey, tokens) {
    const pipe = getRedis().pipeline();
    pipe.incrby(budgetKey, tokens);
    pipe.expire(budgetKey, BUDGET_WINDOW_S, 'NX');
    const [used] = await pipe.exec<[number, number]>();
    return used;
  },
  async release(budgetKey, tokens) {
    await getRedis().decrby(budgetKey, tokens);
  },
};

let budgetStore: BudgetStore = redisBudgetStore;

export function setBudgetStore(store: BudgetStore): void {
  budgetStore = store;
}

export function createEvalBudgetStore(requests: number): BudgetStore {
  const used = new Map<string, number>();
  return {
    capacity: requests * (RESERVED_INPUT_TOKENS + ASK_MAX_OUTPUT_TOKENS),
    async reserve(budgetKey, tokens) {
      const total = (used.get(budgetKey) ?? 0) + tokens;
      used.set(budgetKey, total);
      return total;
    },
    async release(budgetKey, tokens) {
      used.set(budgetKey, (used.get(budgetKey) ?? 0) - tokens);
    },
  };
}

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
    const used = await budgetStore.reserve(budgetKey, reserved);
    const pct = used / budgetStore.capacity;
    if (pct > 1) {
      try {
        await budgetStore.release(budgetKey, reserved);
      } catch (refundErr) {
        log.error('budget reservation refund-on-reject failed', { err: refundErr });
      }
      return { allowed: false, reserved: 0, pct, budgetKey };
    }
    if (pct >= 0.8) log.warn('budget approaching cap', { pct });
    return { allowed: true, reserved, pct, budgetKey };
  } catch (err) {
    log.error('budget reservation failed, rejecting request', { err });
    return { allowed: false, reserved: 0, pct: 0, budgetKey };
  }
}

export async function settleBudget(
  reserved: number,
  actualInputTokens: number,
  actualOutputTokens: number,
  budgetKey: string,
): Promise<void> {
  if (reserved <= 0) {
    log.warn('budget settlement skipped: no positive reservation', { budgetKey });
    return;
  }
  const actual = actualInputTokens + actualOutputTokens;
  const refund = reserved - actual;
  if (refund <= 0) return;
  try {
    await budgetStore.release(budgetKey, refund);
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
