import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockStreamText = vi.fn();
const mockMessagesCreate = vi.fn();

vi.mock('ai', () => ({
  streamText: mockStreamText,
}));

vi.mock('@anthropic-ai/sdk', () => {
  class MockAnthropic {
    messages = { create: mockMessagesCreate };
  }
  return { default: MockAnthropic };
});

const settleBudgetMock = vi.fn(
  async (_reserved: number, _actualIn: number, _actualOut: number, _key: string): Promise<void> =>
    undefined,
);
const reserveBudgetMock = vi.fn(async () => ({
  allowed: true,
  reserved: 2712,
  pct: 0,
  budgetKey: 'ask:tokens:test',
}));

vi.mock('@/lib/rate-limit', () => ({
  getClientIp: vi.fn(() => '127.0.0.1'),
  getAskLimit: vi.fn(() => ({ limit: vi.fn(async () => ({ success: true })) })),
  reserveBudget: reserveBudgetMock,
  settleBudget: settleBudgetMock,
  checkIdenticalQuestion: vi.fn(async () => ({ allowed: true })),
}));

type PersistedInteraction = {
  inputTokens: number;
  outputTokens: number;
  status: string;
};
const persistMock = vi.fn(async (_interaction: PersistedInteraction): Promise<void> => undefined);
vi.mock('@/lib/ask-log', () => ({
  persistAskInteraction: persistMock,
}));

vi.mock('@/lib/ip-hash', () => ({
  hashIp: vi.fn(async () => 'hashed-ip-test'),
}));

