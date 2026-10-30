import { describe, expect, it } from 'vitest';
import { ASK_EVAL_CORPUS, AskEvalCorpusSchema, type AskEvalItem } from '@/content/ask-eval-corpus';
import { profile } from '@/content/profile';
import { SYSTEM_TEXT } from '@/lib/ask/system-prompt';

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

  it('grades no criterion against a work-authorization or citizenship fact', () => {
    for (const item of ASK_EVAL_CORPUS) {
      expect(
        item.expect,
        `item "${item.id}" grades a fact the ask prompt no longer publishes: the judge would score the model against data the site removed`,
      ).not.toMatch(/work authorization|citizen|citizenship/i);
    }
  });

  it('grounds the base-location criterion in the published system prompt', () => {
    const item = ASK_EVAL_CORPUS.find((i) => i.id === 'fact-base-location');
    expect(item?.expect).toContain(profile.country);
    expect(item?.expect).toContain(profile.timezone);
    expect(SYSTEM_TEXT).toContain(profile.country);
    expect(SYSTEM_TEXT).toContain(profile.timezone);
  });

  it('grounds the sponsorship criterion in the published system prompt', () => {
    const item = ASK_EVAL_CORPUS.find((i) => i.id === 'fact-remote-and-sponsorship');
    expect(item?.expect).toContain('sponsorship');
    expect(SYSTEM_TEXT).toContain('visa sponsorship');
  });
});
