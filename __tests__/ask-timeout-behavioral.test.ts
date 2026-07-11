import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockStreamText = vi.fn();

vi.mock('ai', () => ({
  streamText: mockStreamText,
}));

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
  };
}

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
            return new Promise<never>(() => undefined);
          },
        };
      },
    },
    usage: Promise.resolve({ inputTokens: 0, outputTokens: 0 }),
  };
}

function makeOkResult(text = 'hello') {
  return {
    textStream: {
      async *[Symbol.asyncIterator]() {
        yield text;
      },
    },
    usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
  };
}

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
    mockStreamText.mockReturnValueOnce(makeFailingResult('Request timed out after 30000ms'));

    const { POST } = await import('@/app/api/ask/route');

    const res = await POST(makeRequest('Who is Erik?'));

    expect(res.status).toBe(200);

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
    mockStreamText.mockReturnValueOnce(makeStalledResult());

    vi.useFakeTimers();
    const { POST } = await import('@/app/api/ask/route');
    const { STREAM_ERR_SENTINEL } = await import('@/lib/stream-protocol');

    const res = await POST(makeRequest('Who is Erik?'));
    expect(res.status).toBe(200);

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

    await vi.advanceTimersByTimeAsync(20_000);
    await pump;

    expect(out).toContain('partial answer');
    expect(out).toContain(STREAM_ERR_SENTINEL);
    expect(out).toContain('mid-stream timeout');
  });
});

describe('/api/ask behavioral — X-Request-Id response header', () => {
  const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  beforeEach(() => {
    process.env.ASK_ENABLED = 'true';
    vi.resetModules();
    mockStreamText.mockReset();
  });

  it('returns X-Request-Id on the streaming success path', async () => {
    mockStreamText.mockReturnValueOnce(makeOkResult());

    const { POST } = await import('@/app/api/ask/route');
    const res = await POST(makeRequest('Who is Erik?'));

    expect(res.status).toBe(200);
    const requestId = res.headers.get('x-request-id');
    expect(requestId).not.toBeNull();
    expect(requestId).toMatch(UUID_V4);

    await readBody(res);
  });

  it('returns X-Request-Id even when the stream fails to start', async () => {
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
