import { beforeEach, describe, expect, it, vi } from 'vitest';

const fromEnv = vi.fn((_config?: unknown) => ({ get: vi.fn(async () => 'live') }));

vi.mock('@upstash/redis', () => ({ Redis: { fromEnv } }));
vi.mock('@upstash/ratelimit', () => {
  function Ratelimit(this: object, opts: unknown) {
    Object.assign(this, opts);
  }
  Ratelimit.slidingWindow = vi.fn(() => ({}));
  return { Ratelimit };
});
vi.mock('@/lib/log', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const MAX_RETRY_BACKOFF_MS = 100;

describe('getRedis client', () => {
  beforeEach(() => {
    vi.resetModules();
    fromEnv.mockClear();
  });

  it('bounds the client retry so an outage cannot stall a render', async () => {
    const { getRedis } = await import('@/lib/rate-limit');
    getRedis();
    const config = fromEnv.mock.calls[0]?.[0] as {
      retry: { retries: number; backoff: (count: number) => number };
    };
    expect(config.retry.retries).toBe(1);
    expect(config.retry.backoff(0)).toBeLessThanOrEqual(MAX_RETRY_BACKOFF_MS);
    expect(config.retry.backoff(5)).toBeLessThanOrEqual(MAX_RETRY_BACKOFF_MS);
  });

  it('builds the client once', async () => {
    const { getRedis } = await import('@/lib/rate-limit');
    expect(getRedis()).toBe(getRedis());
    expect(fromEnv).toHaveBeenCalledTimes(1);
  });
});
