import { releaseIdenticalQuestion } from '@/lib/ask/dedup';
import { askReservationCost } from '@/lib/ask/input-reservation';
import { ASK_BUDGET_UNITS_PER_USD, askBudgetCost } from '@/lib/ask/usage';
import { log } from '@/lib/log';
import { getRedis } from '@/lib/redis';
import { utcDay } from '@/lib/time';

export const MONTHLY_BUDGET_USD = 3;
const DAILY_BUDGET_DIVISOR = 20;
const MONTHLY_BUDGET_UNITS = MONTHLY_BUDGET_USD * ASK_BUDGET_UNITS_PER_USD;
const DAILY_BUDGET_UNITS = MONTHLY_BUDGET_UNITS / DAILY_BUDGET_DIVISOR;
const BUDGET_WINDOW_S = 60 * 60 * 24 * 32;
const DAILY_BUDGET_WINDOW_S = 60 * 60 * 24 * 2;

const BUDGET_WARN_PCT = 0.8;

export type BudgetStore = {
  capacity: number;
  dailyCapacity: number;
  reserve(budgetKey: string, tokens: number, windowSeconds?: number): Promise<number>;
  release(budgetKey: string, tokens: number): Promise<void>;
  chargeOverage(budgetKey: string, tokens: number): Promise<void>;
};

const redisBudgetStore: BudgetStore = {
  capacity: MONTHLY_BUDGET_UNITS,
  dailyCapacity: DAILY_BUDGET_UNITS,
  async reserve(budgetKey, tokens, windowSeconds = BUDGET_WINDOW_S) {
    const pipe = getRedis().pipeline();
    pipe.incrby(budgetKey, tokens);
    pipe.expire(budgetKey, windowSeconds, 'NX');
    const [used] = await pipe.exec<[number, number]>();
    return used;
  },
  async release(budgetKey, tokens) {
    await getRedis().decrby(budgetKey, tokens);
  },
  async chargeOverage(budgetKey, tokens) {
    await getRedis().incrby(budgetKey, tokens);
  },
};

let budgetStore: BudgetStore = redisBudgetStore;

export function setBudgetStore(store: BudgetStore): void {
  budgetStore = store;
}

export function getBudgetKey(): string {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `ask:spend:${yyyy}-${mm}`;
}

export function getDailyBudgetKey(): string {
  return `ask:spend:day:${utcDay(new Date())}`;
}

export type BudgetRefusalReason = 'month' | 'day' | 'store';

type BudgetReservationKeys = {
  reserved: number;
  pct: number;
  budgetKey: string;
  dailyKey: string;
};

export type BudgetReservation =
  | ({ allowed: true } & BudgetReservationKeys)
  | ({ allowed: false; reason: BudgetRefusalReason } & BudgetReservationKeys);

async function refundReservation(keys: string[], tokens: number): Promise<void> {
  for (const key of keys) {
    try {
      await budgetStore.release(key, tokens);
    } catch (refundErr) {
      log.error('budget reservation refund-on-reject failed', { key, err: refundErr });
    }
  }
}

export async function reserveBudget(maxOutputTokens: number): Promise<BudgetReservation> {
  const reserved = askReservationCost(maxOutputTokens);
  const budgetKey = getBudgetKey();
  const dailyKey = getDailyBudgetKey();
  const denied = (reason: BudgetRefusalReason, pct: number): BudgetReservation => ({
    allowed: false,
    reason,
    reserved: 0,
    pct,
    budgetKey,
    dailyKey,
  });
  try {
    const monthlyPct = (await budgetStore.reserve(budgetKey, reserved)) / budgetStore.capacity;
    if (monthlyPct > 1) {
      await refundReservation([budgetKey], reserved);
      return denied('month', monthlyPct);
    }
    let dailyPct: number;
    try {
      dailyPct =
        (await budgetStore.reserve(dailyKey, reserved, DAILY_BUDGET_WINDOW_S)) /
        budgetStore.dailyCapacity;
    } catch (dailyErr) {
      await refundReservation([budgetKey], reserved);
      throw dailyErr;
    }
    if (dailyPct > 1) {
      await refundReservation([budgetKey, dailyKey], reserved);
      log.warn('daily budget slice exhausted', { dailyPct, monthlyPct });
      return denied('day', Math.max(monthlyPct, dailyPct));
    }
    const pct = Math.max(monthlyPct, dailyPct);
    if (pct >= BUDGET_WARN_PCT) log.warn('budget approaching cap', { monthlyPct, dailyPct });
    return { allowed: true, reserved, pct, budgetKey, dailyKey };
  } catch (err) {
    log.error('budget reservation failed, rejecting request', { err });
    return denied('store', 0);
  }
}

export async function settleBudget(
  reserved: number,
  actualInputTokens: number,
  actualOutputTokens: number,
  budgetKey: string,
  dailyKey?: string,
  cache: { cacheReadTokens: number; cacheWriteTokens: number } = {
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
  },
): Promise<void> {
  if (reserved <= 0) {
    log.warn('budget settlement skipped: no positive reservation', { budgetKey });
    return;
  }
  const actual = askBudgetCost({
    billedInputTokens: actualInputTokens,
    outputTokens: actualOutputTokens,
    ...cache,
  });
  const refund = reserved - actual;
  if (refund === 0) return;
  const keys = dailyKey === undefined ? [budgetKey] : [budgetKey, dailyKey];
  for (const key of keys) {
    if (refund < 0) {
      try {
        await budgetStore.chargeOverage(key, -refund);
      } catch (err) {
        log.error('budget settlement overage charge failed', { key, err });
      }
    } else {
      try {
        await budgetStore.release(key, refund);
      } catch (err) {
        log.error('budget settlement refund failed', { key, err });
      }
    }
  }
}

export type AskReservation = {
  reserved: number;
  budgetKey: string;
  dailyKey: string;
  ipHash: string;
  question: string;
};

export type ReservationUsage = {
  billedInputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
};

export async function settleReservation(
  reservation: AskReservation,
  usage: ReservationUsage | 'none',
): Promise<void> {
  const { reserved, budgetKey, dailyKey } = reservation;
  if (usage === 'none') {
    await settleBudget(reserved, 0, 0, budgetKey, dailyKey);
    return;
  }
  const { billedInputTokens, outputTokens, cacheReadTokens, cacheWriteTokens } = usage;
  if (cacheReadTokens === undefined || cacheWriteTokens === undefined) {
    await settleBudget(reserved, billedInputTokens, outputTokens, budgetKey, dailyKey);
    return;
  }
  await settleBudget(reserved, billedInputTokens, outputTokens, budgetKey, dailyKey, {
    cacheReadTokens,
    cacheWriteTokens,
  });
}

export async function abandonReservation(reservation: AskReservation): Promise<void> {
  if (reservation.reserved > 0) await settleReservation(reservation, 'none');
  await releaseIdenticalQuestion(reservation.ipHash, reservation.question);
}
