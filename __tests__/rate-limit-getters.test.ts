import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@upstash/redis', () => ({
  Redis: {
    fromEnv: vi.fn(() => ({
      get: vi.fn(async () => null),
      set: vi.fn(async () => 'OK'),
      decrby: vi.fn(async () => 0),
      pipeline: vi.fn(() => ({
        incrby: vi.fn(),
        expire: vi.fn(),
        exec: vi.fn(async () => [0, 1]),
      })),
    })),
  },
}));

beforeEach(() => {
  vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://redis.test');
  vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'test-token');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

vi.mock('@upstash/ratelimit', () => {
  function Ratelimit(this: object, opts: unknown) {
    Object.assign(this, opts);
  }
  Ratelimit.slidingWindow = vi.fn(() => ({}));
  Ratelimit.fixedWindow = vi.fn(() => ({}));
  return { Ratelimit };
});

vi.mock('@/lib/log', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe('getClientIp: header precedence', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns the first entry of x-forwarded-for when present', async () => {
    const { getClientIp } = await import('@/lib/rate-limit');
    const req = new NextRequest('http://localhost/api/ask', {
      headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
    });
    expect(getClientIp(req)).toBe('1.2.3.4');
  });

  it('trims whitespace from x-forwarded-for entries', async () => {
    const { getClientIp } = await import('@/lib/rate-limit');
    const req = new NextRequest('http://localhost/api/ask', {
      headers: { 'x-forwarded-for': '  10.0.0.1 , 10.0.0.2' },
    });
    expect(getClientIp(req)).toBe('10.0.0.1');
  });

  it('falls back to x-real-ip when x-forwarded-for is absent', async () => {
    const { getClientIp } = await import('@/lib/rate-limit');
    const req = new NextRequest('http://localhost/api/ask', {
      headers: { 'x-real-ip': '9.10.11.12' },
    });
    expect(getClientIp(req)).toBe('9.10.11.12');
  });

  it('returns "unknown" when neither header is present', async () => {
    const { getClientIp } = await import('@/lib/rate-limit');
    const req = new NextRequest('http://localhost/api/ask');
    expect(getClientIp(req)).toBe('unknown');
  });
});

describe('getRedis: singleton', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns the same Redis instance on repeated calls within a module lifecycle', async () => {
    const { getRedis } = await import('@/lib/rate-limit');
    const a = getRedis();
    const b = getRedis();
    expect(a).toBe(b);
  });
});

describe('rate-limit factory getters: configured correctly', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('getAskLimit configures slidingWindow(8, "1 h")', async () => {
    const { Ratelimit } = await import('@upstash/ratelimit');
    const { getAskLimit } = await import('@/lib/rate-limit');
    getAskLimit();
    expect(
      (Ratelimit as unknown as { slidingWindow: ReturnType<typeof vi.fn> }).slidingWindow,
    ).toHaveBeenCalledWith(8, '1 h');
  });

  it('getLighthouseLimit configures slidingWindow(30, "1 m")', async () => {
    const { Ratelimit } = await import('@upstash/ratelimit');
    const { getLighthouseLimit } = await import('@/lib/rate-limit');
    getLighthouseLimit();
    expect(
      (Ratelimit as unknown as { slidingWindow: ReturnType<typeof vi.fn> }).slidingWindow,
    ).toHaveBeenCalledWith(30, '1 m');
  });

  it('getErrorLogDailyLimit configures fixedWindow(500, "1 d")', async () => {
    const { Ratelimit } = await import('@upstash/ratelimit');
    const { getErrorLogDailyLimit } = await import('@/lib/rate-limit');
    getErrorLogDailyLimit();
    expect(
      (Ratelimit as unknown as { fixedWindow: ReturnType<typeof vi.fn> }).fixedWindow,
    ).toHaveBeenCalledWith(500, '1 d');
  });

  it('getContactLimit configures slidingWindow(3, "10 m")', async () => {
    const { Ratelimit } = await import('@upstash/ratelimit');
    const { getContactLimit } = await import('@/lib/rate-limit');
    getContactLimit();
    expect(
      (Ratelimit as unknown as { slidingWindow: ReturnType<typeof vi.fn> }).slidingWindow,
    ).toHaveBeenCalledWith(3, '10 m');
  });

  it('getForgetLimit admits one full session id list per hour', async () => {
    const { Ratelimit } = await import('@upstash/ratelimit');
    const { REQUEST_REF_LIMITS } = await import('@/lib/request-refs.client');
    const { getForgetLimit } = await import('@/lib/rate-limit');
    getForgetLimit();
    const slidingWindow = (Ratelimit as unknown as { slidingWindow: ReturnType<typeof vi.fn> })
      .slidingWindow;
    const [requests, window] = slidingWindow.mock.calls.at(-1) ?? [];
    expect(
      requests,
      'privacy forget --all sends one request per stored id; a smaller window leaves ids it cannot finish',
    ).toBeGreaterThanOrEqual(REQUEST_REF_LIMITS.maxRefs);
    expect(window).toBe('1 h');
  });

  it('getAskLimit returns the same Ratelimit instance on repeated calls', async () => {
    const { getAskLimit } = await import('@/lib/rate-limit');
    const a = getAskLimit();
    const b = getAskLimit();
    expect(a).toBe(b);
  });
});
