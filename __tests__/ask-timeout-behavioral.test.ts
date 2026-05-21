// __tests__/ask-timeout-behavioral.test.ts
// Behavioral test: verifies that a timeout (or any rejection) from
// anthropic.messages.create() is caught BEFORE the ReadableStream is
// constructed, and that the route still returns HTTP 200 with a
// STREAM_ERR_SENTINEL-prefixed body — not an unhandled 500.
//
// This is a deliberate precedent break from the source-grep-only unit pattern
// (per Copilot review on PR #9). The source-grep version provably misses the
// Finding 1 bug: it only checked that timeout: 30_000 was passed to the
// constructor, not that a pre-stream rejection was caught. This test pairs
// directly with the fix in app/api/ask/route.ts.

import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Shared mock for messages.create — declared at module scope so tests can
// call mockRejectedValueOnce on it without re-importing the SDK.
const mockMessagesCreate = vi.fn();

// --- Mock @anthropic-ai/sdk before importing the route ---
vi.mock('@anthropic-ai/sdk', () => {
  class MockAnthropic {
    messages = { create: mockMessagesCreate };
  }
  return { default: MockAnthropic };
});

// --- Mock @/lib/rate-limit so we don't need Redis ---
vi.mock('@/lib/rate-limit', () => ({
  getClientIp: vi.fn(() => '127.0.0.1'),
  getAskLimit: vi.fn(() => ({ limit: vi.fn(async () => ({ success: true })) })),
  reserveBudget: vi.fn(async () => ({ allowed: true, reserved: 1512, pct: 0 })),
  settleBudget: vi.fn(async () => undefined),
  checkIdenticalQuestion: vi.fn(async () => ({ allowed: true })),
}));

// --- Mock PR #11 observability deps so server-only guard doesn't block ---
vi.mock('@/lib/ask-log', () => ({
  persistAskInteraction: vi.fn(async () => undefined),
}));

vi.mock('@/lib/ip-hash', () => ({
  hashIp: vi.fn(async () => 'hashed-ip-test'),
}));

