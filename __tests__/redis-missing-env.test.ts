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
