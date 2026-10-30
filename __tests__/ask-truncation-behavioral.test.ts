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
  log: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

function makeCappedResult(text: string) {
  return {
    textStream: {
      async *[Symbol.asyncIterator]() {
        yield text;
      },
    },
    usage: Promise.resolve({ inputTokens: 10, outputTokens: 512 }),
    finishReason: Promise.resolve('length'),
  };
}

function makeCompleteResult(text: string) {
  return {
    textStream: {
      async *[Symbol.asyncIterator]() {
        yield text;
      },
    },
    usage: Promise.resolve({ inputTokens: 10, outputTokens: 20 }),
    finishReason: Promise.resolve('stop'),
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
    out += dec.decode(value, { stream: true });
  }
  return out + dec.decode();
}

function makeRequest(question: string): NextRequest {
  return new NextRequest('http://localhost/api/ask', {
    method: 'POST',
    body: JSON.stringify({ question }),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('/api/ask behavioral: finishReason length handling', () => {
  const originalAskEnabled = process.env.ASK_ENABLED;

  afterEach(() => {
    if (originalAskEnabled === undefined) delete process.env.ASK_ENABLED;
    else process.env.ASK_ENABLED = originalAskEnabled;
  });

  beforeEach(() => {
    process.env.ASK_ENABLED = 'true';
    vi.resetModules();
    mockStreamText.mockReset();
  });

  it('appends an explicit truncation notice when the model hits the output-token cap mid-word', async () => {
    mockStreamText.mockReturnValueOnce(makeCappedResult('The last receipt is ONBO'));

    const { POST } = await import('@/app/api/ask/route');
    const res = await POST(makeRequest('List every performance receipt'));
    expect(res.status).toBe(200);

    const body = await readBody(res);
    expect(body).toContain('The last receipt is ONBO');
    expect(body).toMatch(/\[answer truncated/i);
    expect(
      body.endsWith('.') || /\]\s*$/.test(body),
      `the stream must close with the notice, not mid-word (got: ${JSON.stringify(body.slice(-40))})`,
    ).toBe(true);
  });

  it('does not append the truncation notice on a normal finish', async () => {
    mockStreamText.mockReturnValueOnce(
      makeCompleteResult('Erik works at Raylu, remote, since Jun 2026.'),
    );

    const { POST } = await import('@/app/api/ask/route');
    const res = await POST(makeRequest('Where does Erik work?'));
    expect(res.status).toBe(200);

    const body = await readBody(res);
    expect(body).toBe('Erik works at Raylu, remote, since Jun 2026.');
    expect(body).not.toMatch(/\[answer truncated/i);
  });

  it('still streams cleanly when finishReason never resolves a known value', async () => {
    const result = makeCompleteResult('plain answer');
    Object.assign(result, { finishReason: Promise.resolve('unknown') });
    mockStreamText.mockReturnValueOnce(result);

    const { POST } = await import('@/app/api/ask/route');
    const res = await POST(makeRequest('Anything'));
    expect(res.status).toBe(200);

    const body = await readBody(res);
    expect(body).toBe('plain answer');
  });

  it('closes the stream within the usage deadline when finishReason never settles', async () => {
    const result = makeCompleteResult('hung finish reason');
    Object.assign(result, { finishReason: new Promise(() => undefined) });
    mockStreamText.mockReturnValueOnce(result);

    const { POST } = await import('@/app/api/ask/route');
    const res = await POST(makeRequest('Anything'));
    const startedAt = Date.now();
    const body = await readBody(res);

    expect(body).toBe('hung finish reason');
    expect(Date.now() - startedAt).toBeLessThan(3_000);
  });

  it('streams cleanly when finishReason rejects', async () => {
    const result = makeCompleteResult('rejected finish reason');
    Object.assign(result, { finishReason: Promise.reject(new Error('boom')) });
    mockStreamText.mockReturnValueOnce(result);

    const { POST } = await import('@/app/api/ask/route');
    const res = await POST(makeRequest('Anything'));

    expect(await readBody(res)).toBe('rejected finish reason');
  });

  it('records the finish reason in the completion log', async () => {
    mockStreamText.mockReturnValueOnce(makeCappedResult('cut'));
    const { log } = await import('@/lib/log');

    const { POST } = await import('@/app/api/ask/route');
    await readBody(await POST(makeRequest('List every receipt')));

    await vi.waitFor(() => {
      expect(log.info).toHaveBeenCalledWith(
        'ask completed',
        expect.objectContaining({ truncated: true }),
      );
    });
  });
});
