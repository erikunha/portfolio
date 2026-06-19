// lib/eval/__tests__/run-target.test.ts
// Behavioral test for the single-run target invocation (lib/eval/run-target.ts).
// Mocks the `ai` SDK generateText so NO Gateway call is made, and asserts:
//   - runTarget composes systemText (system) + prompt and calls the SDK once
//   - it returns { output, inputTokens, outputTokens, errored:false }
//   - a thrown SDK error surfaces as { errored:true, detail } (never silently
//     passes as a successful empty run)
//   - missing usage falls back to 0 tokens

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGenerateText } = vi.hoisted(() => ({ mockGenerateText: vi.fn() }));
vi.mock('ai', () => ({ generateText: mockGenerateText }));

import { runTarget } from '@/lib/eval/run-target';

const testCase = {
  prompt: 'Do the task.',
  target: { systemText: 'You are under test. Obey the rule.' },
};

beforeEach(() => {
  mockGenerateText.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('lib/eval/run-target runTarget', () => {
  it('calls generateText once with systemText as system and prompt as prompt', async () => {
    mockGenerateText.mockResolvedValueOnce({
      text: 'git add lib/foo.ts',
      usage: { inputTokens: 120, outputTokens: 12 },
    });
    const r = await runTarget(testCase, { model: 'anthropic/claude-haiku-4-5' });
    expect(mockGenerateText).toHaveBeenCalledTimes(1);
    const arg = mockGenerateText.mock.calls[0]?.[0];
    expect(arg.model).toBe('anthropic/claude-haiku-4-5');
    expect(arg.system).toBe(testCase.target.systemText);
    expect(arg.prompt).toBe(testCase.prompt);
    // Bounded, deterministic invocation: caps per-run spend (cost projection
    // holds) and removes sampling noise from the measured prompt-adherence.
    expect(arg.maxOutputTokens).toBe(512);
    expect(arg.temperature).toBe(0);
    expect(r.errored).toBe(false);
    expect(r.output).toBe('git add lib/foo.ts');
    expect(r.inputTokens).toBe(120);
    expect(r.outputTokens).toBe(12);
  });

  it('falls back to 0 tokens when usage is absent', async () => {
    mockGenerateText.mockResolvedValueOnce({ text: 'answer' });
    const r = await runTarget(testCase, { model: 'm' });
    expect(r.errored).toBe(false);
    expect(r.inputTokens).toBe(0);
    expect(r.outputTokens).toBe(0);
  });

  it('surfaces a thrown SDK error as errored:true with a detail, not a silent pass', async () => {
    mockGenerateText.mockRejectedValueOnce(new Error('gateway 503'));
    const r = await runTarget(testCase, { model: 'm' });
    expect(r.errored).toBe(true);
    expect(r.detail).toContain('gateway 503');
    // an errored run produces no usable output and contributes zero spend
    expect(r.output).toBe('');
    expect(r.inputTokens).toBe(0);
    expect(r.outputTokens).toBe(0);
  });
});
