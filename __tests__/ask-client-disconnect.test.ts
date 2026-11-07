import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ASK_RESERVED_INPUT_TOKENS } from '@/lib/ask/input-reservation';

const mockStreamText = vi.fn();
vi.mock('ai', () => ({ streamText: mockStreamText }));

const settleBudgetMock = vi.fn(async (..._args: unknown[]): Promise<void> => undefined);
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

const persistMock = vi.fn(async (_interaction: { status: string; answer: string }) => undefined);
vi.mock('@/lib/ask-log', () => ({ persistAskInteraction: persistMock }));

const hashIpMock = vi.fn(async (_ip: string) => 'hashed-ip-test');
vi.mock('@/lib/ip-hash', () => ({ hashIp: hashIpMock }));

vi.mock('@/lib/log', () => ({
  log: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

function makeRequest(question = 'Who is Erik?'): NextRequest {
  return new NextRequest('http://localhost/api/ask', {
    method: 'POST',
    body: JSON.stringify({ question }),
    headers: { 'Content-Type': 'application/json' },
  });
}

function makeGatedResult() {
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const result = {
    textStream: {
      async *[Symbol.asyncIterator]() {
        yield 'first chunk. ';
        await gate;
        yield 'second chunk.';
      },
    },
    usage: Promise.resolve({ inputTokens: 2000, outputTokens: 40, inputTokenDetails: {} }),
    finishReason: Promise.resolve('stop'),
  };
  return { result, release };
}

async function flush(): Promise<void> {
  for (let i = 0; i < 20; i++) await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 20));
}

describe('/api/ask client disconnect', () => {
  beforeEach(() => {
    process.env.ASK_ENABLED = 'true';
    vi.resetModules();
    mockStreamText.mockReset();
    settleBudgetMock.mockClear();
    persistMock.mockClear();
    hashIpMock.mockClear();
    hashIpMock.mockImplementation(async () => 'hashed-ip-test');
  });

  it('settles the budget reservation and persists the log when the reader cancels mid-answer', async () => {
    const { result, release } = makeGatedResult();
    mockStreamText.mockReturnValueOnce(result);

    const { POST } = await import('@/app/api/ask/route');
    const res = await POST(makeRequest());
    const reader = res.body?.getReader();
    expect(reader).toBeDefined();

    const first = await reader?.read();
    expect(new TextDecoder().decode(first?.value)).toContain('first chunk');
    await reader?.cancel();
    release();
    await flush();

    expect(settleBudgetMock).toHaveBeenCalledTimes(1);
    expect(persistMock).toHaveBeenCalledTimes(1);
    expect(persistMock.mock.calls[0]?.[0].status).toBe('aborted');
    expect(persistMock.mock.calls[0]?.[0].answer).toContain('first chunk');
  });

  it('keeps the input tokens and refunds the output reservation when the reader cancels before the first token', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    mockStreamText.mockReturnValueOnce({
      textStream: {
        async *[Symbol.asyncIterator]() {
          await gate;
          yield 'never delivered';
        },
      },
      usage: Promise.reject(new Error('aborted')),
      finishReason: Promise.resolve('stop'),
    });

    const { POST } = await import('@/app/api/ask/route');
    const res = await POST(makeRequest());
    await res.body?.cancel();
    release();
    await flush();

    expect(
      settleBudgetMock,
      'an abort before any token left the full worst-case reservation on the budget until the key expired',
    ).toHaveBeenCalledWith(
      2712,
      ASK_RESERVED_INPUT_TOKENS,
      0,
      'ask:tokens:test',
      'ask:tokens:day:test',
    );
  });

  it('aborts the upstream model call when the reader cancels', async () => {
    const { result, release } = makeGatedResult();
    mockStreamText.mockReturnValueOnce(result);

    const { POST } = await import('@/app/api/ask/route');
    const res = await POST(makeRequest());
    const reader = res.body?.getReader();
    await reader?.read();
    await reader?.cancel();
    release();
    await flush();

    const callArgs = mockStreamText.mock.calls[0]?.[0] as { abortSignal: AbortSignal };
    expect(callArgs.abortSignal.aborted).toBe(true);
  });
});

describe('/api/ask pseudonymisation outage', () => {
  beforeEach(() => {
    process.env.ASK_ENABLED = 'true';
    vi.resetModules();
    mockStreamText.mockReset();
  });

  it('keeps answering when the IP hash cannot be derived instead of throwing a 500', async () => {
    hashIpMock.mockRejectedValueOnce(new Error('DEPLOY_SALT auto-resolution failed'));
    const { result } = makeGatedResult();
    mockStreamText.mockReturnValueOnce(result);

    const { POST } = await import('@/app/api/ask/route');
    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    await res.body?.cancel();
  });
});
