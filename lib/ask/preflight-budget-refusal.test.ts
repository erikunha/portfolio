import { beforeEach, describe, expect, it, vi } from 'vitest';
import { askErrors } from '@/content/ask-errors';

const checkIdenticalQuestion = vi.hoisted(() => vi.fn());
const releaseIdenticalQuestion = vi.hoisted(() => vi.fn(async () => undefined));
const reserveBudget = vi.hoisted(() => vi.fn());
const countAskRefusal = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock('@/lib/env', () => ({ env: { ASK_ENABLED: undefined } }));
vi.mock('@/lib/rate-limit', () => ({
  getClientIp: vi.fn(() => '127.0.0.1'),
  getAskLimit: vi.fn(() => ({ limit: vi.fn(async () => ({ success: true })) })),
  hasRedisCredentials: vi.fn(() => true),
  checkIdenticalQuestion,
  releaseIdenticalQuestion,
  reserveBudget,
}));
vi.mock('@/lib/ask/refusal-count', () => ({ countAskRefusal }));
vi.mock('@/lib/ip-hash', () => ({ hashIp: vi.fn(async () => 'hashed-ip') }));
vi.mock('@/lib/server/after-response', () => ({
  afterResponse: (task: () => Promise<void>) => void task(),
}));
vi.mock('@/lib/log', () => ({
  log: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

const QUESTION = 'What does Erik build?';

function request(locale = 'en'): Request {
  return new Request('http://localhost/api/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: QUESTION, locale }),
  });
}

function refusal(reason: 'month' | 'day' | 'store') {
  return { allowed: false, reserved: 0, pct: 1, budgetKey: 'k', dailyKey: 'd', reason };
}

async function refused(locale = 'en') {
  const { preflightAsk } = await import('@/lib/ask/preflight');
  const result = await preflightAsk(request(locale));
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error('expected a refusal');
  return {
    status: result.response.status,
    body: (await result.response.json()) as { error: string },
  };
}

describe('preflight when the budget reservation is refused', () => {
  beforeEach(() => {
    checkIdenticalQuestion.mockReset().mockResolvedValue({ allowed: true });
    releaseIdenticalQuestion.mockClear();
    reserveBudget.mockReset();
    countAskRefusal.mockClear();
  });

  it('tells the visitor the month is paused when the monthly cap is crossed', async () => {
    reserveBudget.mockResolvedValue(refusal('month'));
    const { status, body } = await refused();
    expect(status).toBe(503);
    expect(body.error).toBe(askErrors.en.budget);
    expect(countAskRefusal).toHaveBeenCalledWith('budget-exhausted');
  });

  it.each([
    ['en', askErrors.en.budgetDaily],
    ['pt', askErrors.pt.budgetDaily],
  ])(
    'tells the visitor the day is used up when only the daily slice is crossed (%s)',
    async (locale, message) => {
      reserveBudget.mockResolvedValue(refusal('day'));
      const { status, body } = await refused(locale);
      expect(status).toBe(503);
      expect(
        body.error,
        'a daily limit read as "paused this month" sends visitors away for weeks',
      ).toBe(message);
      expect(countAskRefusal).toHaveBeenCalledWith('budget-exhausted');
    },
  );

  it('answers unavailable and counts its own refusal when the budget store is down', async () => {
    reserveBudget.mockResolvedValue(refusal('store'));
    const { status, body } = await refused();
    expect(status).toBe(503);
    expect(body.error).toBe(askErrors.en.unavailable);
    expect(countAskRefusal).toHaveBeenCalledWith('budget-store-unavailable');
    expect(
      countAskRefusal,
      'an outage counted as an exhausted budget hides the outage behind the spend counter',
    ).not.toHaveBeenCalledWith('budget-exhausted');
  });

  it.each(['month', 'day', 'store'] as const)(
    'releases the identical-question lock after a %s refusal so a retry is not turned away',
    async (reason) => {
      reserveBudget.mockResolvedValue(refusal(reason));
      await refused();
      expect(releaseIdenticalQuestion).toHaveBeenCalledWith('hashed-ip', QUESTION);
    },
  );

  it('keeps the lock when the request is granted a reservation', async () => {
    reserveBudget.mockResolvedValue({
      allowed: true,
      reserved: 1512,
      pct: 0,
      budgetKey: 'k',
      dailyKey: 'd',
    });
    const { preflightAsk } = await import('@/lib/ask/preflight');
    const result = await preflightAsk(request());
    expect(result.ok).toBe(true);
    expect(releaseIdenticalQuestion).not.toHaveBeenCalled();
  });
});
