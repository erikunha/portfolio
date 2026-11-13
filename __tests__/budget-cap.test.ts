// @vitest-environment node

import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ASK_RESERVED_INPUT_TOKENS, askReservationCost } from '@/lib/ask/input-reservation';
import { ASK_BUDGET_UNITS_PER_USD, askBudgetCost } from '@/lib/ask/usage';

const rateLimitMock = vi.fn(async () => ({ success: true }));
const streamTextMock = vi.fn(() => ({
  textStream: (async function* () {
    yield 'Erik builds web applications.';
  })(),
  usage: Promise.resolve({ inputTokens: 120, outputTokens: 80 }),
}));

vi.mock('ai', () => ({ streamText: streamTextMock }));
vi.mock('@/lib/env', () => ({ env: { ASK_ENABLED: 'true' } }));
vi.mock('@/lib/ip-hash', () => ({ hashIp: vi.fn(async () => 'test-ip-hash') }));
vi.mock('@/lib/ask-log', () => ({ persistAskInteraction: vi.fn(async () => undefined) }));

const counter: { value: number } = { value: 0 };
const dailyCounter: { value: number } = { value: 0 };
const counterFor = (key: string) => (key.includes(':day:') ? dailyCounter : counter);
const decrbyMock = vi.fn(async (key: string, n: number): Promise<number> => {
  counterFor(key).value -= n;
  return counterFor(key).value;
});

const pipelineExec = vi.fn(async (): Promise<[number, number]> => [pipelineUsed.value, 1]);
const pipelineUsed: { value: number } = { value: 0 };

vi.mock('@upstash/redis', () => ({
  Redis: {
    fromEnv: () => ({
      get: vi.fn(async () => counter.value),
      set: vi.fn(async () => 'OK'),
      decrby: decrbyMock,
      incrby: vi.fn(async (key: string, n: number): Promise<number> => {
        counterFor(key).value += n;
        return counterFor(key).value;
      }),
      pipeline: () => ({
        incrby: (key: string, n: number) => {
          counterFor(key).value += n;
          pipelineUsed.value = counterFor(key).value;
        },
        expire: vi.fn(),
        exec: pipelineExec,
      }),
    }),
  },
}));

vi.mock('@upstash/ratelimit', () => {
  function Ratelimit() {
    return { limit: rateLimitMock };
  }
  Ratelimit.slidingWindow = () => ({});
  return { Ratelimit };
});

