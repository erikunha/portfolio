import { describe, expect, it } from 'vitest';
import { getBudgetKey, getDailyBudgetKey } from '@/lib/rate-limit';

const LEGACY_TOKEN_KEY_PREFIX = 'ask:tokens:';

describe('budget counters live under keys the token-metered build never reads', () => {
  it('keeps the monthly spend counter out of the legacy token namespace', () => {
    expect(getBudgetKey().startsWith(LEGACY_TOKEN_KEY_PREFIX)).toBe(false);
  });

  it('keeps the daily spend counter out of the legacy token namespace', () => {
    expect(getDailyBudgetKey().startsWith(LEGACY_TOKEN_KEY_PREFIX)).toBe(false);
  });

  it('still partitions the month and the day apart', () => {
    expect(getBudgetKey()).not.toBe(getDailyBudgetKey());
    expect(getDailyBudgetKey().startsWith(getBudgetKey())).toBe(false);
  });
});
