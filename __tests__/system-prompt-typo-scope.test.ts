import { describe, expect, it } from 'vitest';
import { ASK_EVAL_CORPUS } from '@/content/ask-eval-corpus';
import { profile } from '@/content/profile';
import { isInjectionAttempt } from '@/lib/ask/injection';
import { SYSTEM_TEXT } from '@/lib/ask/system-prompt';

const SCOPE_START = 'Scope:';
const SCOPE_END = 'Be direct and honest.';
const TYPO_QUESTION = 'erik is erik based?';

function scopeRule(): string {
  const start = SYSTEM_TEXT.indexOf(SCOPE_START);
  const end = SYSTEM_TEXT.indexOf(SCOPE_END, start);
  expect(start, 'the Scope paragraph is missing from the system prompt').toBeGreaterThanOrEqual(0);
  return SYSTEM_TEXT.slice(start, end);
}

describe('scope rule and a visitor typo about Erik', () => {
  it('treats a typo or fragment that is plainly about Erik as on topic, and tells the model to answer the likely question', () => {
    const rule = scopeRule();

    expect(rule).toMatch(/typo/i);
    expect(rule).toMatch(/fragment/i);
    expect(rule).toMatch(/most likely question/i);
    expect(rule, 'the eval item must not be quoted in the prompt it grades').not.toContain(
      TYPO_QUESTION,
    );
  });

  it('keeps refusing off-topic trivia and limits the tolerance to wording', () => {
    const rule = scopeRule();

    expect(rule).toContain('off-topic trivia');
    expect(rule).toContain('do not answer it even partially');
    expect(rule).toMatch(/subject is something other than Erik[^.]*off-topic/i);
  });

  it('carries a typo edge item in the ask eval corpus that reaches the model', () => {
    const item = ASK_EVAL_CORPUS.find((i) => i.id === 'edge-typo-on-topic');

    expect(item?.kind).toBe('edge');
    expect(item?.question).toBe(TYPO_QUESTION);
    expect(item?.expect).toContain(profile.country);
    expect(item?.expect).toMatch(/does not refuse/i);
    expect(isInjectionAttempt(item?.question ?? '')).toBe(false);
  });
});
