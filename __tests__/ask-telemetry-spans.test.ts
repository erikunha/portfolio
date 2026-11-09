import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { MockLanguageModelV4 } from 'ai/test';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AskContext } from '@/lib/ask/preflight';
import { readBody } from './helpers/ask-route';
import { resetTelemetryRegistration } from './helpers/telemetry-registration';

const QUESTION = 'Which zebra-striped-quokka framework does Erik prefer?';
const ANSWER = 'Erik prefers the purple-walrus-ledger approach.';
const LEGACY_FUNCTION_ID_ATTRIBUTE = 'ai.telemetry.functionId';
const LEGACY_USAGE_ATTRIBUTE = 'ai.usage.inputTokens';

type SpanRecord = { name: string; attributes: Record<string, unknown> };
type FakeSpan = Record<string, unknown>;
type SpanOptions = { attributes?: Record<string, unknown> };

const spans: SpanRecord[] = [];

function startRecordedSpan(name: string, options?: SpanOptions): FakeSpan {
  const record: SpanRecord = { name, attributes: { ...options?.attributes } };
  spans.push(record);
  const span: FakeSpan = {
    setAttribute(key: string, value: unknown) {
      record.attributes[key] = value;
      return span;
    },
    setAttributes(attributes: Record<string, unknown>) {
      Object.assign(record.attributes, attributes);
      return span;
    },
    addEvent: () => span,
    setStatus: () => span,
    updateName: () => span,
    recordException: () => undefined,
    end: () => undefined,
    isRecording: () => true,
    spanContext: () => ({ traceId: 'a'.repeat(32), spanId: 'b'.repeat(16), traceFlags: 1 }),
  };
  return span;
}

const recordingTracer = {
  startSpan: (name: string, options?: SpanOptions) => startRecordedSpan(name, options),
  startActiveSpan: (name: string, ...rest: unknown[]) => {
    const callback = rest[rest.length - 1] as (span: FakeSpan) => unknown;
    const options = typeof rest[0] === 'object' ? (rest[0] as SpanOptions) : undefined;
    return callback(startRecordedSpan(name, options));
  },
};

vi.mock('langfuse-vercel', () => ({ LangfuseExporter: class {} }));

vi.mock('@vercel/otel', () => ({
  registerOTel: () => {
    const fromOtelPackage = createRequire(fileURLToPath(import.meta.resolve('@ai-sdk/otel')));
    const { trace } = fromOtelPackage('@opentelemetry/api') as {
      trace: { setGlobalTracerProvider: (provider: unknown) => boolean };
    };
    trace.setGlobalTracerProvider({ getTracer: () => recordingTracer });
  },
}));

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

function context(): AskContext {
  return {
    requestId: 'req-spans',
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

async function askWithRegistration(): Promise<void> {
  const { registerLangfuseProcessor } = await import('@/lib/telemetry/langfuse');
  await registerLangfuseProcessor();
  const { createAskStream } = await import('@/lib/ask/stream');
  const stream = createAskStream(context());
  await readBody(new Response(stream.readable));
  await stream.settle();
}

describe('/api/ask spans through the registered OpenTelemetry integration', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('LANGFUSE_ENABLED', 'true');
    resetTelemetryRegistration();
    spans.length = 0;
  });

  it('emits spans carrying the legacy attributes the Langfuse exporter reads', async () => {
    await askWithRegistration();
    const withFunctionId = spans.filter(
      (span) => span.attributes[LEGACY_FUNCTION_ID_ATTRIBUTE] === 'ask',
    );
    expect(withFunctionId.length, 'no ask span reached the tracer').toBeGreaterThan(0);
    expect(spans.some((span) => LEGACY_USAGE_ATTRIBUTE in span.attributes)).toBe(true);
  });

  it('records no question or answer text on any span', async () => {
    await askWithRegistration();
    const serialized = JSON.stringify(spans);
    expect(serialized).not.toContain('zebra-striped-quokka');
    expect(serialized).not.toContain('purple-walrus-ledger');
  });
});
