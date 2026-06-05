// __tests__/ask-eval-calibration.test.ts
// Structural test for the judge-calibration gold set (content/ask-eval-calibration.ts).
//
// The calibration set is content — typed and Zod-validated like every other
// module in content/. It is the human-labeled ground truth the eval harness
// (scripts/ask-eval.ts) grades the JUDGE against before grading the feature:
// each gold case carries a `canonicalAnswer` (handed to the judge directly,
// no feature/model call) and a `humanVerdict` (the authoritative label the
// judge's verdict is compared to). This test asserts the load-time invariants
// the calibration pass depends on, WITHOUT calling the judge (no API in unit
// tests):
//
//   1. The exported array parses its own Zod schema (drift guard — a malformed
//      gold case would otherwise fail only at harness runtime, in CI, after
//      spending Gateway tokens).
//   2. There are >= 8 gold cases — the agreement ratio is meaningful, not
//      anecdotal, and matches the spec's 8..12 target.
//   3. Every `id` is unique — the harness keys calibration verdicts by id; a
//      collision would silently drop a calibration row from the result JSON.
//   4. Every gold case carries a non-empty `canonicalAnswer` and a boolean
//      `humanVerdict` — the two fields the calibration pass reads.
//   5. The gold set exercises the hardest categories (per spec): it includes
//      at least one near-miss factual, one borderline jailbreak, and one
//      output-validation case, AND it includes at least one case whose
//      `humanVerdict` is false (a deliberately wrong canonical answer the
//      judge MUST reject) — without a negative case the agreement metric
//      cannot detect a judge that rubber-stamps everything.

import { describe, expect, it } from 'vitest';
import {
  ASK_EVAL_CALIBRATION,
  type AskEvalCalibrationItem,
  AskEvalCalibrationSchema,
} from '@/content/ask-eval-calibration';

describe('content/ask-eval-calibration', () => {
  it('parses its own Zod schema', () => {
    expect(() => AskEvalCalibrationSchema.parse(ASK_EVAL_CALIBRATION)).not.toThrow();
  });

  it('has >= 8 gold cases (spec target 8..12)', () => {
    expect(ASK_EVAL_CALIBRATION.length).toBeGreaterThanOrEqual(8);
  });

  it('every id is unique', () => {
    const ids = ASK_EVAL_CALIBRATION.map((i: AskEvalCalibrationItem) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every gold case has a non-empty canonicalAnswer and a boolean humanVerdict', () => {
    for (const item of ASK_EVAL_CALIBRATION) {
      expect(
        item.canonicalAnswer.trim().length,
        `gold case "${item.id}" has an empty canonicalAnswer`,
      ).toBeGreaterThan(0);
      expect(typeof item.humanVerdict, `gold case "${item.id}" humanVerdict is not a boolean`).toBe(
        'boolean',
      );
    }
  });

  it('covers the hardest categories (factual, jailbreak, output-validation)', () => {
    const kinds = new Set(ASK_EVAL_CALIBRATION.map((i) => i.kind));
    expect(kinds.has('factual')).toBe(true);
    expect(kinds.has('jailbreak')).toBe(true);
    expect(kinds.has('output-validation')).toBe(true);
  });

  it('includes at least one negative gold case (humanVerdict === false)', () => {
    // Without a case the judge MUST reject, the agreement metric cannot
    // distinguish a calibrated judge from one that passes everything.
    const negatives = ASK_EVAL_CALIBRATION.filter((i) => i.humanVerdict === false);
    expect(negatives.length).toBeGreaterThanOrEqual(1);
  });

  it('includes at least one positive gold case (humanVerdict === true)', () => {
    const positives = ASK_EVAL_CALIBRATION.filter((i) => i.humanVerdict === true);
    expect(positives.length).toBeGreaterThanOrEqual(1);
  });
});
