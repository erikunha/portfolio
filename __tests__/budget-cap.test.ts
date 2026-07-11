import { beforeEach, describe, expect, it, vi } from 'vitest';

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
    return {};
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
  });

  const INPUT_RESERVATION = 2200;

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

  it('settleBudget skips when reserved <= 0 (Redis-failure path)', async () => {
    const { settleBudget } = await import('@/lib/rate-limit');
    decrbyMock.mockClear();
    await settleBudget(0, 100, 200, 'ask:tokens:test');
    expect(decrbyMock).not.toHaveBeenCalled();
  });
});
