import { describe, expect, it } from 'vitest';
import {
  formatJudgeStability,
  type JudgeStability,
  type RepeatVerdict,
  summarizeCalibrationStability,
  summarizeStability,
} from '@/lib/eval/judge-stability';

const T = true;
const F = false;
const E = null;

function item(id: string, ...verdicts: RepeatVerdict[]) {
  return { id, verdicts };
}

describe('summarizeStability, deterministic judge', () => {
  const summary = summarizeStability(
    [item('a', T, T, T), item('b', F, F, F), item('c', T, T, T)],
    3,
  );

  it('has no flips', () => {
    expect(summary.flipRate.value).toBe(0);
    expect(summary.flippingItems).toBe(0);
    expect(summary.flipping).toEqual([]);
    expect(summary.unanimousItems).toBe(3);
  });

  it('has kappa 1 and alpha 1 when both classes occur and every item is unanimous', () => {
    expect(summary.kappa).toEqual({ value: 1, reason: null });
    expect(summary.alpha).toEqual({ value: 1, reason: null });
  });

  it('reports an identical pass rate on every repeat', () => {
    expect(summary.passRatePerRepeat).toEqual([0.6667, 0.6667, 0.6667]);
  });
});

describe('summarizeStability, scripted non-deterministic judge', () => {
  const summary = summarizeStability(
    [item('a', T, T, T), item('b', F, F, F), item('c', T, T, F), item('d', T, F, F)],
    3,
  );

  it('counts the flips and lists the flipping items with their verdict sequence', () => {
    expect(summary.items).toBe(4);
    expect(summary.measuredItems).toBe(4);
    expect(summary.unanimousItems).toBe(2);
    expect(summary.flippingItems).toBe(2);
    expect(summary.flipRate).toEqual({ value: 0.5, reason: null });
    expect(summary.flipping).toEqual([
      { id: 'c', verdicts: [T, T, F] },
      { id: 'd', verdicts: [T, F, F] },
    ]);
  });

  it('computes Fleiss kappa 1/3 by hand: Pbar 2/3, Pe 1/2', () => {
    expect(summary.kappa.reason).toBeNull();
    expect(summary.kappa.value).toBeCloseTo(1 / 3, 4);
    expect(summary.kappaItems).toBe(4);
  });

  it('computes Krippendorff alpha 7/18 by hand: 1 - 11 * 4 / 72', () => {
    expect(summary.alpha.reason).toBeNull();
    expect(summary.alpha.value).toBeCloseTo(7 / 18, 4);
  });

  it('reports the pass rate of each repeat', () => {
    expect(summary.passRatePerRepeat).toEqual([0.75, 0.5, 0.25]);
  });
});

describe('summarizeStability, two repeats', () => {
  const summary = summarizeStability(
    [item('a', T, T), item('b', F, F), item('c', T, F), item('d', F, T)],
    2,
  );

  it('has kappa 0 (Pbar 1/2, Pe 1/2) and alpha 1/8 by hand', () => {
    expect(summary.flipRate.value).toBe(0.5);
    expect(summary.kappa.value).toBeCloseTo(0, 4);
    expect(summary.alpha.value).toBeCloseTo(1 / 8, 4);
  });
});

describe('summarizeStability, errored repeats', () => {
  const summary = summarizeStability(
    [item('a', T, T, T), item('b', T, F, E), item('c', E, E, T), item('d', F, F, E)],
    3,
  );

  it('counts the errored repeats and excludes an item with fewer than two valid repeats', () => {
    expect(summary.erroredRepeats).toBe(4);
    expect(summary.measuredItems).toBe(3);
    expect(summary.unmeasuredItems).toBe(1);
    expect(summary.flipRate.value).toBeCloseTo(1 / 3, 4);
  });

  it('keeps the errored slot in the verdict sequence of a flipping item', () => {
    expect(summary.flipping).toEqual([{ id: 'b', verdicts: [T, F, E] }]);
  });

  it('computes the pass rate per repeat over the valid verdicts only', () => {
    expect(summary.passRatePerRepeat).toEqual([0.6667, 0.3333, 1]);
  });

  it('uses only complete items for kappa and every item with two valid repeats for alpha', () => {
    expect(summary.kappaItems).toBe(1);
    expect(summary.kappa.value).toBeNull();
    expect(summary.kappa.reason).toMatch(/one class/);
    expect(summary.alpha.value).toBeCloseTo(0.5, 4);
  });
});

describe('summarizeStability, errored slot that does not flip', () => {
  const summary = summarizeStability([item('a', T, T, E)], 3);

  it('counts the item as measured and not flipping', () => {
    expect(summary.measuredItems).toBe(1);
    expect(summary.unmeasuredItems).toBe(0);
    expect(summary.flippingItems).toBe(0);
    expect(summary.unanimousItems).toBe(1);
    expect(summary.flipping).toEqual([]);
    expect(summary.flipRate).toEqual({ value: 0, reason: null });
  });
});