const logInfoMock = vi.fn();
vi.mock('@/lib/log', () => ({
  log: { info: logInfoMock, error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

function makeRequest(question = 'What is your stack?'): NextRequest {
  return new NextRequest('http://localhost/api/ask', {
    method: 'POST',
    body: JSON.stringify({ question }),
    headers: { 'Content-Type': 'application/json' },
  });
}

async function drain(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return '';
  const dec = new TextDecoder();
  let out = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) out += dec.decode(value, { stream: true });
  }
  return out;
}

function makeAnthropicSseStream(opts: {
  inputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
  outputTokens: number;
  text: string;
}): AsyncIterable<unknown> {
  return {
    async *[Symbol.asyncIterator]() {
      yield {
        type: 'message_start',
        message: {
          usage: {
            input_tokens: opts.inputTokens,
            cache_read_input_tokens: opts.cacheReadInputTokens,
            cache_creation_input_tokens: opts.cacheCreationInputTokens,
          },
        },
      };
      yield {
        type: 'content_block_delta',
        delta: { type: 'text_delta', text: opts.text },
      };
      yield { type: 'message_delta', usage: { output_tokens: opts.outputTokens } };
    },
  };
}

function makeStreamTextResult(opts: {
  inputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
  outputTokens: number;
  text: string;
}) {
  return {
    textStream: {
      async *[Symbol.asyncIterator]() {
        yield opts.text;
      },
    },
    usage: Promise.resolve({
      inputTokens: opts.inputTokens,
      outputTokens: opts.outputTokens,
      inputTokenDetails: {
        cacheReadTokens: opts.cacheReadInputTokens,
        cacheWriteTokens: opts.cacheCreationInputTokens,
      },
    }),
  };
}

function armUpstream(opts: {
  inputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
  outputTokens: number;
  text: string;
}): void {
  mockMessagesCreate.mockResolvedValue(makeAnthropicSseStream(opts));
  mockStreamText.mockReturnValue(makeStreamTextResult(opts));
}

describe('/api/ask — cache-hit accounting (STANDARDS.md Ch.7)', () => {
  beforeEach(() => {
    process.env.ASK_ENABLED = 'true';
    vi.resetModules();
    mockMessagesCreate.mockReset();
    mockStreamText.mockReset();
    settleBudgetMock.mockClear();
    reserveBudgetMock
      .mockClear()
      .mockResolvedValue({ allowed: true, reserved: 2712, pct: 0, budgetKey: 'ask:tokens:test' });
    persistMock.mockClear();
    logInfoMock.mockClear();
  });

  it('folds cache-read tokens into totalBilledInput on a warm cache', async () => {
    armUpstream({
      inputTokens: 200,
      cacheReadInputTokens: 1500,
      cacheCreationInputTokens: 0,
      outputTokens: 80,
      text: 'Angular, React, Next.js, TypeScript.',
    });

    const { POST } = await import('@/app/api/ask/route');
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(await drain(res)).toContain('Angular');

    await vi.waitFor(() => expect(settleBudgetMock).toHaveBeenCalledOnce());

    const firstCall = settleBudgetMock.mock.calls[0];
    expect(firstCall).toBeDefined();
    const billedInput = firstCall?.[1];
    const outTokens = firstCall?.[2];
    expect(billedInput).toBe(200 + 1500 + 0);
    expect(outTokens).toBe(80);
    expect(firstCall?.[3]).toBe('ask:tokens:test');

    expect(persistMock).toHaveBeenCalled();
    const persisted = persistMock.mock.calls.at(-1)?.[0];
    expect(persisted).toBeDefined();
    expect(persisted?.inputTokens).toBe(1700);
    expect(persisted?.outputTokens).toBe(80);
    expect(persisted?.status).toBe('completed');
  });

  it('produces a non-zero cacheHitRate when the upstream reports cache reads', async () => {
    armUpstream({
      inputTokens: 200,
      cacheReadInputTokens: 1500,
      cacheCreationInputTokens: 0,
      outputTokens: 80,
      text: 'cached answer',
    });

    const { POST } = await import('@/app/api/ask/route');
    const res = await POST(makeRequest());
    await drain(res);

    await vi.waitFor(() =>
      expect(logInfoMock.mock.calls.some((c) => c[0] === 'ask completed')).toBe(true),
    );
    const completed = logInfoMock.mock.calls.find((c) => c[0] === 'ask completed');
    expect(completed, "expected an 'ask completed' log line").toBeDefined();
    const meta = completed?.[1] as { cacheHitRate: number; cacheReadTokens: number };
    expect(meta.cacheHitRate).toBeGreaterThan(0);
    expect(meta.cacheHitRate).toBeCloseTo(1500 / 1700, 5);
    expect(meta.cacheReadTokens).toBe(1500);
  });

  it('counts cache-creation tokens (cold cache write) into totalBilledInput', async () => {
    armUpstream({
      inputTokens: 200,
      cacheReadInputTokens: 0,
      cacheCreationInputTokens: 1500,
      outputTokens: 60,
      text: 'cold answer',
    });

    const { POST } = await import('@/app/api/ask/route');
    const res = await POST(makeRequest());
    await drain(res);

    await vi.waitFor(() => expect(settleBudgetMock).toHaveBeenCalledOnce());
    const billedInput = settleBudgetMock.mock.calls[0]?.[1];
    expect(billedInput).toBe(200 + 0 + 1500);

    const completed = logInfoMock.mock.calls.find((c) => c[0] === 'ask completed');
    const meta = completed?.[1] as { cacheHitRate: number; cacheCreationTokens: number };
    expect(meta.cacheHitRate).toBe(0);
    expect(meta.cacheCreationTokens).toBe(1500);
  });

  it('reports a zero cacheHitRate when no cache tokens are present', async () => {
    armUpstream({
      inputTokens: 1700,
      cacheReadInputTokens: 0,
      cacheCreationInputTokens: 0,
      outputTokens: 50,
      text: 'uncached answer',
    });

    const { POST } = await import('@/app/api/ask/route');
    const res = await POST(makeRequest());
    await drain(res);

    await vi.waitFor(() => expect(settleBudgetMock).toHaveBeenCalledOnce());
    const billedInput = settleBudgetMock.mock.calls[0]?.[1];
    expect(billedInput).toBe(1700);
    const completed = logInfoMock.mock.calls.find((c) => c[0] === 'ask completed');
    const meta = completed?.[1] as { cacheHitRate: number };
    expect(meta.cacheHitRate).toBe(0);
  });

  it('holds the reservation (no refund) when result.usage rejects', async () => {
    const rejectingUsage = Promise.reject(new Error('usage unavailable — stream aborted'));
    rejectingUsage.catch(() => undefined);
    mockStreamText.mockReturnValue({
      textStream: {
        async *[Symbol.asyncIterator]() {
          yield 'an answer was streamed';
        },
      },
      usage: rejectingUsage,
    });

    const { POST } = await import('@/app/api/ask/route');
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(await drain(res)).toContain('an answer was streamed');

    await vi.waitFor(() => expect(persistMock).toHaveBeenCalled());

    expect(settleBudgetMock).not.toHaveBeenCalled();

    const completed = logInfoMock.mock.calls.find((c) => c[0] === 'ask completed');
    expect(completed, "expected an 'ask completed' log line").toBeDefined();
    const meta = completed?.[1] as { usageResolved: boolean };
    expect(meta.usageResolved).toBe(false);
  });

  it('still refunds and reads zero cache when usage lacks inputTokenDetails', async () => {
    mockStreamText.mockReturnValue({
      textStream: {
        async *[Symbol.asyncIterator]() {
          yield 'answer with no cache breakdown';
        },
      },
      usage: Promise.resolve({ inputTokens: 300, outputTokens: 40 }),
    });

    const { POST } = await import('@/app/api/ask/route');
    const res = await POST(makeRequest());
    await drain(res);

    await vi.waitFor(() => expect(settleBudgetMock).toHaveBeenCalledOnce());
    const firstCall = settleBudgetMock.mock.calls[0];
    expect(firstCall?.[1]).toBe(300);
    expect(firstCall?.[2]).toBe(40);

    const completed = logInfoMock.mock.calls.find((c) => c[0] === 'ask completed');
    const meta = completed?.[1] as {
      usageResolved: boolean;
      cacheReadTokens: number;
      cacheCreationTokens: number;
    };
    expect(meta.usageResolved).toBe(true);
    expect(meta.cacheReadTokens).toBe(0);
    expect(meta.cacheCreationTokens).toBe(0);
  });
});