vi.mock('@/lib/log', () => ({
  log: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Helper to read a streamed Response to a string.
async function readBody(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return '';
  const dec = new TextDecoder();
  let out = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    out += dec.decode(value, { stream: !done });
  }
  return out;
}

// Helper that builds a minimal POST NextRequest with a JSON body.
function makeRequest(question: string): NextRequest {
  return new NextRequest('http://localhost/api/ask', {
    method: 'POST',
    body: JSON.stringify({ question }),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('/api/ask behavioral — pre-stream timeout handling', () => {
  beforeEach(() => {
    // Ensure kill switch is off for every test.
    process.env.ASK_ENABLED = 'true';
    vi.resetModules();
  });

  it('returns HTTP 200 with STREAM_ERR_SENTINEL body when messages.create rejects', async () => {
    // Arrange: make the SDK reject with a simulated timeout.
    mockMessagesCreate.mockRejectedValueOnce(new Error('Request timed out after 30000ms'));

    // Re-import the route AFTER mocks are in place.
    const { POST } = await import('@/app/api/ask/route');

    const res = await POST(makeRequest('Who is Erik?'));

    // Should be a 200, not a 500.
    expect(res.status).toBe(200);

    // Body should start with the sentinel prefix.
    const body = await readBody(res);
    const { STREAM_ERR_SENTINEL } = await import('@/lib/stream-protocol');
    expect(body.startsWith(STREAM_ERR_SENTINEL)).toBe(true);
    expect(body).toContain('timed out');
  });
});

describe('/api/ask behavioral — mid-stream timeout watchdog (CG5)', () => {
  beforeEach(() => {
    process.env.ASK_ENABLED = 'true';
    vi.resetModules();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('emits STREAM_ERR_SENTINEL and closes when the stream stalls mid-flight', async () => {
    // A stream that yields one chunk, then stalls forever — no further
    // chunk and no `done`. Without the watchdog the consumer's `for await`
    // would hang the ReadableStream open indefinitely.
    const stalledStream: AsyncIterable<unknown> = {
      [Symbol.asyncIterator]() {
        let step = 0;
        return {
          next() {
            step += 1;
            if (step === 1) {
              return Promise.resolve({
                done: false,
                value: { type: 'message_start', message: { usage: { input_tokens: 10 } } },
              });
            }
            if (step === 2) {
              return Promise.resolve({
                done: false,
                value: {
                  type: 'content_block_delta',
                  delta: { type: 'text_delta', text: 'partial answer' },
                },
              });
            }
            // Step 3+: never resolve — the connection has stalled.
            return new Promise<never>(() => {
              /* intentionally never settles */
            });
          },
        };
      },
    };
    mockMessagesCreate.mockResolvedValueOnce(stalledStream);

    vi.useFakeTimers();
    const { POST } = await import('@/app/api/ask/route');
    const { STREAM_ERR_SENTINEL } = await import('@/lib/stream-protocol');

    const res = await POST(makeRequest('Who is Erik?'));
    expect(res.status).toBe(200);

    // Drain the body while advancing fake timers past the watchdog deadline.
    const reader = res.body?.getReader();
    expect(reader).toBeDefined();
    const dec = new TextDecoder();
    let out = '';
    const pump = (async () => {
      if (!reader) return;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) out += dec.decode(value, { stream: true });
      }
    })();

    // Trip the mid-stream watchdog. 15s window + slack.
    await vi.advanceTimersByTimeAsync(20_000);
    await pump;

    // The partial text streamed before the stall is preserved, then the
    // sentinel + timeout message is appended and the stream closes.
    expect(out).toContain('partial answer');
    expect(out).toContain(STREAM_ERR_SENTINEL);
    expect(out).toContain('mid-stream timeout');
  });
});

describe('/api/ask behavioral — X-Request-Id response header', () => {
  // UUID v4 shape — what crypto.randomUUID() produces. Tightened from the
  // catch-all hex regex in the e2e mock so a regression that returns 'abc' or
  // a fixed value would fail here.
  const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  beforeEach(() => {
    process.env.ASK_ENABLED = 'true';
    vi.resetModules();
  });

  it('returns X-Request-Id on the streaming success path', async () => {
    // Mock the SDK to return a minimal valid async iterable so the route
    // reaches the success ReadableStream branch (where the headers live).
    mockMessagesCreate.mockResolvedValueOnce({
      async *[Symbol.asyncIterator]() {
        yield {
          type: 'message_start',
          message: { usage: { input_tokens: 10 } },
        };
        yield {
          type: 'content_block_delta',
          delta: { type: 'text_delta', text: 'hello' },
        };
        yield {
          type: 'message_delta',
          usage: { output_tokens: 5 },
        };
      },
    });

    const { POST } = await import('@/app/api/ask/route');
    const res = await POST(makeRequest('Who is Erik?'));

    expect(res.status).toBe(200);
    const requestId = res.headers.get('x-request-id');
    expect(requestId).not.toBeNull();
    expect(requestId).toMatch(UUID_V4);

    // Drain the body so the persistAskInteraction promise in `finally` can
    // settle. Skipping this leaks a microtask but doesn't fail the assertion.
    await readBody(res);
  });

  it('returns X-Request-Id on the pre-stream error path', async () => {
    // Same surface as the timeout test above, but the assertion is on the
    // header — this is the branch that returns from a `catch` and not the
    // success branch.
    mockMessagesCreate.mockRejectedValueOnce(new Error('upstream 503'));

    const { POST } = await import('@/app/api/ask/route');
    const res = await POST(makeRequest('Who is Erik?'));

    expect(res.status).toBe(200);
    const requestId = res.headers.get('x-request-id');
    expect(requestId).not.toBeNull();
    expect(requestId).toMatch(UUID_V4);
  });
});
