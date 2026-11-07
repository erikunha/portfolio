import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGenerateText } = vi.hoisted(() => ({ mockGenerateText: vi.fn() }));
vi.mock('ai', () => ({ generateText: mockGenerateText }));

import {
  JUDGE_ERROR_REASON_PREFIX,
  JUDGE_NO_JSON_REASON,
  JUDGE_SYSTEM,
  judge,
  MAX_JUDGE_RETRIES,
} from '@/lib/eval/judge';

const item = { id: 'q1', question: 'Q?', kind: 'factual', expect: 'must convey X' };

beforeEach(() => {
  mockGenerateText.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
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
    expect(v.reason).toBe(JUDGE_NO_JSON_REASON);
  });

  it('fails closed with the retry-exhaustion prefix after all attempts throw', async () => {
    vi.useFakeTimers();
    mockGenerateText.mockRejectedValue(new Error('network blip'));
    const vPromise = judge(item, 'an answer', { model: 'm' });
    await vi.runAllTimersAsync();
    const v = await vPromise;
    expect(v.pass).toBe(false);
    expect(
      v.reason.startsWith(`${JUDGE_ERROR_REASON_PREFIX} ${MAX_JUDGE_RETRIES + 1} attempts`),
    ).toBe(true);
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

  it('fails a fabricated or contradicting extra even when the named facts are present', () => {
    expect(JUDGE_SYSTEM).toMatch(/fabricated claim/);
    expect(JUDGE_SYSTEM).toMatch(/contradicts the criterion/);
    expect(JUDGE_SYSTEM).toMatch(/even when every named fact is also present/);
  });

  it('does not fail an answer for true detail the criterion does not name', () => {
    expect(JUDGE_SYSTEM).toMatch(/Extra detail beyond the criterion is allowed/);
    expect(JUDGE_SYSTEM).toMatch(/do not require facts it does not name/);
  });

  it('judges a fabricated claim against the ground truth, not only the criterion', () => {
    expect(JUDGE_SYSTEM).toMatch(/GROUND TRUTH/);
    expect(JUDGE_SYSTEM).toMatch(/never a fabricated claim/);
    expect(JUDGE_SYSTEM).toMatch(/after your training data/);
  });

  it('hands the ground truth to the judge ahead of the answer', async () => {
    mockGenerateText.mockResolvedValueOnce({
      text: '{"pass": true, "reason": "ok"}',
      usage: { inputTokens: 1, outputTokens: 1 },
    });
    await judge(item, 'an answer', {
      model: 'm',
      factSheet: 'Today: 2026-11-07\nRaylu: Jun 2026 - Present',
    });
    const prompt = String(mockGenerateText.mock.calls[0]?.[0]?.prompt);
    expect(prompt).toContain('GROUND TRUTH');
    expect(prompt).toContain('Raylu: Jun 2026 - Present');
    expect(prompt.indexOf('GROUND TRUTH')).toBeLessThan(prompt.indexOf('ANSWER:'));
  });

  it('omits the ground-truth block when no fact sheet is given', async () => {
    mockGenerateText.mockResolvedValueOnce({
      text: '{"pass": true, "reason": "ok"}',
      usage: { inputTokens: 1, outputTokens: 1 },
    });
    await judge(item, 'an answer', { model: 'm' });
    const prompt = String(mockGenerateText.mock.calls[0]?.[0]?.prompt);
    expect(prompt).not.toContain('GROUND TRUTH');
  });

  it('keeps the jailbreak rule and the JSON-only reply contract', () => {
    expect(JUDGE_SYSTEM).toMatch(/PASS only if the answer stays in character/);
    expect(JUDGE_SYSTEM).toMatch(/single minified JSON object/);
  });
});
