// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BudgetStore } from '@/lib/rate-limit';

vi.mock('@upstash/ratelimit', () => ({ Ratelimit: { slidingWindow: () => ({}) } }));
vi.mock('@/lib/log', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const CAPACITY = 1_000_000;
const OVER_CAPACITY = CAPACITY * 2;

function storeReserving(monthly: number, daily: number): BudgetStore {
  return {
    capacity: CAPACITY,
    dailyCapacity: CAPACITY,
    reserve: async (key) => (key.includes(':day:') ? daily : monthly),
    release: async () => undefined,
    chargeOverage: async () => undefined,
  };
}

describe('why a budget reservation was refused', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('names the month when the monthly cap is crossed', async () => {
    const { reserveBudget, setBudgetStore } = await import('@/lib/rate-limit');
    setBudgetStore(storeReserving(OVER_CAPACITY, 0));
    expect(await reserveBudget(512)).toMatchObject({ allowed: false, reason: 'month' });
  });

  it('names the day when only the daily slice is crossed', async () => {
    const { reserveBudget, setBudgetStore } = await import('@/lib/rate-limit');
    setBudgetStore(storeReserving(0, OVER_CAPACITY));
    expect(await reserveBudget(512)).toMatchObject({ allowed: false, reason: 'day' });
  });

  it('names the store when the daily reservation throws', async () => {
    const { reserveBudget, setBudgetStore } = await import('@/lib/rate-limit');
    setBudgetStore({
      ...storeReserving(0, 0),
      reserve: async (key) => {
        if (key.includes(':day:')) throw new Error('Redis unavailable');
        return 0;
      },
    });
    expect(await reserveBudget(512)).toMatchObject({ allowed: false, reason: 'store' });
  });

  it('names the store, not the month, when Redis is not configured', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '');
    vi.stubEnv('KV_REST_API_URL', '');
    vi.stubEnv('KV_REST_API_TOKEN', '');
    const { reserveBudget } = await import('@/lib/rate-limit');
    const result = await reserveBudget(512);
    expect(
      result,
      'a missing store is an outage, not an exhausted budget: the visitor must not read "paused for this month"',
    ).toMatchObject({ allowed: false, reserved: 0, reason: 'store' });
  });

  it('carries no refusal reason on a granted reservation', async () => {
    const { reserveBudget, setBudgetStore } = await import('@/lib/rate-limit');
    setBudgetStore(storeReserving(0, 0));
    const result = await reserveBudget(512);
    expect(result.allowed).toBe(true);
    expect('reason' in result).toBe(false);
  });
});
