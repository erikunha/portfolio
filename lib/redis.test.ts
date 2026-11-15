import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fromEnv = vi.fn((_config?: unknown) => ({ get: vi.fn(async () => 'live') }));

vi.mock('@upstash/redis', () => {
  function Redis(this: object, requester: unknown) {
    Object.assign(this, { requester });
  }
  Redis.fromEnv = fromEnv;
  return { Redis };
});

const ENV_NAMES = [
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'KV_REST_API_URL',
  'KV_REST_API_TOKEN',
] as const;

function stubCredentials(env: Partial<Record<(typeof ENV_NAMES)[number], string>>): void {
  for (const name of ENV_NAMES) vi.stubEnv(name, env[name] ?? '');
}

describe('REDIS_ENV_PAIRS', () => {
  it('lists the Upstash pair before the Vercel KV pair', async () => {
    const { REDIS_ENV_PAIRS } = await import('@/lib/redis');
    expect(REDIS_ENV_PAIRS).toEqual([
      { url: 'UPSTASH_REDIS_REST_URL', token: 'UPSTASH_REDIS_REST_TOKEN' },
      { url: 'KV_REST_API_URL', token: 'KV_REST_API_TOKEN' },
    ]);
  });
});

describe('RedisNotConfiguredError', () => {
  it('names both credential pairs and keeps its own name', async () => {
    const { RedisNotConfiguredError } = await import('@/lib/redis');
    const error = new RedisNotConfiguredError();
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('RedisNotConfiguredError');
    expect(error.message).toBe(
      'Redis is not configured: UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN or KV_REST_API_URL and KV_REST_API_TOKEN must be set',
    );
  });
});

describe('hasRedisCredentials', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    [
      'the Upstash pair is set',
      { UPSTASH_REDIS_REST_URL: 'https://a.test', UPSTASH_REDIS_REST_TOKEN: 't' },
      true,
    ],
    [
      'the Vercel KV pair is set',
      { KV_REST_API_URL: 'https://b.test', KV_REST_API_TOKEN: 't' },
      true,
    ],
    [
      'a URL and a token come from different pairs',
      { UPSTASH_REDIS_REST_URL: 'https://a.test', KV_REST_API_TOKEN: 't' },
      false,
    ],
    ['only a URL is set', { UPSTASH_REDIS_REST_URL: 'https://a.test' }, false],
    ['only a token is set', { KV_REST_API_TOKEN: 't' }, false],
    ['nothing is set', {}, false],
  ])('when %s -> %s', async (_name, env, expected) => {
    stubCredentials(env);
    const { hasRedisCredentials } = await import('@/lib/redis');
    expect(hasRedisCredentials()).toBe(expected);
  });
});

describe('getRedis', () => {
  beforeEach(() => {
    vi.resetModules();
    fromEnv.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    ['Upstash', { UPSTASH_REDIS_REST_URL: 'https://a.test', UPSTASH_REDIS_REST_TOKEN: 't' }],
    ['Vercel KV', { KV_REST_API_URL: 'https://b.test', KV_REST_API_TOKEN: 't' }],
  ])('builds one shared client from the %s pair with a bounded retry', async (_name, env) => {
    stubCredentials(env);
    const { getRedis } = await import('@/lib/redis');
    expect(getRedis()).toBe(getRedis());
    expect(fromEnv).toHaveBeenCalledTimes(1);
    const config = fromEnv.mock.calls[0]?.[0] as {
      retry: { retries: number; backoff: (count: number) => number };
    };
    expect(config.retry.retries).toBe(1);
    expect(config.retry.backoff(0)).toBe(50);
    expect(config.retry.backoff(9)).toBe(50);
  });

  it('returns a client that never reaches Upstash when no credentials are set', async () => {
    stubCredentials({});
    const { getRedis, RedisNotConfiguredError } = await import('@/lib/redis');
    const client = getRedis() as unknown as {
      requester: { request: () => Promise<unknown> };
    };
    expect(fromEnv).not.toHaveBeenCalled();
    await expect(client.requester.request()).rejects.toBeInstanceOf(RedisNotConfiguredError);
  });
});
