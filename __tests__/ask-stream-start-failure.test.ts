import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { askErrors } from '@/content/ask-errors';
import { askRequest } from './helpers/ask-route';

const afterMock = vi.hoisted(() => vi.fn());
const streamTextMock = vi.hoisted(() => vi.fn());
const settleBudgetMock = vi.hoisted(() => vi.fn(async (..._args: unknown[]) => undefined));
const logError = vi.hoisted(() => vi.fn());

vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: afterMock,
}));
vi.mock('ai', () => ({ streamText: streamTextMock }));
vi.mock('@/lib/rate-limit', async () =>
  (await import('./helpers/ask-route')).rateLimitModule({
    hasRedisCredentials: vi.fn(() => true),
    reserveBudget: vi.fn(async () => ({
      allowed: true,
      reserved: 2712,
      pct: 0,
      budgetKey: 'ask:tokens:test',
      dailyKey: 'ask:tokens:day:test',
    })),
    settleBudget: settleBudgetMock,
  }),
);
vi.mock('@/lib/ask-log', async () => (await import('./helpers/ask-route')).askLogModule());
vi.mock('@/lib/ip-hash', async () => (await import('./helpers/ask-route')).ipHashModule());
vi.mock('@/lib/log', async () =>
  (await import('./helpers/ask-route')).logModule({ error: logError }),
);

function request(): NextRequest {
  return askRequest({ question: 'Who is Erik?', locale: 'pt' });
}

describe('/api/ask when the model call cannot start', () => {
  beforeEach(() => {
    process.env.ASK_ENABLED = 'true';
    vi.resetModules();
    afterMock.mockReset();
    settleBudgetMock.mockClear();
    logError.mockClear();
    streamTextMock.mockReset().mockImplementation(() => {
      throw new Error('invalid model configuration');
    });
  });

  it('gives the whole reservation back and answers with a typed error instead of leaking the budget', async () => {
    const { POST } = await import('@/app/api/ask/route');
    const res = await POST(request());

    expect(
      settleBudgetMock,
      'reserveBudget already charged the month; a synchronous throw before any stream exists registers no settlement',
    ).toHaveBeenCalledWith(2712, 0, 0, 'ask:tokens:test', 'ask:tokens:day:test');
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: askErrors.pt.interrupted });
    expect(logError).toHaveBeenCalledWith(
      'ask stream could not start',
      expect.objectContaining({
        error: { name: 'Error', message: 'invalid model configuration' },
      }),
    );
  });
});
