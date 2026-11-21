// @vitest-environment node

import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BudgetStore } from '@/lib/ask/budget';

const del = vi.hoisted(() => vi.fn());
const logError = vi.hoisted(() => vi.fn());
const logWarn = vi.hoisted(() => vi.fn());
const events = vi.hoisted((): string[] => []);

vi.mock('@/lib/redis', () => ({ getRedis: () => ({ del }) }));
vi.mock('@/lib/log', async () =>
  (await import('@/__tests__/helpers/modules')).logModule({ warn: logWarn, error: logError }),
);

const MONTH = 'ask:spend:2026-11';
const DAY = 'ask:spend:day:2026-11-15';
const IP_HASH = 'hashed-ip';
const QUESTION = 'What does Erik build?';
const CAPACITY = 1_000_000_000_000;
const RESERVED = 5_000_000_000;

const lockKey = `ask:dedup:${IP_HASH}:${createHash('sha256').update(QUESTION).digest('hex').slice(0, 16)}`;

type StoreCall = { op: 'release' | 'chargeOverage'; key: string; tokens: number };

function recordingStore(failRelease = false): { store: BudgetStore; calls: StoreCall[] } {
  const calls: StoreCall[] = [];
  const store: BudgetStore = {
    capacity: CAPACITY,
    dailyCapacity: CAPACITY,
    reserve: async () => 0,
    release: async (key, tokens) => {
      events.push(`store:release:${key}`);
      calls.push({ op: 'release', key, tokens });
      if (failRelease) throw new Error('refund failed');
    },
    chargeOverage: async (key, tokens) => {
      events.push(`store:chargeOverage:${key}`);
      calls.push({ op: 'chargeOverage', key, tokens });
    },
  };
  return { store, calls };
}

function reservation(reserved = RESERVED) {
  return { reserved, budgetKey: MONTH, dailyKey: DAY, ipHash: IP_HASH, question: QUESTION };
}

async function setup(failRelease = false) {
  const budget = await import('@/lib/ask/budget');
  const { askBudgetCost } = await import('@/lib/ask/usage');
  const { store, calls } = recordingStore(failRelease);
  budget.setBudgetStore(store);
  return { ...budget, askBudgetCost, calls };
}

const PLAIN = { billedInputTokens: 100, outputTokens: 50 };
const CACHED = {
  billedInputTokens: 3000,
  outputTokens: 50,
  cacheReadTokens: 2000,
  cacheWriteTokens: 500,
};

beforeEach(() => {
  vi.resetModules();
  del.mockReset().mockImplementation(async (key: string) => {
    events.push(`dedup:del:${key}`);
    return 1;
  });
  logError.mockClear();
  logWarn.mockClear();
  events.length = 0;
});

describe('settlement argument mapping', () => {
  const BASE_PARAMS = {
    reserved: RESERVED,
    billedInputTokens: 100,
    outputTokens: 50,
    budgetKey: MONTH,
    dailyKey: DAY,
  };

  it.each([
    ['no usage', 'none' as const, { ...BASE_PARAMS, billedInputTokens: 0, outputTokens: 0 }],
    ['usage without cache counts', PLAIN, BASE_PARAMS],
    ['usage with only a read count', { ...PLAIN, cacheReadTokens: 7 }, BASE_PARAMS],
    ['usage with only a write count', { ...PLAIN, cacheWriteTokens: 9 }, BASE_PARAMS],
    [
      'usage with both cache counts',
      { ...PLAIN, cacheReadTokens: 7, cacheWriteTokens: 9 },
      { ...BASE_PARAMS, cacheReadTokens: 7, cacheWriteTokens: 9 },
    ],
    [
      'usage with zero cache counts',
      { ...PLAIN, cacheReadTokens: 0, cacheWriteTokens: 0 },
      { ...BASE_PARAMS, cacheReadTokens: 0, cacheWriteTokens: 0 },
    ],
  ])('maps %s to the settleBudget parameters', async (_name, usage, expected) => {
    const { settleParams } = await import('@/lib/ask/budget');

    expect(settleParams(reservation(), usage)).toEqual(expected);
  });

  it('settles an abandoned reservation as no usage', async () => {
    const { abandonSettleParams } = await import('@/lib/ask/budget');

    expect(abandonSettleParams(reservation())).toEqual({
      ...BASE_PARAMS,
      billedInputTokens: 0,
      outputTokens: 0,
    });
  });

  it('settles nothing for an abandoned reservation that reserved nothing', async () => {
    const { abandonSettleParams } = await import('@/lib/ask/budget');

    expect(abandonSettleParams(reservation(0))).toBeNull();
  });
});

