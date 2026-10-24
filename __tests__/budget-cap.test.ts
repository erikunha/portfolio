// @vitest-environment node

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
const decrbyMock = vi.fn(async (_key: string, n: number): Promise<number> => {
  counter.value -= n;
  return counter.value;
});

const pipelineExec = vi.fn(async (): Promise<[number, number]> => [counter.value, 1]);

vi.mock('@upstash/redis', () => ({
  Redis: {
    fromEnv: () => ({
      get: vi.fn(async () => counter.value),
      set: vi.fn(async () => 'OK'),
      decrby: decrbyMock,
      pipeline: () => ({
        incrby: (_k: string, n: number) => {
          counter.value += n;
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
    counter.value = 0;
    vi.clearAllMocks();
    rateLimitMock.mockResolvedValue({ success: true });
  });

  const INPUT_RESERVATION = 2200;

  it('rejects the reservation when Redis throws', async () => {
    pipelineExec.mockRejectedValueOnce(new Error('Redis unavailable'));
    const { reserveBudget } = await import('@/lib/rate-limit');
    const result = await reserveBudget(512);
    expect(result).toMatchObject({ allowed: false, reserved: 0 });
  });

  it('returns the existing ask budget rejection without starting the model on Redis failure', async () => {
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
    expect(await response.json()).toEqual({
      error: 'monthly budget exhausted — email erikhenriquealvescunha@gmail.com directly',
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
    expect(pipelineExec).toHaveBeenCalledOnce();
    expect(streamTextMock).toHaveBeenCalledOnce();
  });

  it('reserves RESERVED_INPUT_TOKENS + maxOutputTokens upfront and allows within cap', async () => {
    const { reserveBudget } = await import('@/lib/rate-limit');
    const result = await reserveBudget(512);
    expect(result.allowed).toBe(true);
    expect(result.reserved).toBe(INPUT_RESERVATION + 512);
    expect(counter.value).toBe(INPUT_RESERVATION + 512);
  });

  it('rejects and refunds the reservation when it would cross the 3M cap', async () => {
    counter.value = 2_999_000;
    const { reserveBudget } = await import('@/lib/rate-limit');
    const result = await reserveBudget(512);
    expect(result.allowed).toBe(false);
    expect(result.reserved).toBe(0);
    expect(decrbyMock).toHaveBeenCalledWith(
      expect.stringMatching(/ask:tokens:/),
      INPUT_RESERVATION + 512,
    );
  });

  it('settleBudget refunds (reserved - actual) when actual is less than reserved', async () => {
    const { reserveBudget, settleBudget } = await import('@/lib/rate-limit');
    const result = await reserveBudget(512);
    const { reserved, budgetKey } = result;
    decrbyMock.mockClear();
    await settleBudget(reserved, 120, 80, budgetKey);
    expect(decrbyMock).toHaveBeenCalledWith(expect.stringMatching(/ask:tokens:/), reserved - 200);
  });

  it('settleBudget is a no-op when actual >= reserved (defensive)', async () => {
    const { settleBudget } = await import('@/lib/rate-limit');
    decrbyMock.mockClear();
    await settleBudget(INPUT_RESERVATION + 512, 2500, 600, 'ask:tokens:test');
    expect(decrbyMock).not.toHaveBeenCalled();
  });

  it('settleBudget skips when there is no positive reservation', async () => {
    const { settleBudget } = await import('@/lib/rate-limit');
    decrbyMock.mockClear();
    await settleBudget(0, 100, 200, 'ask:tokens:test');
    expect(decrbyMock).not.toHaveBeenCalled();
  });
});
