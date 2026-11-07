// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ASK_RESERVED_INPUT_TOKENS } from '@/lib/ask/input-reservation';

const pipelineExec = vi.fn(async (): Promise<[number, number]> => {
  throw new Error('Failed to parse URL from /pipeline');
});
const decrbyMock = vi.fn(async (): Promise<number> => {
  throw new Error('Failed to parse URL from /pipeline');
});

vi.mock('@upstash/redis', () => ({
  Redis: {
    fromEnv: () => ({
      decrby: decrbyMock,
      pipeline: () => ({ incrby: vi.fn(), expire: vi.fn(), exec: pipelineExec }),
    }),
  },
}));
vi.mock('@upstash/ratelimit', () => ({ Ratelimit: { slidingWindow: () => ({}) } }));
vi.mock('@/lib/log', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const RESERVATION = ASK_RESERVED_INPUT_TOKENS + 512;
const RUN_REQUESTS = 3;

describe('budget store seam', () => {
  beforeEach(() => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://redis.test');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'test-token');
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('keeps the Redis-backed store fail-closed when no store is installed', async () => {
    const { reserveBudget } = await import('@/lib/rate-limit');
    const result = await reserveBudget(512);
    expect(result).toMatchObject({ allowed: false, reserved: 0 });
    expect(pipelineExec).toHaveBeenCalledOnce();
  });

  it('allows exactly the harness run size without touching Redis, then rejects', async () => {
    const { createEvalBudgetStore, reserveBudget, setBudgetStore } = await import(
      '@/lib/rate-limit'
    );
    setBudgetStore(createEvalBudgetStore(RUN_REQUESTS));

    for (let i = 0; i < RUN_REQUESTS; i += 1) {
      const result = await reserveBudget(512);
      expect(result).toMatchObject({ allowed: true, reserved: RESERVATION });
    }
    const over = await reserveBudget(512);
    expect(over).toMatchObject({ allowed: false, reserved: 0 });
    expect(pipelineExec).not.toHaveBeenCalled();
    expect(decrbyMock).not.toHaveBeenCalled();
  });

  it('returns the rejected reservation to the harness store', async () => {
    const { createEvalBudgetStore, reserveBudget, setBudgetStore } = await import(
      '@/lib/rate-limit'
    );
    setBudgetStore(createEvalBudgetStore(1));
    await reserveBudget(512);
    const firstRejected = await reserveBudget(512);
    const secondRejected = await reserveBudget(512);
    expect(firstRejected.allowed).toBe(false);
    expect(secondRejected.pct).toBeCloseTo(firstRejected.pct, 10);
  });

  it('settleBudget frees harness capacity for later reservations', async () => {
    const { createEvalBudgetStore, reserveBudget, setBudgetStore, settleBudget } = await import(
      '@/lib/rate-limit'
    );
    setBudgetStore(createEvalBudgetStore(2));
    const first = await reserveBudget(512);
    const second = await reserveBudget(512);
    expect((await reserveBudget(512)).allowed).toBe(false);

    await settleBudget(first.reserved, 100, 50, first.budgetKey, first.dailyKey);
    await settleBudget(second.reserved, 100, 50, second.budgetKey, second.dailyKey);

    expect((await reserveBudget(512)).allowed).toBe(true);
    expect(decrbyMock).not.toHaveBeenCalled();
  });

  it('denies on the daily slice while the month has room, and returns both reservations', async () => {
    const { reserveBudget, setBudgetStore, getBudgetKey, getDailyBudgetKey } = await import(
      '@/lib/rate-limit'
    );
    const used = new Map<string, number>();
    setBudgetStore({
      capacity: RESERVATION * 100,
      dailyCapacity: RESERVATION * 2,
      reserve: async (key, tokens) => {
        used.set(key, (used.get(key) ?? 0) + tokens);
        return used.get(key) ?? 0;
      },
      release: async (key, tokens) => {
        used.set(key, (used.get(key) ?? 0) - tokens);
      },
      chargeOverage: async () => undefined,
    });

    expect((await reserveBudget(512)).allowed).toBe(true);
    expect((await reserveBudget(512)).allowed).toBe(true);
    const third = await reserveBudget(512);

    expect(
      third,
      'one actor spending the whole month in a few days would 503 every visitor until the key expires',
    ).toMatchObject({ allowed: false, reserved: 0 });
    expect(used.get(getBudgetKey())).toBe(RESERVATION * 2);
    expect(used.get(getDailyBudgetKey())).toBe(RESERVATION * 2);
  });

  it('returns the monthly reservation when the daily reservation cannot be made', async () => {
    const { reserveBudget, setBudgetStore, getBudgetKey } = await import('@/lib/rate-limit');
    const used = new Map<string, number>();
    setBudgetStore({
      capacity: RESERVATION * 100,
      dailyCapacity: RESERVATION * 100,
      reserve: async (key, tokens) => {
        if (key.includes(':day:')) throw new Error('Redis unavailable');
        used.set(key, (used.get(key) ?? 0) + tokens);
        return used.get(key) ?? 0;
      },
      release: async (key, tokens) => {
        used.set(key, (used.get(key) ?? 0) - tokens);
      },
      chargeOverage: async () => undefined,
    });

    const result = await reserveBudget(512);

    expect(result).toMatchObject({ allowed: false, reserved: 0 });
    expect(used.get(getBudgetKey())).toBe(0);
  });

  it('settles both the monthly and the daily reservation', async () => {
    const { reserveBudget, setBudgetStore, settleBudget } = await import('@/lib/rate-limit');
    const used = new Map<string, number>();
    setBudgetStore({
      capacity: RESERVATION * 100,
      dailyCapacity: RESERVATION * 100,
      reserve: async (key, tokens) => {
        used.set(key, (used.get(key) ?? 0) + tokens);
        return used.get(key) ?? 0;
      },
      release: async (key, tokens) => {
        used.set(key, (used.get(key) ?? 0) - tokens);
      },
      chargeOverage: async (key, tokens) => {
        used.set(key, (used.get(key) ?? 0) + tokens);
      },
    });

    const { reserved, budgetKey, dailyKey } = await reserveBudget(512);
    await settleBudget(reserved, 100, 50, budgetKey, dailyKey);

    expect(used.get(budgetKey)).toBe(150);
    expect(used.get(dailyKey)).toBe(150);
  });
});
