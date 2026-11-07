import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ASK_RESERVED_INPUT_TOKENS } from '@/lib/ask/input-reservation';

const afterMock = vi.hoisted(() => vi.fn());
const streamTextMock = vi.hoisted(() => vi.fn());
const settleBudgetMock = vi.hoisted(() => vi.fn(async (..._args: unknown[]) => undefined));
const persistMock = vi.hoisted(() => vi.fn(async (_row: { status: string }) => undefined));

const registeredTask = (): Promise<void> => {
  const [task] = afterMock.mock.calls[0] as [() => Promise<void>];
  return task();
};

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
vi.mock('@/lib/ask-log', () => ({ persistAskInteraction: persistMock }));
vi.mock('@/lib/ip-hash', () => ({ hashIp: vi.fn(async () => 'hashed-ip-test') }));
vi.mock('@/lib/log', () => ({
  log: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

function request(): NextRequest {
  return new NextRequest('http://localhost/api/ask', {
    method: 'POST',
    body: JSON.stringify({ question: 'Who is Erik?' }),
    headers: { 'Content-Type': 'application/json' },
  });
}

async function flush(): Promise<void> {
  for (let i = 0; i < 20; i++) await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 20));
}

describe('/api/ask budget settlement and log write', () => {
  beforeEach(() => {
    process.env.ASK_ENABLED = 'true';
    vi.resetModules();
    afterMock.mockReset();
    streamTextMock.mockReset();
    settleBudgetMock.mockClear();
    persistMock.mockClear();
    streamTextMock.mockReturnValue({
      textStream: (async function* () {
        yield 'Erik builds web applications.';
      })(),
      usage: Promise.resolve({ inputTokens: 2000, outputTokens: 40, inputTokenDetails: {} }),
      finishReason: Promise.resolve('stop'),
    });
  });

  it('registers settlement with after() so it survives the end of the response', async () => {
    const { POST } = await import('@/app/api/ask/route');
    const res = await POST(request());
    await res.text();
    await flush();

    expect(afterMock).toHaveBeenCalledOnce();
    expect(
      settleBudgetMock,
      'work started after the stream closes is cut off when the platform ends the invocation with the response',
    ).not.toHaveBeenCalled();

    await registeredTask();

    expect(settleBudgetMock).toHaveBeenCalledWith(
      2712,
      2000,
      40,
      'ask:tokens:test',
      'ask:tokens:day:test',
    );
    expect(persistMock).toHaveBeenCalledOnce();
    expect(persistMock.mock.calls[0]?.[0].status).toBe('completed');
  });

  it('refunds the output reservation when the model times out before the first token', async () => {
    streamTextMock.mockReturnValue({
      textStream: (async function* () {
        yield* [];
      })(),
      usage: Promise.reject(new Error('aborted by timeout')),
      finishReason: Promise.resolve('stop'),
    });
    const { POST } = await import('@/app/api/ask/route');
    const res = await POST(request());
    await res.text();
    await flush();
    await registeredTask();

    expect(settleBudgetMock).toHaveBeenCalledWith(
      2712,
      ASK_RESERVED_INPUT_TOKENS,
      0,
      'ask:tokens:test',
      'ask:tokens:day:test',
    );
  });
});
