import { beforeEach, describe, expect, it, vi } from 'vitest';
import { askErrors } from '@/content/ask-errors';
import { SITE_LOCALE } from '@/content/site-locale';
import { askRequest, readBody } from './helpers/ask-route';

const persistMock = vi.fn(async (_interaction: { status: string; answer: string }) => undefined);
const upstream = vi.hoisted(() => ({
  partialAnswer: 'Erik works at Raylu, remote, and the last receipt is ONBO',
  finishReason: 'interrupted' as 'interrupted' | 'stop',
}));

vi.mock('@/lib/ask/model', async () => {
  const { MockLanguageModelV4, simulateReadableStream } = await import('ai/test');
  return {
    ASK_MODEL: new MockLanguageModelV4({
      doStream: async () => ({
        stream: simulateReadableStream({
          chunks: [
            { type: 'text-start', id: 't' },
            { type: 'text-delta', id: 't', delta: upstream.partialAnswer },
            { type: 'text-end', id: 't' },
            {
              type: 'finish' as const,
              finishReason: { unified: upstream.finishReason, raw: upstream.finishReason },
              usage: {
                inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
                outputTokens: { total: 8, text: 8, reasoning: 0 },
              },
            },
          ],
        }),
      }),
    }),
  };
});

vi.mock('@/lib/rate-limit', async () => (await import('./helpers/ask-route')).rateLimitModule());
vi.mock('@/lib/ask-log', async () =>
  (await import('./helpers/ask-route')).askLogModule(persistMock),
);
vi.mock('@/lib/ip-hash', async () => (await import('./helpers/ask-route')).ipHashModule());
vi.mock('@/lib/log', async () => (await import('./helpers/ask-route')).logModule());

describe('/api/ask when the provider reports the stream as interrupted', () => {
  beforeEach(() => {
    process.env.ASK_ENABLED = 'true';
    persistMock.mockClear();
  });

  it('tells the visitor the answer was interrupted and records the run as errored', async () => {
    upstream.finishReason = 'interrupted';
    const { POST } = await import('@/app/api/ask/route');
    const { STREAM_ERR_SENTINEL } = await import('@/lib/stream-protocol');
    const body = await readBody(await POST(askRequest({ question: 'Who is Erik?' })));

    expect(body).toBe(
      `${upstream.partialAnswer}${STREAM_ERR_SENTINEL}${askErrors[SITE_LOCALE.en].interrupted}`,
    );
    await vi.waitFor(() => expect(persistMock).toHaveBeenCalledOnce());
    expect(
      persistMock.mock.calls[0]?.[0].status,
      'a stream cut mid-answer is not a completed interaction',
    ).toBe('errored');
  });

  it('leaves a stream that finished with a stop reason completed', async () => {
    upstream.finishReason = 'stop';
    const { POST } = await import('@/app/api/ask/route');
    const body = await readBody(await POST(askRequest({ question: 'Who is Erik?' })));

    expect(body).toBe(upstream.partialAnswer);
    await vi.waitFor(() => expect(persistMock).toHaveBeenCalledOnce());
    expect(persistMock.mock.calls[0]?.[0].status).toBe('completed');
  });
});
