// __tests__/ask-timeout.test.ts
// Behavioral test (CG3): verifies the explicit upstream timeouts on the
// Anthropic SDK (/api/ask) and Resend send (/api/contact) by EXERCISING them,
// not by grepping route source.
//
// /api/ask  — mocks the Anthropic SDK constructor and captures the options
//             object the route actually passes. Asserts timeout: 30_000 and
//             that maxRetries is not pinned to 0 (SDK default retries kept).
// /api/contact — makes the Resend send hang forever; with fake timers the
//             route must still resolve (the Promise.race against the 10s
//             timer fires) and the message stays durably persisted in KV.

import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// --- Anthropic SDK mock: capture constructor options -------------------------
const anthropicCtorCalls: unknown[] = [];
const mockMessagesCreate = vi.fn();

vi.mock('@anthropic-ai/sdk', () => {
  class MockAnthropic {
    messages = { create: mockMessagesCreate };
    constructor(opts?: unknown) {
      anthropicCtorCalls.push(opts);
    }
  }
  return { default: MockAnthropic };
});

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

describe('/api/ask — Anthropic SDK timeout', () => {
  beforeEach(() => {
    process.env.ASK_ENABLED = 'true';
    anthropicCtorCalls.length = 0;
    vi.resetModules();
  });

  it('constructs the Anthropic client with timeout: 30_000', async () => {
    // Importing the route runs its module-scope `new Anthropic({ ... })`.
    await import('@/app/api/ask/route');
    expect(anthropicCtorCalls.length).toBeGreaterThan(0);
    const opts = anthropicCtorCalls[0] as { timeout?: number } | undefined;
    expect(opts?.timeout).toBe(30_000);
  });

  it('does NOT pin maxRetries to 0 — keeps the SDK default retry behavior', async () => {
    await import('@/app/api/ask/route');
    const opts = anthropicCtorCalls[0] as { maxRetries?: number } | undefined;
    // Either unset (SDK default of 2) or explicitly non-zero. A 0 here would
    // disable retries on idempotent stream initiation.
    expect(opts?.maxRetries).not.toBe(0);
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
