import { MockLanguageModelV4 } from 'ai/test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AskContext } from '@/lib/ask/preflight';
import { readBody } from './helpers/ask-route';

const QUESTION = 'Which zebra-striped-quokka framework does Erik prefer?';
const ANSWER = 'Erik prefers the purple-walrus-ledger approach.';

const model = new MockLanguageModelV4({
  doStream: async () => ({
    stream: new ReadableStream({
      start(controller) {
        controller.enqueue({ type: 'stream-start', warnings: [] });
        controller.enqueue({ type: 'text-start', id: 't1' });
        controller.enqueue({ type: 'text-delta', id: 't1', delta: ANSWER });
        controller.enqueue({ type: 'text-end', id: 't1' });
        controller.enqueue({
          type: 'finish',
          finishReason: { unified: 'stop', raw: 'stop' },
          usage: {
            inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
            outputTokens: { total: 8, text: 8, reasoning: 0 },
          },
        });
        controller.close();
      },
    }),
  }),
});

vi.mock('@/lib/ask/model', () => ({ ASK_MODEL: model }));

vi.mock('@/lib/rate-limit', async () => (await import('./helpers/ask-route')).rateLimitModule());

vi.mock('@/lib/ask-log', async () => (await import('./helpers/ask-route')).askLogModule());

vi.mock('@/lib/log', async () => (await import('./helpers/ask-route')).logModule());

type TelemetryGlobal = typeof globalThis & {
  AI_SDK_TELEMETRY_INTEGRATIONS?: unknown[];
};

const captured: unknown[] = [];

function capturingIntegration() {
  const record = (event: unknown): void => {
    captured.push(JSON.parse(JSON.stringify(event ?? null)));
  };
  return {
    onStart: record,
    onStepStart: record,
    onLanguageModelCallStart: record,
    onLanguageModelCallEnd: record,
    onStepEnd: record,
    onEnd: record,
    onError: record,
  };
}

function context(): AskContext {
  return {
    requestId: 'req-privacy',
    ipHash: 'hash',
    question: QUESTION,
    fullQuestion: QUESTION,
    answerLocale: 'en',
    reserved: 1512,
    budgetKey: 'ask:tokens:test',
    dailyKey: 'ask:daily:test',
    startedAt: Date.now(),
  };
}

async function runAskAndCapture(): Promise<string> {
  const { registerTelemetry } = await import('ai');
  registerTelemetry(capturingIntegration() as never);
  const { createAskStream } = await import('@/lib/ask/stream');
  const stream = createAskStream(context());
  const body = await readBody(new Response(stream.readable));
  await stream.settle();
  return body;
}

describe('/api/ask telemetry privacy', () => {
  beforeEach(() => {
    vi.resetModules();
    captured.length = 0;
    (globalThis as TelemetryGlobal).AI_SDK_TELEMETRY_INTEGRATIONS = [];
  });

  afterEach(() => {
    delete (globalThis as TelemetryGlobal).AI_SDK_TELEMETRY_INTEGRATIONS;
  });

  it('delivers lifecycle events to a registered integration', async () => {
    const body = await runAskAndCapture();
    expect(body).toBe(ANSWER);
    expect(captured.length).toBeGreaterThan(0);
  });

  it('never delivers the question or the answer text to a registered integration', async () => {
    await runAskAndCapture();
    const serialized = JSON.stringify(captured);
    expect(serialized, 'question text leaked into a telemetry event').not.toContain(
      'zebra-striped-quokka',
    );
    expect(serialized, 'answer text leaked into a telemetry event').not.toContain(
      'purple-walrus-ledger',
    );
  });

  it('names the call with the ask function id so traces are attributable', async () => {
    await runAskAndCapture();
    expect(JSON.stringify(captured)).toContain('"functionId":"ask"');
  });
});
