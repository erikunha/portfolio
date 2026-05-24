// __tests__/ip-hash-production.test.ts
// Behavioral tests for hashIp — production Upstash salt-resolution paths.
// Covers: existing salt found in Redis, SETNX set wins, SETNX race lost (winner read),
// and the defensive throw when both SETNX and the follow-up GET fail.
//
// These tests run with NODE_ENV overridden to 'production' so the non-prod literal
// path is bypassed and the Redis branch executes.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Provide a controllable Redis stub. Individual tests will configure mock
// return values by accessing the vi.fn() references via the exported mock.
const mockGet = vi.fn<() => Promise<string | null>>();
const mockSet = vi.fn<() => Promise<string | null>>();

vi.mock('@upstash/redis', () => ({
  Redis: {
    fromEnv: vi.fn(() => ({
      get: mockGet,
      set: mockSet,
    })),
  },
}));

vi.mock('@upstash/ratelimit', () => {
  // biome-ignore lint/suspicious/noEmptyBlockStatements: intentional stub constructor
  function Ratelimit() {}
  Ratelimit.slidingWindow = () => ({});
  return { Ratelimit };
});

vi.mock('@/lib/log', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe('hashIp — production Upstash salt resolution', () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.DEPLOY_SALT;
    // Force the production branch via vi.stubEnv (restores automatically with vi.unstubAllEnvs)
    vi.stubEnv('NODE_ENV', 'production');
    mockGet.mockReset();
    mockSet.mockReset();
  });

  afterEach(() => {
    delete process.env.DEPLOY_SALT;
    vi.unstubAllEnvs();
  });

  it('uses salt from Redis when the key already exists', async () => {
    // Simulate Redis already has a salt stored
    mockGet.mockResolvedValueOnce('existing-salt-abc123');

    const { hashIp } = await import('@/lib/ip-hash');
    const result = await hashIp('1.1.1.1');

    expect(result).toHaveLength(16);
    expect(result).toMatch(/^[0-9a-f]{16}$/);
    // Redis GET was called to fetch the salt
    expect(mockGet).toHaveBeenCalledWith('meta:deploy-salt');
  });

  it('generates a new salt when the key does not exist and SETNX succeeds', async () => {
    // Redis returns null for GET (no existing salt), then 'OK' for SET (we win the race)
    mockGet.mockResolvedValueOnce(null);
    mockSet.mockResolvedValueOnce('OK');

    const { hashIp } = await import('@/lib/ip-hash');
    const result = await hashIp('2.2.2.2');

    expect(result).toHaveLength(16);
    expect(result).toMatch(/^[0-9a-f]{16}$/);
    expect(mockSet).toHaveBeenCalledWith('meta:deploy-salt', expect.any(String), { nx: true });
  });

  it('reads the winner salt when SETNX loses the race', async () => {
    // First GET: no existing key; SET: null (race lost); second GET: winner set by another instance
    mockGet
      .mockResolvedValueOnce(null) // initial check — no key
      .mockResolvedValueOnce('winner-salt-xyz'); // winner read after race loss
    mockSet.mockResolvedValueOnce(null); // SETNX returned null — someone else set it

    const { hashIp } = await import('@/lib/ip-hash');
    const result = await hashIp('3.3.3.3');

    expect(result).toHaveLength(16);
    expect(result).toMatch(/^[0-9a-f]{16}$/);
  });

  it('throws when SETNX loses and the follow-up GET also misses (defensive path)', async () => {
    // SETNX returned null but the follow-up GET still returns null — should never happen
    mockGet
      .mockResolvedValueOnce(null) // initial check — no key
      .mockResolvedValueOnce(null); // winner GET also misses
    mockSet.mockResolvedValueOnce(null); // SETNX: race lost

    const { hashIp } = await import('@/lib/ip-hash');
    await expect(hashIp('4.4.4.4')).rejects.toThrow('DEPLOY_SALT auto-resolution failed');
  });
});
