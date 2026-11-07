import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { askErrors } from '@/content/ask-errors';

const afterMock = vi.hoisted(() => vi.fn());
const streamTextMock = vi.hoisted(() => vi.fn());
const settleBudgetMock = vi.hoisted(() => vi.fn(async (..._args: unknown[]) => undefined));
const logError = vi.hoisted(() => vi.fn());

vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: afterMock,
}));
vi.mock('ai', () => ({ streamText: streamTextMock }));
vi.mock('@/lib/rate-limit', () => ({
  getClientIp: vi.fn(() => '127.0.0.1'),
  getAskLimit: vi.fn(() => ({ limit: vi.fn(async () => ({ success: true })) })),
  hasRedisCredentials: vi.fn(() => true),
  reserveBudget: vi.fn(async () => ({
    allowed: true,
    reserved: 2712,
    pct: 0,
    budgetKey: 'ask:tokens:test',
    dailyKey: 'ask:tokens:day:test',
  })),
  settleBudget: settleBudgetMock,
  checkIdenticalQuestion: vi.fn(async () => ({ allowed: true })),
}));
vi.mock('@/lib/ask-log', () => ({ persistAskInteraction: vi.fn(async () => undefined) }));
vi.mock('@/lib/ip-hash', () => ({ hashIp: vi.fn(async () => 'hashed-ip-test') }));
vi.mock('@/lib/log', () => ({
  log: { info: vi.fn(), error: logError, warn: vi.fn(), debug: vi.fn() },
}));

function request(): NextRequest {
  return new NextRequest('http://localhost/api/ask', {
    method: 'POST',
    body: JSON.stringify({ question: 'Who is Erik?', locale: 'pt' }),
    headers: { 'Content-Type': 'application/json' },
  });
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
