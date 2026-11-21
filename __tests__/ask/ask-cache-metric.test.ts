import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SettleParams } from '@/lib/ask/budget';
import { askRequest, readBody } from '../helpers/ask-route';
import { streamTextResult } from '../helpers/modules';

const mockStreamText = vi.fn();

vi.mock('ai', () => ({
  streamText: mockStreamText,
}));

const settleBudgetMock = vi.fn(async (_params: SettleParams): Promise<void> => undefined);
const reserveBudgetMock = vi.fn(async () => ({
  allowed: true,
  reserved: 2712,
  pct: 0,
  budgetKey: 'ask:tokens:test',
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

type PersistedInteraction = {
  inputTokens: number;
  outputTokens: number;
  status: string;
};
const persistMock = vi.fn(async (_interaction: PersistedInteraction): Promise<void> => undefined);
vi.mock('@/lib/ask/interaction-log', async () =>
  (await import('../helpers/ask-route')).askLogModule(persistMock),
);

vi.mock('@/lib/ip-hash', async () => (await import('../helpers/ask-route')).ipHashModule());

const logInfoMock = vi.fn();
vi.mock('@/lib/log', async () =>
  (await import('../helpers/ask-route')).logModule({ info: logInfoMock }),
);

function makeRequest(question = 'What is your stack?'): NextRequest {
  return askRequest({ question });
}

function armUpstream(opts: {
  inputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
  outputTokens: number;
  text: string;
}): void {
  mockStreamText.mockReturnValue(
    streamTextResult({
      text: opts.text,
      usage: Promise.resolve({
        inputTokens: opts.inputTokens + opts.cacheReadInputTokens + opts.cacheCreationInputTokens,
        outputTokens: opts.outputTokens,
        inputTokenDetails: {
          noCacheTokens: opts.inputTokens,
          cacheReadTokens: opts.cacheReadInputTokens,
          cacheWriteTokens: opts.cacheCreationInputTokens,
        },
      }),
    }),
  );
}

describe('/api/ask: cache-hit accounting (STANDARDS.md Ch.7)', () => {
  beforeEach(() => {
    process.env.ASK_ENABLED = 'true';
    vi.resetModules();
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
    expect(await readBody(res)).toContain('Angular');

    await vi.waitFor(() => expect(settleBudgetMock).toHaveBeenCalledOnce());

    const firstCall = settleBudgetMock.mock.calls[0]?.[0];
    expect(firstCall).toBeDefined();
    expect(firstCall?.billedInputTokens).toBe(200 + 1500 + 0);
    expect(firstCall?.outputTokens).toBe(80);
    expect(firstCall?.budgetKey).toBe('ask:tokens:test');

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
    await readBody(res);

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
    await readBody(res);

    await vi.waitFor(() => expect(settleBudgetMock).toHaveBeenCalledOnce());
    const billedInput = settleBudgetMock.mock.calls[0]?.[0]?.billedInputTokens;
    expect(billedInput).toBe(200 + 0 + 1500);

    const completed = logInfoMock.mock.calls.find((c) => c[0] === 'ask completed');
    const meta = completed?.[1] as { cacheHitRate: number; cacheWriteTokens: number };
    expect(meta.cacheHitRate).toBe(0);
    expect(meta.cacheWriteTokens).toBe(1500);
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
    await readBody(res);

    await vi.waitFor(() => expect(settleBudgetMock).toHaveBeenCalledOnce());
    const billedInput = settleBudgetMock.mock.calls[0]?.[0]?.billedInputTokens;
    expect(billedInput).toBe(1700);
    const completed = logInfoMock.mock.calls.find((c) => c[0] === 'ask completed');
    const meta = completed?.[1] as { cacheHitRate: number };
    expect(meta.cacheHitRate).toBe(0);
  });

  it('holds the reservation (no refund) when result.usage rejects', async () => {
    const rejectingUsage = Promise.reject(new Error('usage unavailable, stream aborted'));
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
    expect(await readBody(res)).toContain('an answer was streamed');

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
    await readBody(res);

    await vi.waitFor(() => expect(settleBudgetMock).toHaveBeenCalledOnce());
    const firstCall = settleBudgetMock.mock.calls[0]?.[0];
    expect(firstCall?.billedInputTokens).toBe(300);
    expect(firstCall?.outputTokens).toBe(40);

    const completed = logInfoMock.mock.calls.find((c) => c[0] === 'ask completed');
    const meta = completed?.[1] as {
      usageResolved: boolean;
      cacheReadTokens: number;
      cacheWriteTokens: number;
    };
    expect(meta.usageResolved).toBe(true);
    expect(meta.cacheReadTokens).toBe(0);
    expect(meta.cacheWriteTokens).toBe(0);
  });
});
