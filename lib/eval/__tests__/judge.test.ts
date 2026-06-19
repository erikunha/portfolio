// lib/eval/__tests__/judge.test.ts
// Behavioral test for the shared LLM-judge call (lib/eval/judge.ts), extracted
// verbatim from scripts/ask-eval.ts. Mocks the `ai` SDK `generateText` and
// asserts the judge's parse/retry/fail-closed semantics without any real
// Gateway call:
//   (a) bare-JSON verdict parses to {pass,reason}
//   (b) prose-wrapped JSON is extracted via the first {...} span
//   (c) a no-JSON response → {pass:false, reason:'judge returned no JSON'}
//   (d) a thrown error after retries → pass:false with the retry-exhaustion
//       reason prefix
//   (e) token usage passes through

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGenerateText } = vi.hoisted(() => ({ mockGenerateText: vi.fn() }));
vi.mock('ai', () => ({ generateText: mockGenerateText }));

import { JUDGE_SYSTEM, judge, MAX_JUDGE_RETRIES } from '@/lib/eval/judge';

const item = { id: 'q1', question: 'Q?', kind: 'factual', expect: 'must convey X' };

beforeEach(() => {
  mockGenerateText.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers(); // safe no-op unless a test opted into fake timers
});

describe('lib/eval/judge', () => {
  it('exposes the shared JUDGE_SYSTEM prompt and retry budget', () => {
    expect(typeof JUDGE_SYSTEM).toBe('string');
    expect(JUDGE_SYSTEM.length).toBeGreaterThan(0);
    expect(MAX_JUDGE_RETRIES).toBe(2);
  });

  it('parses a bare-JSON verdict to {pass,reason}', async () => {
    mockGenerateText.mockResolvedValueOnce({
      text: '{"pass": true, "reason": "covers X"}',
      usage: { inputTokens: 100, outputTokens: 20 },
    });
    const v = await judge(item, 'an answer', { model: 'm' });
    expect(v.pass).toBe(true);
    expect(v.reason).toBe('covers X');
  });

  it('extracts JSON from a prose-wrapped response (first {...} span)', async () => {
    mockGenerateText.mockResolvedValueOnce({
      text: 'Here is my verdict:\n{"pass": false, "reason": "misses X"}\nthanks',
      usage: { inputTokens: 1, outputTokens: 1 },
    });
    const v = await judge(item, 'an answer', { model: 'm' });
    expect(v.pass).toBe(false);
    expect(v.reason).toBe('misses X');
  });

  it('returns the no-JSON fail when the response has no JSON object', async () => {
    mockGenerateText.mockResolvedValueOnce({
      text: 'I cannot decide',
      usage: { inputTokens: 5, outputTokens: 3 },
    });
    const v = await judge(item, 'an answer', { model: 'm' });
    expect(v.pass).toBe(false);
    expect(v.reason).toBe('judge returned no JSON');
  });

  it('fails closed with the retry-exhaustion prefix after all attempts throw', async () => {
    // Fake timers so the retry loop's 1s + 2s exponential backoff resolves
    // instantly instead of costing 3 real seconds of wall-clock per run.
    vi.useFakeTimers();
    mockGenerateText.mockRejectedValue(new Error('network blip'));
    const vPromise = judge(item, 'an answer', { model: 'm' });
    await vi.runAllTimersAsync(); // drive both backoffs + flush microtasks
    const v = await vPromise;
    expect(v.pass).toBe(false);
    expect(v.reason.startsWith(`judge errored after ${MAX_JUDGE_RETRIES + 1} attempts`)).toBe(true);
    // 1 initial + MAX_JUDGE_RETRIES retries
    expect(mockGenerateText).toHaveBeenCalledTimes(MAX_JUDGE_RETRIES + 1);
  });

  it('passes token usage through', async () => {
    mockGenerateText.mockResolvedValueOnce({
      text: '{"pass": true, "reason": "ok"}',
      usage: { inputTokens: 42, outputTokens: 7 },
    });
    const v = await judge(item, 'an answer', { model: 'm' });
    expect(v.inputTokens).toBe(42);
    expect(v.outputTokens).toBe(7);
  });
});
