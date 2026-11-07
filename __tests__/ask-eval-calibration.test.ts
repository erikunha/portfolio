import { describe, expect, it } from 'vitest';
import {
  ASK_EVAL_CALIBRATION,
  type AskEvalCalibrationItem,
  AskEvalCalibrationSchema,
  CALIBRATION_TRAPS,
} from '@/content/ask-eval-calibration';

describe('content/ask-eval-calibration', () => {
  it('parses its own Zod schema', () => {
    expect(() => AskEvalCalibrationSchema.parse(ASK_EVAL_CALIBRATION)).not.toThrow();
  });

  it('has enough gold cases that one disagreement does not decide the gate', () => {
    expect(ASK_EVAL_CALIBRATION.length).toBeGreaterThanOrEqual(20);
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

  it('has >= 6 borderline cases, each tagged with the trap it sets', () => {
    const borderline = ASK_EVAL_CALIBRATION.filter((i) => i.trap !== undefined);
    expect(borderline.length).toBeGreaterThanOrEqual(6);
    for (const trap of [
      'near-miss-omission',
      'harmless-extra',
      'fabricated-extra',
      'true-fact-absent',
      'false-date',
    ] as const) {
      expect(
        borderline.some((i) => i.trap === trap),
        `no borderline case sets the "${trap}" trap`,
      ).toBe(true);
    }
    expect(CALIBRATION_TRAPS.length).toBeGreaterThan(0);
  });

  it('keeps both verdicts among the borderline cases, so neither a strict nor a lenient judge agrees by default', () => {
    const borderline = ASK_EVAL_CALIBRATION.filter((i) => i.trap !== undefined);
    expect(borderline.some((i) => i.humanVerdict)).toBe(true);
    expect(borderline.some((i) => !i.humanVerdict)).toBe(true);
  });

  it('labels a fabricated or contradicting extra as a failure and a harmless extra as a pass', () => {
    for (const item of ASK_EVAL_CALIBRATION) {
      if (item.trap === 'fabricated-extra') expect(item.humanVerdict, item.id).toBe(false);
      if (item.trap === 'wrong-number') expect(item.humanVerdict, item.id).toBe(false);
      if (item.trap === 'harmless-extra') expect(item.humanVerdict, item.id).toBe(true);
      if (item.trap === 'true-fact-absent') expect(item.humanVerdict, item.id).toBe(true);
      if (item.trap === 'false-date') expect(item.humanVerdict, item.id).toBe(false);
    }
  });

  it('keeps the false-date trap within a year of the true start so it tests an adjacent mismatch', () => {
    const MONTHS = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];
    const TRUE_START = 2026 * 12 + 5;
    const MAX_GAP_MONTHS = 12;
    const item = ASK_EVAL_CALIBRATION.find((i) => i.id === 'cal-border-employer-false-date');
    const match = item?.canonicalAnswer.match(new RegExp(`(${MONTHS.join('|')}) (\\d{4})`));
    expect(match).not.toBeNull();
    const stated = Number(match?.[2]) * 12 + MONTHS.indexOf(match?.[1] ?? '');
    expect(stated).not.toBe(TRUE_START);
    expect(Math.abs(stated - TRUE_START)).toBeLessThanOrEqual(MAX_GAP_MONTHS);
  });
});
