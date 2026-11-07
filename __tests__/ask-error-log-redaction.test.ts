import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const SECRET_QUESTION = 'what is the salary expectation canary-7f3a91';
const logError = vi.fn();
const streamTextMock = vi.hoisted(() => vi.fn());

vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>();
  streamTextMock.mockImplementation(actual.streamText);
  return { ...actual, streamText: streamTextMock };
});

vi.mock('@/lib/ask/model', async () => {
  const { MockLanguageModelV4 } = await import('ai/test');
  const { APICallError } = await import('ai');
  return {
    ASK_MODEL: new MockLanguageModelV4({
      doStream: async () => {
        throw new APICallError({
          message: 'gateway rejected the request',
          url: 'https://gateway.invalid/v1',
          requestBodyValues: { prompt: SECRET_QUESTION },
          statusCode: 400,
          isRetryable: false,
        });
      },
    }),
  };
});

vi.mock('@/lib/rate-limit', () => ({
  getClientIp: vi.fn(() => '127.0.0.1'),
  getAskLimit: vi.fn(() => ({ limit: vi.fn(async () => ({ success: true })) })),
  hasRedisCredentials: vi.fn(() => false),
  reserveBudget: vi.fn(async () => ({
    allowed: true,
    reserved: 1512,
    pct: 0,
    budgetKey: 'ask:tokens:test',
  })),
  settleBudget: vi.fn(async () => undefined),
  checkIdenticalQuestion: vi.fn(async () => ({ allowed: true })),
}));
vi.mock('@/lib/ask-log', () => ({ persistAskInteraction: vi.fn(async () => undefined) }));
vi.mock('@/lib/ip-hash', () => ({ hashIp: vi.fn(async () => 'hashed-ip-test') }));
vi.mock('@/lib/log', () => ({
  log: { info: vi.fn(), error: logError, warn: vi.fn(), debug: vi.fn() },
}));

async function drain(res: Response): Promise<void> {
  const reader = res.body?.getReader();
  if (!reader) return;
  while (!(await reader.read()).done) {
    /* drain */
  }
}

function ask(): NextRequest {
  return new NextRequest('http://localhost/api/ask', {
    method: 'POST',
    body: JSON.stringify({ question: SECRET_QUESTION }),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('/api/ask error logging', () => {
  beforeEach(() => {
    process.env.ASK_ENABLED = 'true';
    logError.mockClear();
  });

  it('logs a gateway failure as name, statusCode and message only, never the request body', async () => {
    const { POST } = await import('@/app/api/ask/route');
    await drain(await POST(ask()));

    const upstream = logError.mock.calls.find(([msg]) => msg === 'ask upstream error');
    expect(upstream, 'the upstream failure must still be logged').toBeDefined();
    expect(
      JSON.stringify(logError.mock.calls),
      'APICallError carries requestBodyValues; serialising the error object writes the visitor prompt to the log drain',
    ).not.toContain('canary-7f3a91');
    expect(upstream?.[1]).toMatchObject({
      error: {
        name: 'AI_APICallError',
        statusCode: 400,
        message: 'gateway rejected the request',
      },
    });
  });

  it('logs a mid-stream throw without the error object', async () => {
    const { APICallError } = await import('ai');
    streamTextMock.mockImplementationOnce(() => ({
      textStream: {
        [Symbol.asyncIterator]: () => ({
          next: async () => {
            throw new APICallError({
              message: 'stream broke',
              url: 'https://gateway.invalid/v1',
              requestBodyValues: { prompt: SECRET_QUESTION },
              statusCode: 502,
            });
          },
          return: async () => ({ done: true, value: undefined }),
        }),
      },
      usage: Promise.reject(new Error('no usage')),
      finishReason: Promise.resolve('error'),
    }));
    const { POST } = await import('@/app/api/ask/route');
    await drain(await POST(ask()));

    expect(logError.mock.calls.some(([msg]) => msg === 'ask stream failed')).toBe(true);
    expect(JSON.stringify(logError.mock.calls)).not.toContain('canary-7f3a91');
  });
});