describe('summarizeStability, kappa beside errored repeats', () => {
  const summary = summarizeStability(
    [item('a', T, T, F), item('b', F, F, F), item('c', T, T, E), item('d', T, E, E)],
    3,
  );

  it('uses only the items with every repeat valid: Pbar 2/3, Pe 5/9, kappa 1/4', () => {
    expect(summary.kappaItems).toBe(2);
    expect(summary.kappa.reason).toBeNull();
    expect(summary.kappa.value).toBeCloseTo(0.25, 4);
  });
});

describe('summarizeStability, degenerate input never yields NaN', () => {
  it('k=1 has no flip rate, kappa or alpha, each with a reason', () => {
    const summary = summarizeStability([item('a', T), item('b', F)], 1);
    expect(summary.flipRate).toEqual({ value: null, reason: expect.stringMatching(/2 or more/) });
    expect(summary.kappa).toEqual({ value: null, reason: expect.stringMatching(/2 or more/) });
    expect(summary.alpha).toEqual({ value: null, reason: expect.stringMatching(/2 or more/) });
    expect(summary.passRatePerRepeat).toEqual([0.5]);
    expect(summary.flipping).toEqual([]);
  });

  it('a single class has flip rate 0 and null kappa and alpha with a reason', () => {
    const summary = summarizeStability([item('a', T, T, T), item('b', T, T, T)], 3);
    expect(summary.flipRate.value).toBe(0);
    expect(summary.kappa).toEqual({ value: null, reason: expect.stringMatching(/one class/) });
    expect(summary.alpha).toEqual({ value: null, reason: expect.stringMatching(/one class/) });
  });

  it('no items gives null everywhere', () => {
    const summary = summarizeStability([], 3);
    expect(summary.flipRate.value).toBeNull();
    expect(summary.kappa.value).toBeNull();
    expect(summary.alpha.value).toBeNull();
    expect(summary.passRatePerRepeat).toEqual([null, null, null]);
  });

  it('serialises without NaN or Infinity', () => {
    const cases = [
      summarizeStability([], 3),
      summarizeStability([item('a', T)], 1),
      summarizeStability([item('a', E, E, E)], 3),
      summarizeStability([item('a', F, F), item('b', F, F)], 2),
    ];
    for (const summary of cases) {
      expect(JSON.stringify(summary)).not.toMatch(/NaN|Infinity|"value":null,"reason":null/);
      expect(JSON.parse(JSON.stringify(summary))).toEqual(summary);
    }
  });

  it('refuses an item whose verdict count differs from the repeat count', () => {
    expect(() => summarizeStability([item('a', T, T)], 3)).toThrow(/a.*2.*3/);
  });
});

describe('summarizeCalibrationStability', () => {
  const summary = summarizeCalibrationStability(
    [
      { ...item('c1', T, T, T), humanVerdict: T },
      { ...item('c2', F, F, F), humanVerdict: F },
      { ...item('c3', T, F, T), humanVerdict: T },
      { ...item('c4', F, F, E), humanVerdict: F },
    ],
    3,
  );

  it('counts the gold cases that agree with the human label in every repeat', () => {
    expect(summary.agreeAllRepeats).toBe(2);
    expect(summary.items).toBe(4);
  });

  it('reports the calibration flip rate', () => {
    expect(summary.flipRate.value).toBe(0.25);
    expect(summary.flipping).toEqual([{ id: 'c3', verdicts: [T, F, T] }]);
  });
});

describe('formatJudgeStability', () => {
  const stability: JudgeStability = {
    judgeRepeats: 3,
    gateRepeat: 1,
    corpus: summarizeStability(
      [item('a', T, T, T), item('b', F, F, F), item('c', T, T, F), item('d', T, F, F)],
      3,
    ),
    calibration: summarizeCalibrationStability(
      [
        { ...item('c1', T, T, T), humanVerdict: T },
        { ...item('c3', T, F, T), humanVerdict: T },
      ],
      3,
    ),
  };

  it('prints the section with every number', () => {
    const text = formatJudgeStability(stability, 1.2345).join('\n');
    expect(text).toContain('Judge stability (k=3)');
    expect(text).toContain('grades and gates use repeat 1');
    expect(text).toContain('corpus');
    expect(text).toContain('flip rate          2/4 items (50.0%)');
    expect(text).toContain('Fleiss kappa       0.333');
    expect(text).toContain('Krippendorff alpha 0.389');
    expect(text).toContain('pass rate/repeat   75.0% 50.0% 25.0%');
    expect(text).toContain('c [P P F]');
    expect(text).toContain('d [P F F]');
    expect(text).toContain('calibration');
    expect(text).toContain(
      'agree with human in all 3 repeats (an errored repeat counts as disagreement) 1/2',
    );
    expect(text).toContain('judge cost ~$1.2345 (3 judge calls per item)');
  });

  it('prints n/a with the reason for an undefined statistic', () => {
    const degenerate: JudgeStability = {
      ...stability,
      corpus: summarizeStability([item('a', T, T, T)], 3),
    };
    const text = formatJudgeStability(degenerate, 0).join('\n');
    expect(text).toContain('Fleiss kappa       n/a (');
    expect(text).not.toMatch(/NaN|undefined|null/);
  });

  it('prints a calibration-only section when the corpus did not run', () => {
    const text = formatJudgeStability({ ...stability, corpus: null }, 0.5).join('\n');
    expect(text).toContain('corpus             not run');
  });
});
