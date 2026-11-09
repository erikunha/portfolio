import { streamText } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { askErrors } from '@/content/ask-errors';
import { SITE_LOCALE } from '@/content/site-locale';
import { askRequest } from './helpers/ask-route';

const PARTIAL_ANSWER = 'partial answer';
const NATIVE_TIMEOUT_MS = 300;
const PAST_THE_WATCHDOG_MS = 20_000;
const persistMock = vi.fn(async (_interaction: { status: string; answer: string }) => undefined);

function stalledAfterFirstChunk() {
  return new MockLanguageModelV4({
    doStream: async (options) => ({
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue({ type: 'stream-start', warnings: [] });
          controller.enqueue({ type: 'text-start', id: 't' });
          controller.enqueue({ type: 'text-delta', id: 't', delta: PARTIAL_ANSWER });
          options.abortSignal?.addEventListener('abort', () => {
            try {
              controller.error(options.abortSignal?.reason);
            } catch {
              return;
            }
          });
        },
      }),
    }),
  });
}

vi.mock('@/lib/ask/model', () => ({ ASK_MODEL: stalledAfterFirstChunk() }));

vi.mock('@/lib/rate-limit', async () => (await import('./helpers/ask-route')).rateLimitModule());
vi.mock('@/lib/ask-log', async () =>
  (await import('./helpers/ask-route')).askLogModule(persistMock),
);
vi.mock('@/lib/ip-hash', async () => (await import('./helpers/ask-route')).ipHashModule());
vi.mock('@/lib/log', async () => (await import('./helpers/ask-route')).logModule());

describe('a stalled upstream with the real AI SDK', () => {
  beforeEach(() => {
    process.env.ASK_ENABLED = 'true';
    persistMock.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('is reported by the SDK timeout option only through finishReason, never through onError or textStream', async () => {
    const errors: unknown[] = [];
    const result = streamText({
      model: stalledAfterFirstChunk(),
      prompt: 'x',
      timeout: { chunkMs: NATIVE_TIMEOUT_MS },
      onError: ({ error }) => errors.push(error),
    });

    let text = '';
    for await (const chunk of result.textStream) text += chunk;

    expect(text).toBe(PARTIAL_ANSWER);
    expect(
      errors,
      'the native timeout calls neither onError nor throws from textStream: the pump would close a cut answer as completed, so the app watchdog cannot be dropped for timeout.chunkMs',
    ).toEqual([]);
    await expect(result.finishReason).rejects.toThrow(/timeout/i);
  });

  it('still ends the visitor stream with the interrupted copy and an errored log row', async () => {
    vi.useFakeTimers();
    const { POST } = await import('@/app/api/ask/route');
    const { STREAM_ERR_SENTINEL } = await import('@/lib/stream-protocol');
    const res = await POST(askRequest({ question: 'Who is Erik?' }));

    const reader = res.body?.getReader();
    const decoder = new TextDecoder();
    let body = '';
    const pump = (async () => {
      if (!reader) return;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) body += decoder.decode(value, { stream: true });
      }
    })();
    await vi.advanceTimersByTimeAsync(PAST_THE_WATCHDOG_MS);
    await pump;

    expect(body).toBe(
      `${PARTIAL_ANSWER}${STREAM_ERR_SENTINEL}${askErrors[SITE_LOCALE.en].interrupted}`,
    );
    await vi.waitFor(() => expect(persistMock).toHaveBeenCalledOnce());
    expect(persistMock.mock.calls[0]?.[0].status).toBe('errored');
  });
});
