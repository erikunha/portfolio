// __tests__/ask-timeout.test.ts
// Behavioral test: verifies the explicit upstream timeouts on the model
// call (/api/ask, routed through the Vercel AI Gateway via `streamText`)
// and the Resend send (/api/contact) by EXERCISING them, not by grepping
// route source.
//
// /api/ask  — mocks the `ai` package's `streamText` and captures the options
//             object the route actually passes. Asserts the call carries an
//             `abortSignal` (the stream-initiation deadline) that is a real
//             AbortSignal and is not already aborted at call time.
// /api/contact — makes the Resend send hang forever; with fake timers the
//             route must still resolve (the Promise.race against the 10s
//             timer fires) and the message stays durably persisted in KV.

import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// --- AI SDK mock: capture streamText options --------------------------------
const mockStreamText = vi.fn();

vi.mock('ai', () => ({
  streamText: mockStreamText,
}));

// A minimal successful streamText result.
function makeOkResult(text = 'ok') {
  return {
    textStream: {
      async *[Symbol.asyncIterator]() {
        yield text;
      },
    },
    usage: Promise.resolve({ inputTokens: 10, outputTokens: 1 }),
    providerMetadata: Promise.resolve({
      anthropic: { cacheReadInputTokens: 0, cacheCreationInputTokens: 0 },
    }),
  };
}

// --- rate-limit / observability mocks shared by both routes -----------------
vi.mock('@/lib/rate-limit', () => ({
  getClientIp: vi.fn(() => '127.0.0.1'),
  getAskLimit: vi.fn(() => ({ limit: vi.fn(async () => ({ success: true })) })),
  getContactLimit: vi.fn(() => ({ limit: vi.fn(async () => ({ success: true })) })),
  getRedis: vi.fn(() => ({ set: vi.fn(async () => 'OK') })),
  reserveBudget: vi.fn(async () => ({ allowed: true, reserved: 1512, pct: 0 })),
  settleBudget: vi.fn(async () => undefined),
  checkIdenticalQuestion: vi.fn(async () => ({ allowed: true })),
}));

vi.mock('@/lib/ask-log', () => ({
  persistAskInteraction: vi.fn(async () => undefined),
}));

vi.mock('@/lib/ip-hash', () => ({
  hashIp: vi.fn(async () => 'hashed-ip-test'),
}));

const logErrorMock = vi.fn();
vi.mock('@/lib/log', () => ({
  log: { info: vi.fn(), error: logErrorMock, warn: vi.fn(), debug: vi.fn() },
}));

// --- Resend mock: a send that never resolves --------------------------------
const resendSendMock = vi.fn();
vi.mock('resend', () => ({
  Resend: class {
    emails = { send: resendSendMock };
  },
}));

function makeRequest(url: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('/api/ask — AI Gateway stream-initiation timeout', () => {
  beforeEach(() => {
    process.env.ASK_ENABLED = 'true';
    vi.resetModules();
    mockStreamText.mockReset();
  });

  function makeRequestTo(question: string): NextRequest {
    return new NextRequest('http://localhost/api/ask', {
      method: 'POST',
      body: JSON.stringify({ question }),
      headers: { 'Content-Type': 'application/json' },
    });
  }

  it('passes an AbortSignal stream-initiation deadline to streamText', async () => {
    // The direct SDK's `new Anthropic({ timeout: 30_000 })` is replaced by an
    // `abortSignal` on the streamText call — `AbortSignal.timeout(...)` carries
    // the stream-initiation (time-to-first-byte) deadline. Assert the route
    // actually wires one through, and that it is not already aborted at call
    // time (a pre-aborted signal would kill every request instantly).
    mockStreamText.mockReturnValueOnce(makeOkResult());
    const { POST } = await import('@/app/api/ask/route');
    const res = await POST(makeRequestTo('Who is Erik?'));
    expect(res.status).toBe(200);

    expect(mockStreamText).toHaveBeenCalledOnce();
    const opts = mockStreamText.mock.calls[0]?.[0] as { abortSignal?: AbortSignal } | undefined;
    expect(opts?.abortSignal).toBeInstanceOf(AbortSignal);
    expect(opts?.abortSignal?.aborted).toBe(false);

    // Drain so the persistAskInteraction promise can settle.
    const reader = res.body?.getReader();
    if (reader) {
      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }
    }
  });

  it('routes through the AI Gateway with the plain provider/model string', async () => {
    // The Gateway form is the plain `provider/model-name` string — no
    // `@ai-sdk/anthropic` provider instance wired directly.
    mockStreamText.mockReturnValueOnce(makeOkResult());
    const { POST } = await import('@/app/api/ask/route');
    const res = await POST(makeRequestTo('Who is Erik?'));
    expect(res.status).toBe(200);

    const opts = mockStreamText.mock.calls[0]?.[0] as { model?: unknown } | undefined;
    expect(opts?.model).toBe('anthropic/claude-haiku-4-5');

    const reader = res.body?.getReader();
    if (reader) {
      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }
    }
  });
});

describe('/api/contact — Resend send 10s timeout', () => {
  beforeEach(() => {
    process.env.RESEND_API_KEY = 'fake-key-for-tests';
    resendSendMock.mockReset();
    logErrorMock.mockReset();
    vi.resetModules();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves with the message persisted even when Resend never responds', async () => {
    // Resend send hangs forever — only the Promise.race timeout can unblock.
    resendSendMock.mockReturnValueOnce(
      new Promise(() => {
        /* intentionally never settles */
      }),
    );
    vi.useFakeTimers();

    const { POST } = await import('@/app/api/contact/route');
    const resPromise = POST(
      makeRequest('http://localhost/api/contact', {
        name: 'Real Name',
        email: 'real@example.com',
        message: 'A perfectly long-enough legitimate message',
      }),
    );

    // Let the KV write + send kickoff microtasks flush, then trip the 10s timer.
    await vi.advanceTimersByTimeAsync(10_000);
    const res = await resPromise;

    // KV write succeeded, so the route still returns a success envelope —
    // delivery failure is acceptable once the message is durably stored.
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);

    // The graceful-fail path logged the Resend failure (timeout reason).
    expect(logErrorMock).toHaveBeenCalledWith(
      'Resend unavailable',
      expect.objectContaining({ reason: expect.stringMatching(/timeout/i) }),
    );
  });
});
