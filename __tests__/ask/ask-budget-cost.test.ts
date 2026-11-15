// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ASK_RESERVED_INPUT_TOKENS } from '@/lib/ask/input-reservation';
import { ASK_MAX_OUTPUT_TOKENS } from '@/lib/ask/limits';
import { featureCostUsdFrom } from '@/lib/eval/cost';

const counters = new Map<string, number>();
const bump = (key: string, by: number): number => {
  const next = (counters.get(key) ?? 0) + by;
  counters.set(key, next);
  return next;
};

vi.mock('@upstash/redis', () => ({
  Redis: {
    fromEnv: () => ({
      decrby: async (key: string, n: number) => bump(key, -n),
      incrby: async (key: string, n: number) => bump(key, n),
      pipeline: () => {
        const pending: Array<() => number> = [];
        return {
          incrby: (key: string, n: number) => {
            pending.push(() => bump(key, n));
          },
          expire: vi.fn(),
          exec: async () => [pending.reduce((_, run) => run(), 0), 1],
        };
      },
    }),
  },
}));
vi.mock('@upstash/ratelimit', () => ({ Ratelimit: { slidingWindow: () => ({}) } }));
vi.mock('@/lib/log', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const CACHED_PROMPT_TOKENS = 17_000;
const CACHED_PROMPT_UNCACHED_TOKENS = 500;
const TYPICAL_OUTPUT_TOKENS = 350;
const CACHE_HIT_USAGE = {
  billedInputTokens: CACHED_PROMPT_TOKENS,
  cacheReadTokens: CACHED_PROMPT_TOKENS - CACHED_PROMPT_UNCACHED_TOKENS,
  cacheWriteTokens: 0,
  outputTokens: TYPICAL_OUTPUT_TOKENS,
};
const CACHE_MISS_USAGE = {
  billedInputTokens: CACHED_PROMPT_TOKENS,
  cacheReadTokens: 0,
  cacheWriteTokens: CACHED_PROMPT_TOKENS - CACHED_PROMPT_UNCACHED_TOKENS,
  outputTokens: TYPICAL_OUTPUT_TOKENS,
};
const OLD_ASKS_PER_DAY = 8;
const MIN_ASKS_PER_DAY_WHEN_CACHED = 300;
const NANO_USD_PER_USD = 1_000_000_000;
const OLD_MONTHLY_TOKEN_CAP = 3_000_000;
const HAIKU_4_5_INPUT_USD_PER_MTOK = 1;
const TOKENS_PER_MTOK = 1_000_000;
const SAFETY_ASK_LIMIT = 100_000;

describe('the ask budget measures cost, not raw token count', () => {
  beforeEach(() => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://redis.test');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'test-token');
    vi.resetModules();
    counters.clear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('prices each token class at its Gateway rate in whole nano-USD', async () => {
    const { askBudgetCost } = await import('@/lib/ask/usage');
    const zero = { billedInputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, outputTokens: 0 };
    expect(askBudgetCost({ ...zero, billedInputTokens: 1000 })).toBe(100_000);
    expect(askBudgetCost({ ...zero, billedInputTokens: 1000, cacheReadTokens: 1000 })).toBe(10_000);
    expect(askBudgetCost({ ...zero, billedInputTokens: 1000, cacheWriteTokens: 1000 })).toBe(
      125_000,
    );
    expect(askBudgetCost({ ...zero, outputTokens: 1000 })).toBe(500_000);
    expect(
      askBudgetCost({
        billedInputTokens: 1000,
        cacheReadTokens: 400,
        cacheWriteTokens: 100,
        outputTokens: 10,
      }),
    ).toBe(500 * 100 + 400 * 10 + 100 * 125 + 10 * 500);
  });

  it('never goes negative when the cache split reports more than the billed input', async () => {
    const { askBudgetCost } = await import('@/lib/ask/usage');
    expect(
      askBudgetCost({
        billedInputTokens: 10,
        cacheReadTokens: 50,
        cacheWriteTokens: 0,
        outputTokens: 0,
      }),
    ).toBeGreaterThanOrEqual(0);
  });

  it('agrees with the eval harness cost formula to the nano-USD', async () => {
    const { askBudgetCost } = await import('@/lib/ask/usage');
    for (const usage of [CACHE_HIT_USAGE, CACHE_MISS_USAGE]) {
      expect(
        Math.abs(askBudgetCost(usage) - featureCostUsdFrom(usage) * NANO_USD_PER_USD),
      ).toBeLessThan(1);
    }
  });

  it('reserves at least the worst case a request can cost, with the whole prompt written to the cache', async () => {
    const { askReservationCost } = await import('@/lib/ask/input-reservation');
    const { askBudgetCost } = await import('@/lib/ask/usage');
    const worstCase = askBudgetCost({
      billedInputTokens: ASK_RESERVED_INPUT_TOKENS,
      cacheReadTokens: 0,
      cacheWriteTokens: ASK_RESERVED_INPUT_TOKENS,
      outputTokens: ASK_MAX_OUTPUT_TOKENS,
    });
    expect(askReservationCost(ASK_MAX_OUTPUT_TOKENS)).toBeGreaterThanOrEqual(worstCase);
  });

  it('keeps the monthly dollar ceiling at or below the old 3M-token cap priced at Haiku 4.5 input', async () => {
    const { MONTHLY_BUDGET_USD } = await import('@/lib/rate-limit');
    expect(MONTHLY_BUDGET_USD).toBeLessThanOrEqual(
      (OLD_MONTHLY_TOKEN_CAP / TOKENS_PER_MTOK) * HAIKU_4_5_INPUT_USD_PER_MTOK,
    );
  });

  it('admits hundreds of cache-hit asks a day where 8 exhausted the old token slice', async () => {
    const { reserveBudget, settleBudget } = await import('@/lib/rate-limit');
    let admitted = 0;
    let refusal: string | undefined;
    while (admitted < SAFETY_ASK_LIMIT) {
      const reservation = await reserveBudget(ASK_MAX_OUTPUT_TOKENS);
      if (!reservation.allowed) {
        refusal = reservation.reason;
        break;
      }
      await settleBudget(
        reservation.reserved,
        CACHE_HIT_USAGE.billedInputTokens,
        CACHE_HIT_USAGE.outputTokens,
        reservation.budgetKey,
        reservation.dailyKey,
        {
          cacheReadTokens: CACHE_HIT_USAGE.cacheReadTokens,
          cacheWriteTokens: CACHE_HIT_USAGE.cacheWriteTokens,
        },
      );
      admitted += 1;
    }
    expect(refusal).toBe('day');
    expect(admitted).toBeGreaterThan(OLD_ASKS_PER_DAY);
    expect(admitted).toBeGreaterThanOrEqual(MIN_ASKS_PER_DAY_WHEN_CACHED);
  });

  it('still bounds a day of all-miss asks by dollars', async () => {
    const { MONTHLY_BUDGET_USD, reserveBudget, settleBudget } = await import('@/lib/rate-limit');
    const { askBudgetCost } = await import('@/lib/ask/usage');
    const missCost = askBudgetCost(CACHE_MISS_USAGE);
    let spent = 0;
    for (let ask = 0; ask < SAFETY_ASK_LIMIT; ask += 1) {
      const reservation = await reserveBudget(ASK_MAX_OUTPUT_TOKENS);
      if (!reservation.allowed) break;
      await settleBudget(
        reservation.reserved,
        CACHE_MISS_USAGE.billedInputTokens,
        CACHE_MISS_USAGE.outputTokens,
        reservation.budgetKey,
        reservation.dailyKey,
        {
          cacheReadTokens: CACHE_MISS_USAGE.cacheReadTokens,
          cacheWriteTokens: CACHE_MISS_USAGE.cacheWriteTokens,
        },
      );
      spent += missCost;
    }
    expect(spent / NANO_USD_PER_USD).toBeLessThanOrEqual(MONTHLY_BUDGET_USD);
    expect(spent).toBeGreaterThan(0);
  });

  it('settles the monthly and the daily counter to exactly the metered cost', async () => {
    const { reserveBudget, settleBudget } = await import('@/lib/rate-limit');
    const { askBudgetCost } = await import('@/lib/ask/usage');
    const { reserved, budgetKey, dailyKey } = await reserveBudget(ASK_MAX_OUTPUT_TOKENS);
    expect(counters.get(budgetKey)).toBe(reserved);
    await settleBudget(
      reserved,
      CACHE_HIT_USAGE.billedInputTokens,
      CACHE_HIT_USAGE.outputTokens,
      budgetKey,
      dailyKey,
      {
        cacheReadTokens: CACHE_HIT_USAGE.cacheReadTokens,
        cacheWriteTokens: CACHE_HIT_USAGE.cacheWriteTokens,
      },
    );
    expect(counters.get(budgetKey)).toBe(askBudgetCost(CACHE_HIT_USAGE));
    expect(counters.get(dailyKey)).toBe(askBudgetCost(CACHE_HIT_USAGE));
  });

  it('charges the overage when metered cost exceeds the reservation', async () => {
    const { reserveBudget, settleBudget } = await import('@/lib/rate-limit');
    const { askBudgetCost } = await import('@/lib/ask/usage');
    const { reserved, budgetKey, dailyKey } = await reserveBudget(ASK_MAX_OUTPUT_TOKENS);
    const huge = {
      billedInputTokens: ASK_RESERVED_INPUT_TOKENS * 2,
      cacheReadTokens: 0,
      cacheWriteTokens: ASK_RESERVED_INPUT_TOKENS * 2,
      outputTokens: ASK_MAX_OUTPUT_TOKENS,
    };
    await settleBudget(reserved, huge.billedInputTokens, huge.outputTokens, budgetKey, dailyKey, {
      cacheReadTokens: 0,
      cacheWriteTokens: huge.cacheWriteTokens,
    });
    expect(counters.get(budgetKey)).toBe(askBudgetCost(huge));
  });

  it('prices input at the full rate when the caller has no cache split', async () => {
    const { reserveBudget, settleBudget } = await import('@/lib/rate-limit');
    const { reserved, budgetKey, dailyKey } = await reserveBudget(ASK_MAX_OUTPUT_TOKENS);
    await settleBudget(reserved, 1000, 0, budgetKey, dailyKey);
    expect(counters.get(budgetKey)).toBe(100_000);
  });
});
