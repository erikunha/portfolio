// __tests__/rate-limit-getters.test.ts
// Behavioral tests for getClientIp and rate-limit singleton getters.
// Locks down: header precedence for IP extraction; singleton identity across calls.

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

describe('getClientIp — header precedence', () => {
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

describe('getRedis — singleton', () => {
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

describe('rate-limit factory getters — configured correctly', () => {
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

  it('getContactLimit configures slidingWindow(3, "10 m")', async () => {
    const { Ratelimit } = await import('@upstash/ratelimit');
    const { getContactLimit } = await import('@/lib/rate-limit');
    getContactLimit();
    expect(
      (Ratelimit as unknown as { slidingWindow: ReturnType<typeof vi.fn> }).slidingWindow,
    ).toHaveBeenCalledWith(3, '10 m');
  });

  it('getForgetLimit configures slidingWindow(5, "1 h")', async () => {
    const { Ratelimit } = await import('@upstash/ratelimit');
    const { getForgetLimit } = await import('@/lib/rate-limit');
    getForgetLimit();
    expect(
      (Ratelimit as unknown as { slidingWindow: ReturnType<typeof vi.fn> }).slidingWindow,
    ).toHaveBeenCalledWith(5, '1 h');
  });

  it('getAskLimit returns the same Ratelimit instance on repeated calls', async () => {
    const { getAskLimit } = await import('@/lib/rate-limit');
    const a = getAskLimit();
    const b = getAskLimit();
    expect(a).toBe(b);
  });
});
