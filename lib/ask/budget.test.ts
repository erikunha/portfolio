// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BudgetStore } from '@/lib/ask/budget';

const incrby = vi.hoisted(() => vi.fn(async () => 0));
const decrby = vi.hoisted(() => vi.fn(async () => 0));
const expire = vi.hoisted(() => vi.fn());
const pipelineIncrby = vi.hoisted(() => vi.fn());
const pipelineExec = vi.hoisted(() => vi.fn(async () => [7, 1]));
const logError = vi.hoisted(() => vi.fn());
const logWarn = vi.hoisted(() => vi.fn());

vi.mock('@/lib/redis', () => ({
  getRedis: () => ({
    incrby,
    decrby,
    pipeline: () => ({ incrby: pipelineIncrby, expire, exec: pipelineExec }),
  }),
}));
vi.mock('@/lib/log', async () =>
  (await import('@/__tests__/helpers/modules')).logModule({ warn: logWarn, error: logError }),
);

const MONTH = 'ask:spend:2026-11';
const DAY = 'ask:spend:day:2026-11-15';
const CAPACITY = 1_000_000_000_000;
const NOW = new Date('2026-11-15T10:30:00Z');

type Call = { op: 'reserve' | 'release' | 'chargeOverage'; key: string; tokens: number };

function recordingStore(overrides: Partial<BudgetStore> = {}): {
  store: BudgetStore;
  calls: Call[];
} {
  const calls: Call[] = [];
  const store: BudgetStore = {
    capacity: CAPACITY,
    dailyCapacity: CAPACITY,
    reserve: async (key, tokens) => {
      calls.push({ op: 'reserve', key, tokens });
      return tokens;
    },
    release: async (key, tokens) => {
      calls.push({ op: 'release', key, tokens });
    },
    chargeOverage: async (key, tokens) => {
      calls.push({ op: 'chargeOverage', key, tokens });
    },
    ...overrides,
  };
  return { store, calls };
}

