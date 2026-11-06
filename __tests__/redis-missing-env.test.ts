import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/log', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const FAST_REJECTION_BUDGET_MS = 50;

describe('getRedis without Upstash credentials', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns a client without throwing synchronously', async () => {
    const { getRedis } = await import('@/lib/rate-limit');
    expect(() => getRedis()).not.toThrow();
  });

  it('rejects a command immediately instead of retrying against a dead endpoint', async () => {
    const { getRedis } = await import('@/lib/rate-limit');
    const startedAt = performance.now();
    await expect(getRedis().get('any')).rejects.toThrow(/UPSTASH_REDIS_REST/);
    expect(performance.now() - startedAt).toBeLessThan(FAST_REJECTION_BUDGET_MS);
  });

  it('lets a caller recover through .catch', async () => {
    const { getRedis } = await import('@/lib/rate-limit');
    const recovered = await getRedis()
      .get('any')
      .catch(() => 'fallback');
    expect(recovered).toBe('fallback');
  });

  it('rejects a pipeline on exec while keeping the chain synchronous', async () => {
    const { getRedis } = await import('@/lib/rate-limit');
    const pipe = getRedis().pipeline();
    pipe.incrby('k', 1);
    pipe.expire('k', 1, 'NX');
    await expect(pipe.exec()).rejects.toThrow(/UPSTASH_REDIS_REST/);
  });
});

describe('getRedis with one Upstash credential missing', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    ['URL', { url: '', token: 'test-token' }],
    ['token', { url: 'https://redis.test', token: '' }],
  ])('rejects at once when the %s is missing', async (_name, env) => {
    vi.resetModules();
    vi.stubEnv('UPSTASH_REDIS_REST_URL', env.url);
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', env.token);
    const { getRedis } = await import('@/lib/rate-limit');
    await expect(getRedis().get('any')).rejects.toThrow(/UPSTASH_REDIS_REST/);
  });
});

describe('hasRedisCredentials', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    [
      'the Upstash pair',
      { UPSTASH_REDIS_REST_URL: 'https://a.test', UPSTASH_REDIS_REST_TOKEN: 't' },
      true,
    ],
    ['the Vercel KV pair', { KV_REST_API_URL: 'https://b.test', KV_REST_API_TOKEN: 't' }, true],
    [
      'a URL from one pair and a token from the other',
      { UPSTASH_REDIS_REST_URL: 'https://a.test', KV_REST_API_TOKEN: 't' },
      false,
    ],
    ['nothing', {}, false],
  ])('is %s -> %s', async (_name, env, expected) => {
    vi.resetModules();
    for (const key of [
      'UPSTASH_REDIS_REST_URL',
      'UPSTASH_REDIS_REST_TOKEN',
      'KV_REST_API_URL',
      'KV_REST_API_TOKEN',
    ]) {
      vi.stubEnv(key, (env as Record<string, string>)[key] ?? '');
    }
    const { hasRedisCredentials } = await import('@/lib/rate-limit');
    expect(hasRedisCredentials()).toBe(expected);
  });
});

describe('the unconfigured client under @upstash/ratelimit', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('builds a limiter without an unhandled rejection and rejects the limit call', async () => {
    vi.resetModules();
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '');
    vi.stubEnv('KV_REST_API_URL', '');
    vi.stubEnv('KV_REST_API_TOKEN', '');
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => unhandled.push(reason);
    process.on('unhandledRejection', onUnhandled);
    try {
      const { getAskLimit } = await import('@/lib/rate-limit');
      const limit = getAskLimit();
      await expect(limit.limit('127.0.0.1')).rejects.toThrow(/not configured/);
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(unhandled).toEqual([]);
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });
});
