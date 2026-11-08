import { beforeEach, describe, expect, it, vi } from 'vitest';
import { askRequest, readBody } from './helpers/ask-route';

const QUESTION = 'Who is Erik?';
const releaseMock = vi.hoisted(() => vi.fn(async (..._args: unknown[]) => undefined));
const model = vi.hoisted(() => ({
  mode: 'fail-before-text' as 'fail-before-text' | 'ok' | 'throws',
}));

vi.mock('@/lib/ask/model', async () => {
  const { MockLanguageModelV4, simulateReadableStream } = await import('ai/test');
  return {
    ASK_MODEL: new MockLanguageModelV4({
      doStream: async () => {
        if (model.mode === 'fail-before-text') throw new Error('gateway down');
        return {
          stream: simulateReadableStream({
            chunks: [
              { type: 'text-start', id: 't' },
              { type: 'text-delta', id: 't', delta: 'Erik builds things.' },
              { type: 'text-end', id: 't' },
              {
                type: 'finish',
                finishReason: { unified: 'stop', raw: 'stop' },
                usage: {
                  inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
                  outputTokens: { total: 4, text: 4, reasoning: 0 },
                },
              },
            ],
          }),
        };
      },
    }),
  };
});
vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>();
  return {
    ...actual,
    streamText: (...args: Parameters<typeof actual.streamText>) => {
      if (model.mode === 'throws') throw new Error('invalid model configuration');
      return actual.streamText(...args);
    },
  };
});
vi.mock('@/lib/rate-limit', async () =>
  (await import('./helpers/ask-route')).rateLimitModule({
    hasRedisCredentials: vi.fn(() => false),
    releaseIdenticalQuestion: releaseMock,
    reserveBudget: vi.fn(async () => ({
      allowed: true,
      reserved: 1512,
      pct: 0,
      budgetKey: 'ask:tokens:test',
      dailyKey: 'ask:tokens:day:test',
    })),
  }),
);
vi.mock('@/lib/ask-log', async () => (await import('./helpers/ask-route')).askLogModule());
vi.mock('@/lib/ip-hash', async () => (await import('./helpers/ask-route')).ipHashModule());
vi.mock('@/lib/log', async () => (await import('./helpers/ask-route')).logModule());

describe('/api/ask identical-question lock when the answer never starts', () => {
  beforeEach(() => {
    process.env.ASK_ENABLED = 'true';
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    releaseMock.mockClear();
  });

  it('releases the lock when the model fails before the first chunk', async () => {
    model.mode = 'fail-before-text';
    const { POST } = await import('@/app/api/ask/route');
    await readBody(await POST(askRequest({ question: QUESTION })));

    await vi.waitFor(() =>
      expect(
        releaseMock,
        'the visitor saw an error, so asking the same question again must not be refused as a duplicate for 60 seconds',
      ).toHaveBeenCalledWith('hashed-ip-test', QUESTION),
    );
  });

  it('releases the lock when the stream cannot start at all', async () => {
    model.mode = 'throws';
    const { POST } = await import('@/app/api/ask/route');
    const res = await POST(askRequest({ question: QUESTION }));

    expect(res.status).toBe(500);
    await vi.waitFor(() => expect(releaseMock).toHaveBeenCalledWith('hashed-ip-test', QUESTION));
  });

  it('keeps the lock once an answer was delivered', async () => {
    model.mode = 'ok';
    const { POST } = await import('@/app/api/ask/route');
    const body = await readBody(await POST(askRequest({ question: QUESTION })));

    expect(body).toContain('Erik builds things.');
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(releaseMock).not.toHaveBeenCalled();
  });
});
