import { beforeEach, describe, expect, it, vi } from 'vitest';

const DEDUP_LOCK_ACQUIRED = 'OK';
const QUESTION = 'What does Erik build?';
const VISITOR_HEADER = 'x-test-visitor';
const HASH_FAILS_FOR = 'hash-fails';
const HASH_FAILURE = 'DEPLOY_SALT auto-resolution failed';
const BUDGET_STATUS = 503;
const DUPLICATE_STATUS = 429;

const locks = vi.hoisted(() => new Set<string>());
const redisSet = vi.hoisted(() => vi.fn());
const redisDel = vi.hoisted(() => vi.fn());
const reserveBudget = vi.hoisted(() => vi.fn());
const logError = vi.hoisted(() => vi.fn());
const logInfo = vi.hoisted(() => vi.fn());
const hashIp = vi.hoisted(() => vi.fn());

vi.mock('@/lib/env', () => ({ env: { ASK_ENABLED: undefined } }));
vi.mock('@/lib/redis', () => ({
  hasRedisCredentials: vi.fn(() => true),
  getRedis: () => ({ set: redisSet, del: redisDel }),
}));
vi.mock('@/lib/server/client-ip', () => ({
  getClientIp: vi.fn((req: { headers: Headers }) => req.headers.get(VISITOR_HEADER) ?? ''),
}));
vi.mock('@/lib/rate-limit', () => ({
  getAskLimit: vi.fn(() => ({ limit: vi.fn(async () => ({ success: true })) })),
}));
vi.mock('@/lib/ask/budget', () => ({ reserveBudget }));
vi.mock('@/lib/ask/refusal-count', () => ({ countAskRefusal: vi.fn(async () => undefined) }));
vi.mock('@/lib/ip-hash', () => ({ hashIp }));
vi.mock('@/lib/server/after-response', () => ({
  afterResponse: (task: () => Promise<void>) => void task(),
}));
vi.mock('@/lib/log', async () =>
  (await import('@/__tests__/helpers/modules')).logModule({ error: logError, info: logInfo }),
);

function ask(visitor: string): Request {
  return new Request('http://localhost/api/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', [VISITOR_HEADER]: visitor },
    body: JSON.stringify({ question: QUESTION }),
  });
}

function allLogged(): string {
  return JSON.stringify([...logError.mock.calls, ...logInfo.mock.calls]);
}

describe('preflightAsk dedup lock for visitors whose IP hash is unavailable', () => {
  beforeEach(() => {
    vi.resetModules();
    locks.clear();
    redisSet.mockReset().mockImplementation(async (key: string) => {
      if (locks.has(key)) return null;
      locks.add(key);
      return DEDUP_LOCK_ACQUIRED;
    });
    redisDel.mockReset().mockImplementation(async (key: string) => {
      locks.delete(key);
      return 1;
    });
    reserveBudget.mockReset().mockResolvedValue({
      allowed: true,
      reserved: 1512,
      budgetKey: 'ask:tokens:test',
      dailyKey: 'ask:tokens:day:test',
    });
    logError.mockClear();
    logInfo.mockClear();
    hashIp.mockReset().mockImplementation(async (ip: string) => {
      if (ip.startsWith(HASH_FAILS_FOR)) throw new Error(HASH_FAILURE);
      return `hash-of-${ip}`;
    });
  });

  it('admits two different visitors with failed hashes asking the same question', async () => {
    const { preflightAsk } = await import('@/lib/ask/preflight');

    const first = await preflightAsk(ask(`${HASH_FAILS_FOR}-a`));
    const second = await preflightAsk(ask(`${HASH_FAILS_FOR}-b`));

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(redisSet).not.toHaveBeenCalled();
  });

  it('still refuses a visitor with a working hash who repeats a question', async () => {
    const { preflightAsk } = await import('@/lib/ask/preflight');

    const first = await preflightAsk(ask('visitor-a'));
    const repeat = await preflightAsk(ask('visitor-a'));
    const other = await preflightAsk(ask('visitor-b'));

    expect(first.ok).toBe(true);
    expect(repeat.ok).toBe(false);
    if (!repeat.ok) expect(repeat.response.status).toBe(DUPLICATE_STATUS);
    expect(other.ok).toBe(true);
  });

  it('does not block a hashed visitor behind an unhashed visitor asking the same question', async () => {
    const { preflightAsk } = await import('@/lib/ask/preflight');

    const unhashed = await preflightAsk(ask(`${HASH_FAILS_FOR}-a`));
    const hashed = await preflightAsk(ask('visitor-a'));

    expect(unhashed.ok).toBe(true);
    expect(hashed.ok).toBe(true);
  });

  it('logs the failed hash once per request and never the visitor address', async () => {
    const { preflightAsk } = await import('@/lib/ask/preflight');
    const visitor = `${HASH_FAILS_FOR}-203.0.113.9`;

    await preflightAsk(ask(visitor));

    const hashFailures = logError.mock.calls.filter(([message]) =>
      String(message).includes('ip hash unavailable'),
    );
    expect(hashFailures).toHaveLength(1);
    expect(allLogged()).not.toContain('203.0.113.9');
  });

  it('takes no lock and releases none when the budget refuses an unhashed visitor', async () => {
    reserveBudget.mockResolvedValue({ allowed: false, reason: 'month' });
    const { preflightAsk } = await import('@/lib/ask/preflight');

    const result = await preflightAsk(ask(`${HASH_FAILS_FOR}-a`));

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(BUDGET_STATUS);
    expect(redisSet).not.toHaveBeenCalled();
    expect(redisDel).not.toHaveBeenCalled();
  });

  it('releases the lock of a hashed visitor when the budget refuses', async () => {
    reserveBudget.mockResolvedValue({ allowed: false, reason: 'month' });
    const { preflightAsk } = await import('@/lib/ask/preflight');

    await preflightAsk(ask('visitor-a'));

    expect(redisSet).toHaveBeenCalledTimes(1);
    expect(redisDel).toHaveBeenCalledTimes(1);
    expect(locks.size).toBe(0);
  });
});
