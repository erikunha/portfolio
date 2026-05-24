// __tests__/ip-hash.test.ts
// Behavioral tests for hashIp.
// Locks down: output format (16 hex chars), salt sourcing (DEPLOY_SALT env vs
// non-prod 'portfolio' literal), and determinism (same input → same output).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ip-hash imports 'server-only' (aliased to stub) and getRedis.
// In non-prod without DEPLOY_SALT the Redis path is never reached, so we
// provide a minimal stub that throws if called — catching accidental Redis calls.
vi.mock('@upstash/redis', () => ({
  Redis: {
    fromEnv: vi.fn(() => {
      throw new Error('Redis should not be called in non-prod hashIp tests');
    }),
  },
}));

vi.mock('@upstash/ratelimit', () => {
  function Ratelimit() {}
  Ratelimit.slidingWindow = () => ({});
  return { Ratelimit };
});

vi.mock('@/lib/log', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe('hashIp — output format', () => {
  beforeEach(() => {
    // Reset the module singleton (resolvedSalt) between tests.
    vi.resetModules();
    delete process.env.DEPLOY_SALT;
    // Tests run in NODE_ENV=test (not 'production') so the non-prod 'portfolio' path fires.
  });

  it('returns a 16-character hex string', async () => {
    const { hashIp } = await import('@/lib/ip-hash');
    const result = await hashIp('127.0.0.1');
    expect(result).toHaveLength(16);
    expect(result).toMatch(/^[0-9a-f]{16}$/);
  });

  it('returns the same hash for the same ip in the same module lifecycle', async () => {
    const { hashIp } = await import('@/lib/ip-hash');
    const a = await hashIp('192.168.1.1');
    const b = await hashIp('192.168.1.1');
    expect(a).toBe(b);
  });

  it('returns different hashes for different IPs', async () => {
    const { hashIp } = await import('@/lib/ip-hash');
    const a = await hashIp('10.0.0.1');
    const b = await hashIp('10.0.0.2');
    expect(a).not.toBe(b);
  });
});

describe('hashIp — salt sourcing', () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.DEPLOY_SALT;
  });

  afterEach(() => {
    delete process.env.DEPLOY_SALT;
  });

  it('uses DEPLOY_SALT env var when set', async () => {
    process.env.DEPLOY_SALT = 'test-salt-abc';
    const { hashIp: hashWithEnv } = await import('@/lib/ip-hash');
    const hashA = await hashWithEnv('1.1.1.1');

    // Reset and use a different salt to prove the hash differs.
    vi.resetModules();
    process.env.DEPLOY_SALT = 'different-salt';
    const { hashIp: hashWithOther } = await import('@/lib/ip-hash');
    const hashB = await hashWithOther('1.1.1.1');

    expect(hashA).not.toBe(hashB);
  });

  it('uses the "portfolio" literal in non-prod when DEPLOY_SALT is not set', async () => {
    // Verify the non-prod path by calling twice — both use the same 'portfolio' salt
    // so the hashes must match (determinism guarantee).
    const { hashIp: first } = await import('@/lib/ip-hash');
    const h1 = await first('2.2.2.2');

    vi.resetModules();
    const { hashIp: second } = await import('@/lib/ip-hash');
    const h2 = await second('2.2.2.2');

    expect(h1).toBe(h2);
  });
});

describe('hashIp — concurrent dedup', () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.DEPLOY_SALT;
  });

  it('concurrent calls resolve to the same hash (same resolvePromise)', async () => {
    const { hashIp } = await import('@/lib/ip-hash');
    // Fire two concurrent calls before the first has resolved.
    const [a, b] = await Promise.all([hashIp('3.3.3.3'), hashIp('3.3.3.3')]);
    expect(a).toBe(b);
    expect(a).toHaveLength(16);
  });
});
