import { beforeEach, describe, expect, it, vi } from 'vitest';
import { askRequest, readBody } from '../helpers/ask-route';

const mockStreamText = vi.fn();

vi.mock('ai', () => ({ streamText: mockStreamText }));

const settleBudgetMock = vi.fn(async (..._args: unknown[]): Promise<void> => undefined);
const reserveBudgetMock = vi.fn(async () => ({
  allowed: true,
  reserved: 2712,
  pct: 0,
  budgetKey: 'ask:tokens:test',
  dailyKey: 'ask:tokens:day:test',
}));

vi.mock('@/lib/server/client-ip', async () =>
  (await import('../helpers/ask-route')).clientIpModule(),
);
vi.mock('@/lib/rate-limit', async () => (await import('../helpers/ask-route')).rateLimitModule());
vi.mock('@/lib/ask/budget', async () =>
  (await import('../helpers/ask-route')).budgetModule({
    reserveBudget: reserveBudgetMock,
    settleBudget: settleBudgetMock,
  }),
);
vi.mock('@/lib/ask/dedup', async () => (await import('../helpers/ask-route')).dedupModule());
vi.mock('@/lib/ask/interaction-log', async () =>
  (await import('../helpers/ask-route')).askLogModule(),
);
vi.mock('@/lib/ip-hash', async () => (await import('../helpers/ask-route')).ipHashModule());
vi.mock('@/lib/log', async () => (await import('../helpers/ask-route')).logModule());

const NO_CACHE_TOKENS = 200;
const CACHE_READ_TOKENS = 1500;
const CACHE_WRITE_TOKENS = 40;
const OUTPUT_TOKENS = 80;

describe('/api/ask settles the budget with the cache split of the metered usage', () => {
  beforeEach(() => {
    process.env.ASK_ENABLED = 'true';
    vi.resetModules();
    mockStreamText.mockReset();
    settleBudgetMock.mockClear();
  });

  it('hands settleBudget the cache read and write counts so cached input is not charged at full weight', async () => {
    mockStreamText.mockReturnValue({
      textStream: {
        async *[Symbol.asyncIterator]() {
          yield 'Angular, React, Next.js, TypeScript.';
        },
      },
      usage: Promise.resolve({
        inputTokens: NO_CACHE_TOKENS + CACHE_READ_TOKENS + CACHE_WRITE_TOKENS,
        outputTokens: OUTPUT_TOKENS,
        inputTokenDetails: {
          noCacheTokens: NO_CACHE_TOKENS,
          cacheReadTokens: CACHE_READ_TOKENS,
          cacheWriteTokens: CACHE_WRITE_TOKENS,
        },
      }),
    });
    const { POST } = await import('@/app/api/ask/route');
    const res = await POST(askRequest({ question: 'What is your stack?' }));
    await readBody(res);

    await vi.waitFor(() => expect(settleBudgetMock).toHaveBeenCalledOnce());
    expect(settleBudgetMock).toHaveBeenCalledWith({
      reserved: 2712,
      billedInputTokens: NO_CACHE_TOKENS + CACHE_READ_TOKENS + CACHE_WRITE_TOKENS,
      outputTokens: OUTPUT_TOKENS,
      budgetKey: 'ask:tokens:test',
      dailyKey: 'ask:tokens:day:test',
      cacheReadTokens: CACHE_READ_TOKENS,
      cacheWriteTokens: CACHE_WRITE_TOKENS,
    });
  });
});
