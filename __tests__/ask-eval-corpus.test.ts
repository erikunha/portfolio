// __tests__/ask-eval-corpus.test.ts
// Structural test for the /api/ask quality-eval corpus.
//
// The corpus is content (content/ask-eval-corpus.ts) — it is typed and
// Zod-validated like every other module in content/. This test asserts the
// load-time invariants the eval harness (scripts/ask-eval.ts) and the CI
// `ai-eval` job depend on:
//
//   1. The exported array parses its own Zod schema (drift guard — a
//      malformed item would otherwise fail only at harness runtime, in CI,
//      after spending Gateway tokens).
//   2. There are >= 20 non-jailbreak items (factual + edge) and >= 5
//      jailbreak items — enough coverage that the correctness rate and the
//      jailbreak-resistance rate are statistically meaningful, not anecdotal.
//   3. Every `id` is unique — the harness keys results and the Redis
//      aggregate by id; a collision would silently drop an eval row.

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