describe('settleReservation', () => {
  it.each([
    ['plain usage', PLAIN],
    ['usage with cache read and write counts', CACHED],
  ])('refunds reserved minus the actual cost to both keys for %s', async (_name, usage) => {
    const { settleReservation, askBudgetCost, calls } = await setup();
    const actual = askBudgetCost({ cacheReadTokens: 0, cacheWriteTokens: 0, ...usage });
    expect(actual).toBeLessThan(RESERVED);

    await settleReservation(reservation(), usage);

    expect(calls).toEqual([
      { op: 'release', key: MONTH, tokens: RESERVED - actual },
      { op: 'release', key: DAY, tokens: RESERVED - actual },
    ]);
  });

  it('charges the overage to both keys when the usage costs more than the reservation', async () => {
    const { settleReservation, askBudgetCost, calls } = await setup();
    const actual = askBudgetCost({ cacheReadTokens: 0, cacheWriteTokens: 0, ...PLAIN });

    await settleReservation(reservation(actual - 40), PLAIN);

    expect(calls).toEqual([
      { op: 'chargeOverage', key: MONTH, tokens: 40 },
      { op: 'chargeOverage', key: DAY, tokens: 40 },
    ]);
  });

  it("gives the whole reservation back for 'none'", async () => {
    const { settleReservation, calls } = await setup();

    await settleReservation(reservation(), 'none');

    expect(calls).toEqual([
      { op: 'release', key: MONTH, tokens: RESERVED },
      { op: 'release', key: DAY, tokens: RESERVED },
    ]);
  });

  it('touches nothing and warns when the reservation was refused', async () => {
    const { settleReservation, calls } = await setup();

    await settleReservation(reservation(0), 'none');

    expect(calls).toEqual([]);
    expect(logWarn).toHaveBeenCalledWith(
      'budget settlement skipped: no positive reservation',
      expect.any(Object),
    );
  });

  it('leaves the identical-question lock to expire on its own', async () => {
    const { settleReservation } = await setup();

    await settleReservation(reservation(), 'none');

    expect(del).not.toHaveBeenCalled();
  });
});

describe('abandonReservation', () => {
  it('refunds the whole reservation to both keys, then releases the identical-question lock', async () => {
    const { abandonReservation, calls } = await setup();

    await abandonReservation(reservation());

    expect(calls).toEqual([
      { op: 'release', key: MONTH, tokens: RESERVED },
      { op: 'release', key: DAY, tokens: RESERVED },
    ]);
    expect(events).toEqual([
      `store:release:${MONTH}`,
      `store:release:${DAY}`,
      `dedup:del:${lockKey}`,
    ]);
  });

  it('only releases the lock when the reservation was refused, with no warning', async () => {
    const { abandonReservation, calls } = await setup();

    await abandonReservation(reservation(0));

    expect(calls).toEqual([]);
    expect(logWarn).not.toHaveBeenCalled();
    expect(del).toHaveBeenCalledExactlyOnceWith(lockKey);
  });

  it('resolves and logs when the lock release fails, after the refund went through', async () => {
    del.mockRejectedValue(new Error('redis down'));
    const { abandonReservation, calls } = await setup();

    await expect(abandonReservation(reservation())).resolves.toBeUndefined();

    expect(calls.map((c) => c.key)).toEqual([MONTH, DAY]);
    expect(logError).toHaveBeenCalledWith(
      'identical-question release failed, the lock expires on its own',
      expect.any(Object),
    );
  });

  it('still releases the lock when a refund fails', async () => {
    const { abandonReservation } = await setup(true);

    await expect(abandonReservation(reservation())).resolves.toBeUndefined();

    expect(logError).toHaveBeenCalledWith(
      'budget settlement refund failed',
      expect.objectContaining({ key: MONTH }),
    );
    expect(del).toHaveBeenCalledExactlyOnceWith(lockKey);
  });
});
