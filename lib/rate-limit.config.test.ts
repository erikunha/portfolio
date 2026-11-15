import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const slidingWindow = vi.hoisted(() =>
  vi.fn((limit: number, window: string) => ({ algorithm: 'slidingWindow', limit, window })),
);
const fixedWindow = vi.hoisted(() =>
  vi.fn((limit: number, window: string) => ({ algorithm: 'fixedWindow', limit, window })),
);
const limitCall = vi.hoisted(() => vi.fn(async (_key?: string) => ({ success: true })));
const constructed = vi.hoisted(() => [] as Array<{ prefix: string }>);

vi.mock('@upstash/redis', () => ({ Redis: { fromEnv: vi.fn(() => ({ marker: 'redis' })) } }));
vi.mock('@upstash/ratelimit', () => {
  function Ratelimit(this: object, opts: unknown) {
    constructed.push(opts as { prefix: string });
    Object.assign(this, opts, { limit: limitCall });
  }
  Ratelimit.slidingWindow = slidingWindow;
  Ratelimit.fixedWindow = fixedWindow;
  return { Ratelimit };
});
vi.mock('@/lib/log', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

type Getter =
  | 'getAskLimit'
  | 'getContactLimit'
  | 'getMcpLimit'
  | 'getHealthzLimit'
  | 'getLighthouseLimit'
  | 'getErrorLogLimit'
  | 'getErrorLogIpDailyLimit'
  | 'getForgetLimit';

const EXPECTED: ReadonlyArray<readonly [Getter, string, number, string, string]> = [
  ['getAskLimit', 'slidingWindow', 8, '1 h', 'rl:ask'],
  ['getContactLimit', 'slidingWindow', 3, '10 m', 'rl:contact'],
  ['getMcpLimit', 'slidingWindow', 60, '1 m', 'rl:mcp'],
  ['getHealthzLimit', 'slidingWindow', 120, '1 m', 'rl:healthz'],
  ['getLighthouseLimit', 'slidingWindow', 30, '1 m', 'rl:lighthouse'],
  ['getErrorLogLimit', 'slidingWindow', 10, '1 m', 'rl:errlog'],
  ['getErrorLogIpDailyLimit', 'fixedWindow', 50, '1 d', 'rl:errlog:ipday'],
  ['getForgetLimit', 'slidingWindow', 21, '1 h', 'rl:forget'],
];

describe('limiter table', () => {
  beforeEach(() => {
    vi.resetModules();
    slidingWindow.mockClear();
    fixedWindow.mockClear();
    limitCall.mockClear();
    constructed.length = 0;
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://redis.test');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'test-token');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each(EXPECTED)(
    '%s keeps its algorithm, limit, window and prefix',
    async (getter, algorithm, limit, window, prefix) => {
      const rateLimit = await import('@/lib/rate-limit');
      const built = rateLimit[getter]() as unknown as {
        redis: unknown;
        limiter: unknown;
        prefix: string;
      };
      expect(built.limiter).toEqual({ algorithm, limit, window });
      expect(built.prefix).toBe(prefix);
      expect(built.redis).toEqual({ marker: 'redis' });
    },
  );

  it('builds each limiter once and returns the same instance on later calls', async () => {
    const rateLimit = await import('@/lib/rate-limit');
    for (const [getter] of EXPECTED) {
      expect(rateLimit[getter]()).toBe(rateLimit[getter]());
    }
    expect(slidingWindow).toHaveBeenCalledTimes(
      EXPECTED.filter(([, a]) => a === 'slidingWindow').length,
    );
    expect(fixedWindow).toHaveBeenCalledTimes(
      EXPECTED.filter(([, a]) => a === 'fixedWindow').length,
    );
  });

  it('keeps the shared error-log daily cap at 500 a day under one global key', async () => {
    const { getErrorLogDailyLimit } = await import('@/lib/rate-limit');
    const limiter = getErrorLogDailyLimit();
    expect(limiter).toBe(getErrorLogDailyLimit());
    expect(fixedWindow).toHaveBeenCalledWith(500, '1 d');
    await limiter.limit();
    expect(limitCall).toHaveBeenCalledWith('global');
  });

  it('gives the shared error-log daily cap its own prefix', async () => {
    const { getErrorLogDailyLimit } = await import('@/lib/rate-limit');
    getErrorLogDailyLimit();
    expect(constructed.map((opts) => opts.prefix)).toEqual(['rl:errlog:day']);
  });

  it('shares no prefix between two limiters', async () => {
    const rateLimit = await import('@/lib/rate-limit');
    for (const [getter] of EXPECTED) rateLimit[getter]();
    rateLimit.getErrorLogDailyLimit();
    const prefixes = constructed.map((opts) => opts.prefix);
    expect(prefixes).toHaveLength(EXPECTED.length + 1);
    expect(new Set(prefixes).size).toBe(prefixes.length);
  });
});