describe('lib/ask/budget', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    for (const mock of [incrby, decrby, expire, pipelineIncrby, pipelineExec, logError, logWarn]) {
      mock.mockClear();
    }
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('keys and the cap', () => {
    it('keys the month and the UTC day', async () => {
      const { getBudgetKey, getDailyBudgetKey } = await import('@/lib/ask/budget');
      expect(getBudgetKey()).toBe(MONTH);
      expect(getDailyBudgetKey()).toBe(DAY);
    });

    it('rolls the day key at UTC midnight, not local midnight', async () => {
      const { getDailyBudgetKey, getBudgetKey } = await import('@/lib/ask/budget');
      vi.setSystemTime(new Date('2026-12-31T23:59:59Z'));
      expect(getDailyBudgetKey()).toBe('ask:spend:day:2026-12-31');
      expect(getBudgetKey()).toBe('ask:spend:2026-12');
      vi.setSystemTime(new Date('2027-01-01T00:00:00Z'));
      expect(getDailyBudgetKey()).toBe('ask:spend:day:2027-01-01');
      expect(getBudgetKey()).toBe('ask:spend:2027-01');
    });

    it('caps the month at 3 USD', async () => {
      const { MONTHLY_BUDGET_USD } = await import('@/lib/ask/budget');
      expect(MONTHLY_BUDGET_USD).toBe(3);
    });
  });

  describe('reserveBudget', () => {
    it('reserves the month, then the day, and reports the larger share', async () => {
      const { reserveBudget, setBudgetStore } = await import('@/lib/ask/budget');
      const { askReservationCost } = await import('@/lib/ask/input-reservation');
      const { store, calls } = recordingStore();
      setBudgetStore(store);

      const result = await reserveBudget(512);
      const reserved = askReservationCost(512);

      expect(result).toEqual({
        allowed: true,
        reserved,
        pct: reserved / CAPACITY,
        budgetKey: MONTH,
        dailyKey: DAY,
      });
      expect(calls).toEqual([
        { op: 'reserve', key: MONTH, tokens: reserved },
        { op: 'reserve', key: DAY, tokens: reserved },
      ]);
    });

    it('gives the day key a two-day window', async () => {
      const { reserveBudget, setBudgetStore } = await import('@/lib/ask/budget');
      const windows: Array<number | undefined> = [];
      const { store } = recordingStore({
        reserve: async (_key, tokens, windowSeconds) => {
          windows.push(windowSeconds);
          return tokens;
        },
      });
      setBudgetStore(store);
      await reserveBudget(512);
      expect(windows).toEqual([undefined, 60 * 60 * 24 * 2]);
    });

    it('warns once the larger share reaches 80 percent', async () => {
      const { reserveBudget, setBudgetStore } = await import('@/lib/ask/budget');
      const { store } = recordingStore({ reserve: async () => CAPACITY * 0.8 });
      setBudgetStore(store);
      const result = await reserveBudget(512);
      expect(result.allowed).toBe(true);
      expect(logWarn).toHaveBeenCalledWith('budget approaching cap', expect.any(Object));
    });

    it('refuses on the month, refunds only the month key and never reserves the day', async () => {
      const { reserveBudget, setBudgetStore } = await import('@/lib/ask/budget');
      const { askReservationCost } = await import('@/lib/ask/input-reservation');
      const reserved: string[] = [];
      const released: Array<[string, number]> = [];
      const { store } = recordingStore({
        reserve: async (key) => {
          reserved.push(key);
          return CAPACITY * 2;
        },
        release: async (key, tokens) => {
          released.push([key, tokens]);
        },
      });
      setBudgetStore(store);

      const result = await reserveBudget(512);

      expect(result).toMatchObject({ allowed: false, reason: 'month', reserved: 0, pct: 2 });
      expect(reserved).toEqual([MONTH]);
      expect(released).toEqual([[MONTH, askReservationCost(512)]]);
    });

    it('refuses on the day and refunds both keys', async () => {
      const { reserveBudget, setBudgetStore } = await import('@/lib/ask/budget');
      const released: string[] = [];
      const { store } = recordingStore({
        reserve: async (key) => (key === DAY ? CAPACITY * 3 : 0),
        release: async (key) => {
          released.push(key);
        },
      });
      setBudgetStore(store);

      const result = await reserveBudget(512);

      expect(result).toMatchObject({ allowed: false, reason: 'day', reserved: 0, pct: 3 });
      expect(released).toEqual([MONTH, DAY]);
    });

    it('fails closed with reason store when the month reservation throws', async () => {
      const { reserveBudget, setBudgetStore } = await import('@/lib/ask/budget');
      const { store } = recordingStore({
        reserve: async () => {
          throw new Error('redis down');
        },
      });
      setBudgetStore(store);
      expect(await reserveBudget(512)).toMatchObject({
        allowed: false,
        reason: 'store',
        reserved: 0,
        pct: 0,
        budgetKey: MONTH,
        dailyKey: DAY,
      });
      expect(logError).toHaveBeenCalled();
    });

    it('refunds the month when the day reservation throws, then fails closed', async () => {
      const { reserveBudget, setBudgetStore } = await import('@/lib/ask/budget');
      const released: string[] = [];
      const { store } = recordingStore({
        reserve: async (key) => {
          if (key === DAY) throw new Error('redis down');
          return 0;
        },
        release: async (key) => {
          released.push(key);
        },
      });
      setBudgetStore(store);
      expect(await reserveBudget(512)).toMatchObject({ allowed: false, reason: 'store' });
      expect(released).toEqual([MONTH]);
    });

    it('still refuses when a refund itself fails, and logs it', async () => {
      const { reserveBudget, setBudgetStore } = await import('@/lib/ask/budget');
      const { store } = recordingStore({
        reserve: async () => CAPACITY * 2,
        release: async () => {
          throw new Error('refund failed');
        },
      });
      setBudgetStore(store);
      expect(await reserveBudget(512)).toMatchObject({ allowed: false, reason: 'month' });
      expect(logError).toHaveBeenCalledWith(
        'budget reservation refund-on-reject failed',
        expect.objectContaining({ key: MONTH }),
      );
    });
  });

  describe('settleBudget', () => {
    async function settleSetup() {
      const budget = await import('@/lib/ask/budget');
      const { askBudgetCost } = await import('@/lib/ask/usage');
      const { store, calls } = recordingStore();
      budget.setBudgetStore(store);
      return { ...budget, calls, askBudgetCost, store };
    }

    it('skips a settlement with no positive reservation', async () => {
      const { settleBudget, calls } = await settleSetup();
      await settleBudget({
        reserved: 0,
        billedInputTokens: 10,
        outputTokens: 10,
        budgetKey: MONTH,
        dailyKey: DAY,
      });
      expect(calls).toEqual([]);
      expect(logWarn).toHaveBeenCalledWith(
        'budget settlement skipped: no positive reservation',
        expect.any(Object),
      );
    });

    it('does nothing when the actual cost equals the reservation', async () => {
      const { settleBudget, calls, askBudgetCost } = await settleSetup();
      const actual = askBudgetCost({
        billedInputTokens: 100,
        outputTokens: 50,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
      });
      await settleBudget({
        reserved: actual,
        billedInputTokens: 100,
        outputTokens: 50,
        budgetKey: MONTH,
        dailyKey: DAY,
      });
      expect(calls).toEqual([]);
    });

    it('refunds the unused part to both keys', async () => {
      const { settleBudget, calls, askBudgetCost } = await settleSetup();
      const actual = askBudgetCost({
        billedInputTokens: 100,
        outputTokens: 50,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
      });
      await settleBudget({
        reserved: actual + 40,
        billedInputTokens: 100,
        outputTokens: 50,
        budgetKey: MONTH,
        dailyKey: DAY,
      });
      expect(calls).toEqual([
        { op: 'release', key: MONTH, tokens: 40 },
        { op: 'release', key: DAY, tokens: 40 },
      ]);
    });

    it('refunds only the month when no day key is given', async () => {
      const { settleBudget, calls, askBudgetCost } = await settleSetup();
      const actual = askBudgetCost({
        billedInputTokens: 100,
        outputTokens: 50,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
      });
      await settleBudget({
        reserved: actual + 40,
        billedInputTokens: 100,
        outputTokens: 50,
        budgetKey: MONTH,
      });
      expect(calls).toEqual([{ op: 'release', key: MONTH, tokens: 40 }]);
    });

    it('charges usage above the reservation to both keys', async () => {
      const { settleBudget, calls, askBudgetCost } = await settleSetup();
      const actual = askBudgetCost({
        billedInputTokens: 100,
        outputTokens: 50,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
      });
      await settleBudget({
        reserved: actual - 25,
        billedInputTokens: 100,
        outputTokens: 50,
        budgetKey: MONTH,
        dailyKey: DAY,
      });
      expect(calls).toEqual([
        { op: 'chargeOverage', key: MONTH, tokens: 25 },
        { op: 'chargeOverage', key: DAY, tokens: 25 },
      ]);
    });

    it('prices cache reads and writes through the optional cache argument', async () => {
      const { settleBudget, calls, askBudgetCost } = await settleSetup();
      const plain = askBudgetCost({
        billedInputTokens: 100,
        outputTokens: 50,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
      });
      const cached = askBudgetCost({
        billedInputTokens: 100,
        outputTokens: 50,
        cacheReadTokens: 400,
        cacheWriteTokens: 300,
      });
      await settleBudget({
        reserved: plain,
        billedInputTokens: 100,
        outputTokens: 50,
        budgetKey: MONTH,
        cacheReadTokens: 400,
        cacheWriteTokens: 300,
      });
      expect(calls).toEqual([{ op: 'chargeOverage', key: MONTH, tokens: cached - plain }]);
    });

    it('logs a failed overage charge and a failed refund without throwing', async () => {
      const { settleBudget, setBudgetStore, askBudgetCost } = await settleSetup();
      const actual = askBudgetCost({
        billedInputTokens: 100,
        outputTokens: 50,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
      });
      const failing = recordingStore({
        chargeOverage: async () => {
          throw new Error('charge failed');
        },
        release: async () => {
          throw new Error('release failed');
        },
      }).store;
      setBudgetStore(failing);

      await expect(
        settleBudget({
          reserved: actual - 5,
          billedInputTokens: 100,
          outputTokens: 50,
          budgetKey: MONTH,
          dailyKey: DAY,
        }),
      ).resolves.toBeUndefined();
      await expect(
        settleBudget({
          reserved: actual + 5,
          billedInputTokens: 100,
          outputTokens: 50,
          budgetKey: MONTH,
          dailyKey: DAY,
        }),
      ).resolves.toBeUndefined();
      expect(logError).toHaveBeenCalledWith(
        'budget settlement overage charge failed',
        expect.objectContaining({ key: MONTH }),
      );
      expect(logError).toHaveBeenCalledWith(
        'budget settlement refund failed',
        expect.objectContaining({ key: DAY }),
      );
    });
  });

  describe('the Redis-backed store', () => {
    it('sizes the month at the cap and the day at one twentieth of it', async () => {
      const { reserveBudget, MONTHLY_BUDGET_USD } = await import('@/lib/ask/budget');
      const { ASK_BUDGET_UNITS_PER_USD } = await import('@/lib/ask/usage');
      const { askReservationCost } = await import('@/lib/ask/input-reservation');
      const month = MONTHLY_BUDGET_USD * ASK_BUDGET_UNITS_PER_USD;
      const reserved = askReservationCost(512);
      pipelineExec.mockResolvedValueOnce([month * 0.5, 1]);
      pipelineExec.mockResolvedValueOnce([(month / 20) * 0.25, 1]);

      const result = await reserveBudget(512);

      expect(result).toMatchObject({ allowed: true, pct: 0.5 });
      expect(reserved).toBeGreaterThan(0);
    });

    it('increments, then sets the expiry only when none exists', async () => {
      const { reserveBudget } = await import('@/lib/ask/budget');
      const { askReservationCost } = await import('@/lib/ask/input-reservation');
      await reserveBudget(512);
      const reserved = askReservationCost(512);
      expect(pipelineIncrby).toHaveBeenNthCalledWith(1, MONTH, reserved);
      expect(expire).toHaveBeenNthCalledWith(1, MONTH, 60 * 60 * 24 * 32, 'NX');
      expect(pipelineIncrby).toHaveBeenNthCalledWith(2, DAY, reserved);
      expect(expire).toHaveBeenNthCalledWith(2, DAY, 60 * 60 * 24 * 2, 'NX');
    });

    it('refunds with decrby and charges overage with incrby', async () => {
      const { settleBudget } = await import('@/lib/ask/budget');
      await settleBudget({
        reserved: 1_000_000,
        billedInputTokens: 1,
        outputTokens: 1,
        budgetKey: MONTH,
        dailyKey: DAY,
      });
      expect(decrby).toHaveBeenCalledTimes(2);
      expect(decrby).toHaveBeenCalledWith(MONTH, expect.any(Number));
      await settleBudget({
        reserved: 1,
        billedInputTokens: 1_000_000,
        outputTokens: 1_000_000,
        budgetKey: MONTH,
      });
      expect(incrby).toHaveBeenCalledWith(MONTH, expect.any(Number));
    });
  });

  describe('the eval store', () => {
    it('sizes capacity to one full reservation per request', async () => {
      const { createEvalBudgetStore } = await import('@/lib/eval/budget-store');
      const { askReservationCost } = await import('@/lib/ask/input-reservation');
      const { ASK_MAX_OUTPUT_TOKENS } = await import('@/lib/ask/limits');
      const store = createEvalBudgetStore(4);
      expect(store.capacity).toBe(4 * askReservationCost(ASK_MAX_OUTPUT_TOKENS));
      expect(store.dailyCapacity).toBe(store.capacity);
    });

    it('counts reservations per key and takes releases back', async () => {
      const { createEvalBudgetStore } = await import('@/lib/eval/budget-store');
      const store = createEvalBudgetStore(1);
      expect(await store.reserve('a', 5)).toBe(5);
      expect(await store.reserve('a', 3)).toBe(8);
      expect(await store.reserve('b', 2)).toBe(2);
      await store.release('a', 4);
      expect(await store.reserve('a', 0)).toBe(4);
    });

    it('ignores overage, so the store bounds request count only', async () => {
      const { createEvalBudgetStore } = await import('@/lib/eval/budget-store');
      const store = createEvalBudgetStore(1);
      await store.chargeOverage('a', 999);
      expect(await store.reserve('a', 0)).toBe(0);
    });

    it('lets reserveBudget admit exactly the run size and then refuse, without touching Redis', async () => {
      const { reserveBudget } = await import('@/lib/ask/budget');
      const { createEvalBudgetStore, setBudgetStore } = await import('@/lib/eval/budget-store');
      setBudgetStore(createEvalBudgetStore(2));
      expect((await reserveBudget(512)).allowed).toBe(true);
      expect((await reserveBudget(512)).allowed).toBe(true);
      expect(await reserveBudget(512)).toMatchObject({ allowed: false, reason: 'month' });
      expect(pipelineExec).not.toHaveBeenCalled();
    });
  });
});
