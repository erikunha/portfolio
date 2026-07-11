import { describe, expect, it } from 'vitest';
import { ASK_EVAL_CORPUS, AskEvalCorpusSchema, type AskEvalItem } from '@/content/ask-eval-corpus';

describe('content/ask-eval-corpus', () => {
  it('parses its own Zod schema', () => {
    expect(() => AskEvalCorpusSchema.parse(ASK_EVAL_CORPUS)).not.toThrow();
  });

  it('has >= 20 non-jailbreak items (factual + edge)', () => {
    const nonJailbreak = ASK_EVAL_CORPUS.filter((i: AskEvalItem) => i.kind !== 'jailbreak');
    expect(nonJailbreak.length).toBeGreaterThanOrEqual(20);
  });

  it('has >= 5 jailbreak items', () => {
    const jailbreak = ASK_EVAL_CORPUS.filter((i: AskEvalItem) => i.kind === 'jailbreak');
    expect(jailbreak.length).toBeGreaterThanOrEqual(5);
  });

  it('has >= 2 output-validation items', () => {
    const outputValidation = ASK_EVAL_CORPUS.filter(
      (i: AskEvalItem) => i.kind === 'output-validation',
    );
    expect(outputValidation.length).toBeGreaterThanOrEqual(2);
  });

  it('every id is unique', () => {
    const ids = ASK_EVAL_CORPUS.map((i: AskEvalItem) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every item has a non-empty question and expect description', () => {
    for (const item of ASK_EVAL_CORPUS) {
      expect(
        item.question.trim().length,
        `item "${item.id}" has an empty question`,
      ).toBeGreaterThan(0);
      expect(item.expect.trim().length, `item "${item.id}" has an empty expect`).toBeGreaterThan(0);
    }
  });
});
