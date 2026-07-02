// __tests__/ask-cache-metric.test.ts
// Behavioral test: pins the cache-hit accounting of /api/ask.
//
// The ephemeral prompt cache must fire and its hit-rate must be tracked.
// The accounting invariant under test:
//
//   totalBilledInput = inputTokens + cacheReadInputTokens + cacheCreationInputTokens
//   cacheHitRate     = cacheReadInputTokens / totalBilledInput
//
// `totalBilledInput` is what reaches settleBudget() (so the monthly cap
// reflects true Anthropic-billed input, cache reads included) and what is
// persisted as `inputTokens` on the ask-log record. Both are observable
// without source inspection — this test asserts on those two surfaces.
//
// Written FIRST (TDD): it pins the metric against the direct-SDK
// implementation before the Vercel AI Gateway migration, and must stay
// green after it. Whatever the upstream shape (SSE message_start vs the
// AI SDK usage/providerMetadata promises), a cache-read of N tokens must
// flow into totalBilledInput and produce a non-zero cacheHitRate.

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mocks ------------------------------------------------------------------
// streamText (AI SDK) is mocked for the post-migration path; the direct
// Anthropic SDK is mocked for the pre-migration path. Both mocks are
// installed so this file is green on either implementation — the route
// imports exactly one of them.
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

// Capture settleBudget + reserveBudget args — settleBudget(reserved, in, out)
// receives totalBilledInput as its second argument. Typed explicitly so
// `.mock.calls` carries the argument tuple (not an empty `[]`).
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

// Capture persistAskInteraction args — the persisted `inputTokens` field is
// totalBilledInput. Typed so `.mock.calls` carries the interaction argument.
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

// Direct-SDK stream shape: usage on message_start (input + cache breakdown),
// output_tokens on message_delta.
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

// AI SDK 7 streamText result shape: textStream is AsyncIterable; usage is a
// promise resolved at stream end. The Anthropic cache breakdown now rides the
// standard, provider-agnostic `usage.inputTokenDetails` (cacheReadTokens /
// cacheWriteTokens) — the v6 `providerMetadata.anthropic.*` cache fields were
// removed in v7.
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

// Install whichever upstream the route under test consumes. Both are armed
// every test; the route calls exactly one.
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
    // Warm cache: most of the input is billed as cache-read, a small
    // uncached remainder is the fresh user question + framing.
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

    // Settlement runs after the stream closes (usage resolves from
    // end-of-stream promises in the AI SDK), so it may land a tick after
    // the body fully drains — wait for it.
    await vi.waitFor(() => expect(settleBudgetMock).toHaveBeenCalledOnce());

    // settleBudget(reserved, totalBilledInput, outputTokens, budgetKey) — arg index 1
    // is totalBilledInput = input + cacheRead + cacheCreation.
    // arg index 3 (budgetKey) must be threaded from reserveBudget — TOCTOU fix.
    const firstCall = settleBudgetMock.mock.calls[0];
    expect(firstCall).toBeDefined();
    const billedInput = firstCall?.[1];
    const outTokens = firstCall?.[2];
    expect(billedInput).toBe(200 + 1500 + 0);
    expect(outTokens).toBe(80);
    expect(firstCall?.[3]).toBe('ask:tokens:test');

    // The persisted ask-log record's inputTokens is also totalBilledInput.
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

    // cacheHitRate is logged on the 'ask completed' info line — settlement
    // is async (usage resolves from end-of-stream promises), so wait for it.
    await vi.waitFor(() =>
      expect(logInfoMock.mock.calls.some((c) => c[0] === 'ask completed')).toBe(true),
    );
    const completed = logInfoMock.mock.calls.find((c) => c[0] === 'ask completed');
    expect(completed, "expected an 'ask completed' log line").toBeDefined();
    const meta = completed?.[1] as { cacheHitRate: number; cacheReadTokens: number };
    // cacheHitRate = cacheRead / (input + cacheRead + cacheCreation)
    //             = 1500 / 1700 ≈ 0.882
    expect(meta.cacheHitRate).toBeGreaterThan(0);
    expect(meta.cacheHitRate).toBeCloseTo(1500 / 1700, 5);
    expect(meta.cacheReadTokens).toBe(1500);
  });

  it('counts cache-creation tokens (cold cache write) into totalBilledInput', async () => {
    // Cold cache: the system block is written to cache this request.
    // cache_creation is a real billed cost and must land in the budget.
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

    // Cold cache: cacheRead is 0, so the hit rate is 0 — but cache-creation
    // is still billed.
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

  // Fail-closed budget posture: a REJECTED `result.usage` promise must NOT
  // refund the reservation. A rejection resolves to the USAGE_TIMED_OUT
  // sentinel inside the route (not `undefined`), so `usageResolved` is false
  // and `settleBudget` is skipped — the reservation is held as the
  // high-water mark, exactly as on a stalled stream. Degrading the rejection
  // to `undefined` would refund the full reservation against zero tokens
  // despite the stream having billed real ones (the bug Copilot flagged).
  it('holds the reservation (no refund) when result.usage rejects', async () => {
    // A streamText result that streams fine but whose end-of-stream `usage`
    // promise rejects. The noop `.catch` keeps the test runner from flagging
    // an unhandled rejection before the route attaches its own handler.
    const rejectingUsage = Promise.reject(new Error('usage unavailable — stream aborted'));
    rejectingUsage.catch(() => undefined);
    mockStreamText.mockReturnValue({
      textStream: {
        async *[Symbol.asyncIterator]() {
          yield 'an answer was streamed';
        },
      },
      usage: rejectingUsage,
      providerMetadata: Promise.resolve({
        anthropic: { cacheReadInputTokens: 0, cacheCreationInputTokens: 0 },
      }),
    });

    const { POST } = await import('@/app/api/ask/route');
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(await drain(res)).toContain('an answer was streamed');

    // The interaction is still persisted (observability) — wait on that to
    // know the settlement path ran to completion.
    await vi.waitFor(() => expect(persistMock).toHaveBeenCalled());

    // The refund is gated on real usage being known: a rejected `usage`
    // means it is NOT known, so settleBudget must never fire — the full
    // reservation is held, not refunded.
    expect(settleBudgetMock).not.toHaveBeenCalled();

    // The completed log line marks usage as unresolved.
    const completed = logInfoMock.mock.calls.find((c) => c[0] === 'ask completed');
    expect(completed, "expected an 'ask completed' log line").toBeDefined();
    const meta = completed?.[1] as { usageResolved: boolean };
    expect(meta.usageResolved).toBe(false);
  });

  // The cache breakdown is observability-only: when `usage` resolves WITHOUT
  // `inputTokenDetails` (the SDK/Gateway omitted the cache breakdown), the
  // refund must STILL fire because real `usage` is known. Cache tokens degrade
  // to zero. (In AI SDK 7 the cache breakdown rides `usage.inputTokenDetails`,
  // not a separate provider-metadata promise, so a missing detail — not a
  // separate rejection — is the degradation path.)
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

    // usage resolved → the refund fires; the cache breakdown degrades to 0,
    // so totalBilledInput is just inputTokens.
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
