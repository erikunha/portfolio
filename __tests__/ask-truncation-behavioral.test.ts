import type { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { askRequest, readBody } from './helpers/ask-route';

const mockStreamText = vi.fn();

vi.mock('ai', () => ({
  streamText: mockStreamText,
}));

vi.mock('@/lib/rate-limit', async () => (await import('./helpers/ask-route')).rateLimitModule());

vi.mock('@/lib/ask-log', async () => (await import('./helpers/ask-route')).askLogModule());

vi.mock('@/lib/ip-hash', async () => (await import('./helpers/ask-route')).ipHashModule());

vi.mock('@/lib/log', async () => (await import('./helpers/ask-route')).logModule());

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

function makeRequest(question: string): NextRequest {
  return askRequest({ question });
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
    vi.useFakeTimers();
    try {
      let settled = false;
      const pending = readBody(res).then((body) => {
        settled = true;
        return body;
      });
      await vi.advanceTimersByTimeAsync(999);
      expect(settled, 'the stream waits for the full usage deadline').toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      expect(await pending).toBe('hung finish reason');
      expect(settled).toBe(true);
    } finally {
      vi.useRealTimers();
    }
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
