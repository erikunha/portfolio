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
    const negatives = ASK_EVAL_CALIBRATION.filter((i) => i.humanVerdict === false);
    expect(negatives.length).toBeGreaterThanOrEqual(1);
  });

  it('includes at least one positive gold case (humanVerdict === true)', () => {
    const positives = ASK_EVAL_CALIBRATION.filter((i) => i.humanVerdict === true);
    expect(positives.length).toBeGreaterThanOrEqual(1);
  });
});
