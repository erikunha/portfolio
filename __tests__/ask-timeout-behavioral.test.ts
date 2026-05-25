// __tests__/ask-timeout-behavioral.test.ts
// Behavioral test: verifies that a failure from the upstream model call
// (/api/ask, now routed through the Vercel AI Gateway via the `ai` package's
// `streamText`) is caught and surfaced as an HTTP 200 with a
// STREAM_ERR_SENTINEL-prefixed body — not an unhandled 500.
//
// `streamText` is synchronous: it returns a result handle immediately and
// performs the HTTP request lazily as `result.textStream` is consumed.
// Unlike the prior direct-SDK `await anthropic.messages.create()` (which
// could reject before the ReadableStream was constructed), BOTH stream-init
// failures and mid-stream failures now surface as a throw from the
// `textStream` async iterator — handled by the single consumer catch in the
// route. This test exercises that path by EXERCISING the route, not grepping
// source.

import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Shared mock for streamText — declared at module scope so each test can
// install its own textStream behavior without re-importing the SDK.
const mockStreamText = vi.fn();

// --- Mock the `ai` package (Vercel AI SDK) before importing the route ---
vi.mock('ai', () => ({
  streamText: mockStreamText,
}));

// --- Mock @/lib/rate-limit so we don't need Redis ---
vi.mock('@/lib/rate-limit', () => ({
  getClientIp: vi.fn(() => '127.0.0.1'),
  getAskLimit: vi.fn(() => ({ limit: vi.fn(async () => ({ success: true })) })),
  reserveBudget: vi.fn(async () => ({
    allowed: true,
    reserved: 1512,
    pct: 0,
    budgetKey: 'ask:tokens:test',
  })),
  settleBudget: vi.fn(async () => undefined),
  checkIdenticalQuestion: vi.fn(async () => ({ allowed: true })),
}));

// --- Mock observability deps so server-only guard doesn't block ---
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

// streamText result whose textStream throws on the first iterator step —
// simulates a stream-initiation failure (timeout / network error). The AI SDK
// suppresses stream errors when `onError` is set (the route sets it), so
// `usage` / `providerMetadata` still RESOLVE — to zeroed values on a failed
// stream — rather than reject. The route's settlement path reads them after
// the stream-error catch.
function makeFailingResult(message: string) {
  const err = new Error(message);
  return {
    textStream: {
      [Symbol.asyncIterator]() {
        return {
          next() {
            return Promise.reject(err);
          },
        };
      },
    },
    usage: Promise.resolve({ inputTokens: 0, outputTokens: 0 }),
    providerMetadata: Promise.resolve({
      anthropic: { cacheReadInputTokens: 0, cacheCreationInputTokens: 0 },
    }),
  };
}

// streamText result with a textStream that yields one chunk, then stalls
// forever — simulates a connection that goes silent mid-stream. `usage` and
// `providerMetadata` resolve to zeros so the post-stall settlement path
// completes without hanging on the watchdog-tripped error path.
function makeStalledResult() {
  return {
    textStream: {
      [Symbol.asyncIterator]() {
        let step = 0;
        return {
          next() {
            step += 1;
            if (step === 1) {
              return Promise.resolve({ done: false, value: 'partial answer' });
            }
            // Step 2+: never resolve — the connection has stalled.
            return new Promise<never>(() => {
              /* intentionally never settles */
            });
          },
        };
      },
    },
    usage: Promise.resolve({ inputTokens: 0, outputTokens: 0 }),
    providerMetadata: Promise.resolve({
      anthropic: { cacheReadInputTokens: 0, cacheCreationInputTokens: 0 },
    }),
  };
}

// A minimal successful streamText result.
function makeOkResult(text = 'hello') {
  return {
    textStream: {
      async *[Symbol.asyncIterator]() {
        yield text;
      },
    },
    usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
    providerMetadata: Promise.resolve({
      anthropic: { cacheReadInputTokens: 0, cacheCreationInputTokens: 0 },
    }),
  };
}

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

describe('/api/ask behavioral — stream-initiation failure handling', () => {
  beforeEach(() => {
    process.env.ASK_ENABLED = 'true';
    vi.resetModules();
    mockStreamText.mockReset();
  });

  it('returns HTTP 200 with STREAM_ERR_SENTINEL body when the stream fails to start', async () => {
    // Arrange: the textStream rejects on its first step — a stream-init
    // failure (timeout / network error) surfaces through the iterator.
    mockStreamText.mockReturnValueOnce(makeFailingResult('Request timed out after 30000ms'));

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

describe('/api/ask behavioral — mid-stream timeout watchdog', () => {
  beforeEach(() => {
    process.env.ASK_ENABLED = 'true';
    vi.resetModules();
    mockStreamText.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('emits STREAM_ERR_SENTINEL and closes when the stream stalls mid-flight', async () => {
    // A stream that yields one chunk, then stalls forever — no further
    // chunk and no `done`. Without the watchdog the consumer's iterator
    // loop would hang the ReadableStream open indefinitely.
    mockStreamText.mockReturnValueOnce(makeStalledResult());

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
    mockStreamText.mockReset();
  });

  it('returns X-Request-Id on the streaming success path', async () => {
    // Mock streamText to return a minimal valid result so the route reaches
    // the success ReadableStream branch (where the headers live).
    mockStreamText.mockReturnValueOnce(makeOkResult());

    const { POST } = await import('@/app/api/ask/route');
    const res = await POST(makeRequest('Who is Erik?'));

    expect(res.status).toBe(200);
    const requestId = res.headers.get('x-request-id');
    expect(requestId).not.toBeNull();
    expect(requestId).toMatch(UUID_V4);

    // Drain the body so the persistAskInteraction promise can settle.
    await readBody(res);
  });

  it('returns X-Request-Id even when the stream fails to start', async () => {
    // The route mints the request id and sets the header before the stream
    // is consumed, so the id is present even on the error path.
    mockStreamText.mockReturnValueOnce(makeFailingResult('upstream 503'));

    const { POST } = await import('@/app/api/ask/route');
    const res = await POST(makeRequest('Who is Erik?'));

    expect(res.status).toBe(200);
    const requestId = res.headers.get('x-request-id');
    expect(requestId).not.toBeNull();
    expect(requestId).toMatch(UUID_V4);

    await readBody(res);
  });
});
