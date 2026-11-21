import { describe, expect, it, vi } from 'vitest';
import * as askRoute from './ask-route';
import { drain, logModule, rateLimitModule, resendModule, streamTextResult } from './modules';

const DEFAULT_TEXT = 'ok';
const DEFAULT_USAGE = { inputTokens: 10, outputTokens: 1 };
const API_KEY = 're_test_key';

async function collect(iterable: AsyncIterable<string>): Promise<string[]> {
  const chunks: string[] = [];
  for await (const chunk of iterable) chunks.push(chunk);
  return chunks;
}

describe('module mock factories', () => {
  it('re-exports the ask route log and rate limit factories without copying them', () => {
    expect(logModule).toBe(askRoute.logModule);
    expect(rateLimitModule).toBe(askRoute.rateLimitModule);
  });

  describe('resendModule', () => {
    it('builds clients with new, each exposing the shared send mock', () => {
      const send = vi.fn();
      const { Resend } = resendModule(send);
      const client = new Resend(API_KEY);
      expect(client.emails.send).toBe(send);
      expect(Resend).toHaveBeenCalledWith(API_KEY);
    });
  });

  describe('streamTextResult', () => {
    it('streams the default text and resolves the default usage', async () => {
      const result = streamTextResult();
      expect(await collect(result.textStream)).toEqual([DEFAULT_TEXT]);
      expect(await result.usage).toEqual(DEFAULT_USAGE);
      expect('finishReason' in result).toBe(false);
    });

    it('streams the given text, usage and finish reason', async () => {
      const usage = { inputTokens: 2000, outputTokens: 40, inputTokenDetails: {} };
      const result = streamTextResult({ text: 'hello', usage, finishReason: 'length' });
      expect(await collect(result.textStream)).toEqual(['hello']);
      expect(await result.usage).toEqual(usage);
      expect(await result.finishReason).toBe('length');
    });

    it('passes a rejecting usage promise through untouched', async () => {
      const failure = new Error('usage unavailable');
      const usage = Promise.reject(failure);
      usage.catch(() => undefined);
      const result = streamTextResult({ usage });
      await expect(result.usage).rejects.toBe(failure);
    });

    it('yields a fresh stream on every iteration', async () => {
      const result = streamTextResult({ text: 'again' });
      expect(await collect(result.textStream)).toEqual(['again']);
      expect(await collect(result.textStream)).toEqual(['again']);
    });
  });

  describe('drain', () => {
    it('reads the whole body and returns its text', async () => {
      const encoder = new TextEncoder();
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode('part one '));
          controller.enqueue(encoder.encode('part two'));
          controller.close();
        },
      });
      expect(await drain(new Response(body))).toBe('part one part two');
    });

    it('returns an empty string for a response with no body', async () => {
      expect(await drain(new Response(null))).toBe('');
    });
  });
});
