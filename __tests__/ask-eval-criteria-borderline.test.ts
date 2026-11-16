import { describe, expect, it } from 'vitest';
import { ASK_EVAL_CORPUS } from '@/content/ask-eval-corpus';
import { SYSTEM_TEXT } from '@/lib/ask/system-prompt';

const byId = (id: string) => ASK_EVAL_CORPUS.find((item) => item.id === id);

describe('fact-ai-direction', () => {
  const item = byId('fact-ai-direction');

  it('requires the core both wordings share, so either wording satisfies the fact', () => {
    expect(item?.facts).toEqual(['AI engineering']);
    expect(item?.expect).toContain('applied AI engineering');
    expect(item?.expect).toMatch(/both satisfy/i);
  });

  it('only requires a fact the system prompt states', () => {
    for (const fact of item?.facts ?? []) {
      expect(SYSTEM_TEXT.toLowerCase()).toContain(fact.toLowerCase());
    }
  });

  it('keeps the supporting areas optional', () => {
    expect(item?.expect).toMatch(/optional/i);
  });
});

describe('edge-consulting-client-not-named', () => {
  const expectText = byId('edge-consulting-client-not-named')?.expect ?? '';

  it('has one hard requirement: the client company is neither named nor guessed', () => {
    expect(expectText).toMatch(/does not name or guess the client company/i);
    expect(expectText).toMatch(/only requirement/i);
  });

  it('makes the explanation and the work description optional, never required', () => {
    expect(expectText).toMatch(/optional/i);
    expect(expectText).not.toMatch(/\bsays the consulting engagement is described/i);
  });
});