vi.mock('@/lib/log', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe('budget reservation pattern', () => {
  beforeEach(() => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://redis.test');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'test-token');
    counter.value = 0;
    dailyCounter.value = 0;
    vi.clearAllMocks();
    rateLimitMock.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const INPUT_RESERVATION = ASK_RESERVED_INPUT_TOKENS;
  const RESERVATION = askReservationCost(512);
  const MONTHLY_CAPACITY = 3 * ASK_BUDGET_UNITS_PER_USD;
  const DAILY_CAPACITY = MONTHLY_CAPACITY / 20;
  const costOf = (input: number, output: number) =>
    askBudgetCost({
      billedInputTokens: input,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      outputTokens: output,
    });

  it('reserves at least the whole system prompt and a full question at 3 chars per token', async () => {
    const { SYSTEM_TEXT } = await import('@/lib/ask/system-prompt');
    const { ASK_MAX_QUESTION_CHARS } = await import('@/lib/ask/limits');
    expect(INPUT_RESERVATION).toBeGreaterThanOrEqual(
      Math.ceil((SYSTEM_TEXT.length + ASK_MAX_QUESTION_CHARS) / 3),
    );
  });

  it('rejects the reservation when Redis throws', async () => {
    pipelineExec.mockRejectedValueOnce(new Error('Redis unavailable'));
    const { reserveBudget } = await import('@/lib/rate-limit');
    const result = await reserveBudget(512);
    expect(result).toMatchObject({ allowed: false, reserved: 0, reason: 'store' });
  });

  it('answers unavailable, not "paused for this month", without starting the model on Redis failure', async () => {
    rateLimitMock.mockRejectedValueOnce(new Error('Redis unavailable'));
    pipelineExec.mockRejectedValueOnce(new Error('Redis unavailable'));
    const { POST } = await import('@/app/api/ask/route');
    const response = await POST(
      new NextRequest('https://www.erikunha.dev/api/ask', {
        method: 'POST',
        body: JSON.stringify({ question: 'What does Erik build?' }),
      }),
    );
    expect(response.status).toBe(503);
    expect(
      await response.json(),
      'a store outage told the visitor the budget was spent for the month',
    ).toEqual({
      error: 'temporarily unavailable: email erikhenriquealvescunha@gmail.com directly',
    });
    expect(streamTextMock).not.toHaveBeenCalled();
  });

  it('still streams an answer when rate limiting throws but the budget can be reserved', async () => {
    rateLimitMock.mockRejectedValueOnce(new Error('Rate limiter unavailable'));
    const { POST } = await import('@/app/api/ask/route');
    const response = await POST(
      new NextRequest('https://www.erikunha.dev/api/ask', {
        method: 'POST',
        body: JSON.stringify({ question: 'What does Erik build?' }),
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('Erik builds web applications.');
    expect(pipelineExec).toHaveBeenCalledTimes(2);
    expect(streamTextMock).toHaveBeenCalledOnce();
  });

  it('reserves the worst-case cost of the input reservation and maxOutputTokens upfront and allows within cap', async () => {
    const { reserveBudget } = await import('@/lib/rate-limit');
    const result = await reserveBudget(512);
    expect(result.allowed).toBe(true);
    expect(result.reserved).toBe(RESERVATION);
    expect(counter.value).toBe(RESERVATION);
  });

  it('rejects and refunds the reservation when it would cross the monthly dollar cap', async () => {
    counter.value = MONTHLY_CAPACITY - RESERVATION + 1;
    const { reserveBudget } = await import('@/lib/rate-limit');
    const result = await reserveBudget(512);
    expect(result.allowed).toBe(false);
    expect(result.reserved).toBe(0);
    expect(decrbyMock).toHaveBeenCalledWith(expect.stringMatching(/ask:tokens:/), RESERVATION);
  });

  it('settleBudget refunds (reserved - actual) when actual is less than reserved', async () => {
    const { reserveBudget, settleBudget } = await import('@/lib/rate-limit');
    const result = await reserveBudget(512);
    const { reserved, budgetKey } = result;
    decrbyMock.mockClear();
    await settleBudget(reserved, 120, 80, budgetKey);
    expect(decrbyMock).toHaveBeenCalledWith(
      expect.stringMatching(/ask:tokens:/),
      reserved - costOf(120, 80),
    );
  });

  it('settleBudget charges the overage when actual usage exceeds the reservation', async () => {
    const { settleBudget } = await import('@/lib/rate-limit');
    decrbyMock.mockClear();
    const reserved = RESERVATION;
    counter.value = reserved;
    await settleBudget(reserved, INPUT_RESERVATION * 2, 600, 'ask:tokens:test');
    expect(decrbyMock).not.toHaveBeenCalled();
    expect(counter.value).toBe(costOf(INPUT_RESERVATION * 2, 600));
  });

  it('settleBudget leaves the counter alone when actual equals the reservation', async () => {
    const { settleBudget } = await import('@/lib/rate-limit');
    decrbyMock.mockClear();
    const exact = costOf(600, 400);
    counter.value = exact;
    await settleBudget(exact, 600, 400, 'ask:tokens:test');
    expect(decrbyMock).not.toHaveBeenCalled();
    expect(counter.value).toBe(exact);
  });

  it('settleBudget skips when there is no positive reservation', async () => {
    const { settleBudget } = await import('@/lib/rate-limit');
    decrbyMock.mockClear();
    await settleBudget(0, 100, 200, 'ask:tokens:test');
    expect(decrbyMock).not.toHaveBeenCalled();
  });

  it('rejects and refunds both reservations when the daily slice would be crossed', async () => {
    const nearlySpentDay = DAILY_CAPACITY - RESERVATION + 1;
    dailyCounter.value = nearlySpentDay;
    const { reserveBudget } = await import('@/lib/rate-limit');
    const result = await reserveBudget(512);
    expect(result.allowed).toBe(false);
    expect(result.reserved).toBe(0);
    expect(decrbyMock).toHaveBeenCalledWith(expect.stringMatching(/ask:tokens:day:/), RESERVATION);
    expect(counter.value).toBe(0);
    expect(dailyCounter.value).toBe(nearlySpentDay);
  });

  it('settleBudget refunds the daily key as well as the monthly one', async () => {
    const { reserveBudget, settleBudget } = await import('@/lib/rate-limit');
    const { reserved, budgetKey, dailyKey } = await reserveBudget(512);
    await settleBudget(reserved, 120, 80, budgetKey, dailyKey);
    expect(counter.value).toBe(costOf(120, 80));
    expect(dailyCounter.value).toBe(costOf(120, 80));
  });
});
