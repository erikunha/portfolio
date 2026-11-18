import { beforeEach, describe, expect, it, vi } from 'vitest';

const QUESTION = 'What does Erik build?';
const VISITOR_HEADER = 'x-test-visitor';
const HASH_FAILS_FOR = 'hash-fails';
const HASH_FAILURE = 'DEPLOY_SALT auto-resolution failed';

const redisSet = vi.hoisted(() => vi.fn());
const redisDel = vi.hoisted(() => vi.fn());
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
vi.mock('@/lib/ask/budget', async () =>
  (await import('@/__tests__/helpers/ask-route')).budgetModule(),
);
vi.mock('@/lib/ask/refusal-count', () => ({ countAskRefusal: vi.fn(async () => undefined) }));
vi.mock('@/lib/ip-hash', () => ({ hashIp }));
vi.mock('@/lib/server/after-response', () => ({
  afterResponse: (task: () => Promise<void>) => void task(),
}));
vi.mock('@/lib/log', async () =>
  (await import('@/__tests__/helpers/modules')).logModule({ error: vi.fn(), info: vi.fn() }),
);

function ask(visitor: string): Request {
  return new Request('http://localhost/api/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', [VISITOR_HEADER]: visitor },
    body: JSON.stringify({ question: QUESTION }),
  });
}

describe('ask context identity for visitors whose IP hash is unavailable', () => {
  beforeEach(() => {
    vi.resetModules();
    redisSet.mockReset().mockResolvedValue('OK');
    redisDel.mockReset().mockResolvedValue(1);
    hashIp.mockReset().mockImplementation(async (ip: string) => {
      if (ip.startsWith(HASH_FAILS_FOR)) throw new Error(HASH_FAILURE);
      return `hash-of-${ip}`;
    });
  });

  it('carries a null identity in the context of an unhashed visitor', async () => {
    const { preflightAsk } = await import('@/lib/ask/preflight');

    const result = await preflightAsk(ask(`${HASH_FAILS_FOR}-a`));

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.context.ipHash).toBeNull();
  });

  it('carries the hash in the context of a hashed visitor', async () => {
    const { preflightAsk } = await import('@/lib/ask/preflight');

    const result = await preflightAsk(ask('visitor-a'));

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.context.ipHash).toBe('hash-of-visitor-a');
  });

  it('issues no DEL when an unhashed visitor reservation is abandoned', async () => {
    const { preflightAsk } = await import('@/lib/ask/preflight');
    const { abandonReservation } = await import('@/lib/ask/budget');

    const result = await preflightAsk(ask(`${HASH_FAILS_FOR}-a`));
    if (!result.ok) throw new Error('preflight refused');
    await abandonReservation(result.context);

    expect(redisDel).not.toHaveBeenCalled();
  });
});
