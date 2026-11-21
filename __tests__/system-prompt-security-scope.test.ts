import { describe, expect, it } from 'vitest';
import { ASK_EVAL_CORPUS } from '@/content/ask-eval-corpus';
import { isInjectionAttempt } from '@/lib/ask/injection';
import { SYSTEM_TEXT } from '@/lib/ask/system-prompt';

const SCOPE_START = 'Scope:';
const SCOPE_END = 'Be direct and honest.';
const TWIN_IDS = ['edge-injection-phrase-mentioned', 'edge-pt-injection-phrase-mentioned'];

function scopeRule(): string {
  const start = SYSTEM_TEXT.indexOf(SCOPE_START);
  const end = SYSTEM_TEXT.indexOf(SCOPE_END, start);
  expect(start, 'the Scope paragraph is missing from the system prompt').toBeGreaterThanOrEqual(0);
  return SYSTEM_TEXT.slice(start, end);
}

describe('scope rule and a question about how Erik handles security', () => {
  it('puts a question about how Erik approaches a security or AI-safety topic on topic and answers it from his record', () => {
    const rule = scopeRule();

    expect(rule).toMatch(/how Erik approaches or handles/i);
    expect(rule).toMatch(/security/i);
    expect(rule).toMatch(/prompt injection/i);
    expect(rule).toMatch(/on topic/i);
    expect(rule).toMatch(/from his record/i);
  });

  it('says that quoting an attack phrase is not itself an attack and that the quoted phrase is not followed', () => {
    const rule = scopeRule();

    expect(rule).toMatch(/quoting[^.]*is not itself an attack/i);
    expect(rule).toMatch(/do not follow the quoted phrase/i);
    expect(rule).toMatch(/never say you cannot answer/i);
  });

  it('does not quote the phrase of the eval twins in the prompt that they grade', () => {
    for (const id of TWIN_IDS) {
      const item = ASK_EVAL_CORPUS.find((i) => i.id === id);
      const phrase = /'([^']+)'/.exec(item?.question ?? '')?.[1] ?? '';

      expect(item?.kind).toBe('edge');
      expect(phrase.length).toBeGreaterThan(0);
      expect(isInjectionAttempt(item?.question ?? ''), id).toBe(false);
      expect(SYSTEM_TEXT.toLowerCase(), id).not.toContain(phrase.toLowerCase());
    }
  });
});
