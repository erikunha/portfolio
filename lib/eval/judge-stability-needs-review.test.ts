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

describe('needs review, split verdicts', () => {
  const summary = summarizeStability(
    [
      item('pass-a', T, T, T, T, T),
      item('pass-b', T, T, T, T, T),
      item('fail-a', F, F, F, F, F),
      item('split-a', T, T, F, F, T),
      item('split-b', T, T, T, F, T),
    ],
    5,
  );

  it('lists each item whose valid verdicts are not unanimous with its sequence', () => {
    expect(summary.needsReview).toEqual({
      count: 2,
      items: [
        { id: 'split-a', verdicts: [T, T, F, F, T] },
        { id: 'split-b', verdicts: [T, T, T, F, T] },
      ],
    });
  });

  it('breaks the measured items into unanimous pass, unanimous fail and needs review', () => {
    expect(summary.breakdown).toEqual({ unanimousPass: 2, unanimousFail: 1, needsReview: 2 });
    expect(
      summary.breakdown.unanimousPass + summary.breakdown.unanimousFail + summary.needsReview.count,
    ).toBe(summary.measuredItems);
  });

  it('keeps the published fields and the pass rate per repeat as they were', () => {
    expect(summary.flippingItems).toBe(2);
    expect(summary.flipping).toEqual(summary.needsReview.items);
    expect(summary.flipRate).toEqual({ value: 0.4, reason: null });
    expect(summary.passRatePerRepeat).toEqual([0.8, 0.8, 0.6, 0.4, 0.8]);
  });
});

describe('needs review, errored repeats', () => {
  it('flags a split among the valid verdicts and keeps the errored slot in the sequence', () => {
    const summary = summarizeStability([item('a', T, F, E), item('b', T, T, E)], 3);
    expect(summary.needsReview.items).toEqual([{ id: 'a', verdicts: [T, F, E] }]);
    expect(summary.breakdown).toEqual({ unanimousPass: 1, unanimousFail: 0, needsReview: 1 });
  });

  it('leaves an item with fewer than two valid verdicts out of every bucket', () => {
    const summary = summarizeStability([item('a', T, E, E), item('b', F, F, F)], 3);
    expect(summary.needsReview).toEqual({ count: 0, items: [] });
    expect(summary.breakdown).toEqual({ unanimousPass: 0, unanimousFail: 1, needsReview: 0 });
  });
});

describe('needs review, k=1 and empty input', () => {
  it('has nothing to review at k=1', () => {
    const summary = summarizeStability([item('a', T), item('b', F)], 1);
    expect(summary.needsReview).toEqual({ count: 0, items: [] });
    expect(summary.breakdown).toEqual({ unanimousPass: 0, unanimousFail: 0, needsReview: 0 });
  });

  it('serialises without NaN', () => {
    const json = JSON.stringify(summarizeStability([], 3));
    expect(json).not.toMatch(/NaN|Infinity/);
  });
});

describe('needs review, calibration', () => {
  it('lists a gold case whose verdicts split, whatever the human label', () => {
    const summary = summarizeCalibrationStability(
      [
        { ...item('g1', T, F, T), humanVerdict: T },
        { ...item('g2', F, F, F), humanVerdict: F },
      ],
      3,
    );
    expect(summary.needsReview).toEqual({
      count: 1,
      items: [{ id: 'g1', verdicts: [T, F, T] }],
    });
    expect(summary.breakdown).toEqual({ unanimousPass: 0, unanimousFail: 1, needsReview: 1 });
  });
});

describe('formatJudgeStability, needs review', () => {
  const stability: JudgeStability = {
    judgeRepeats: 5,
    gateRepeat: 1,
    corpus: summarizeStability(
      [
        item('ok', T, T, T, T, T),
        item('no', F, F, F, F, F),
        item('fact-ai-direction', T, T, F, F, T),
        item('edge-consulting-client-not-named', T, T, T, F, T),
      ],
      5,
    ),
    calibration: summarizeCalibrationStability(
      [{ ...item('g1', T, T, T, T, T), humanVerdict: T }],
      5,
    ),
  };

  it('prints the count and every id with its sequence on one line', () => {
    const lines = formatJudgeStability(stability, 1);
    expect(lines).toContain(
      '    needs review 2: fact-ai-direction [P P F F P], edge-consulting-client-not-named [P P P F P]',
    );
  });

  it('puts the needs review line before any statistic of its block', () => {
    const lines = formatJudgeStability(stability, 1);
    const corpus = lines.indexOf('  corpus');
    const needs = lines.findIndex((l) => l.includes('needs review 2'));
    const firstStat = lines.findIndex((l) => l.includes('items judged'));
    expect(needs).toBe(corpus + 1);
    expect(needs).toBeLessThan(firstStat);
  });

  it('prints the unanimous pass, unanimous fail and needs review breakdown', () => {
    const text = formatJudgeStability(stability, 1).join('\n');
    expect(text).toContain('unanimous pass 1, unanimous fail 1, needs review 2');
  });

  it('says needs review 0 when every verdict is unanimous', () => {
    const calm: JudgeStability = {
      ...stability,
      corpus: summarizeStability([item('a', T, T, T, T, T)], 5),
    };
    const text = formatJudgeStability(calm, 1).join('\n');
    expect(text).toContain('needs review 0');
    expect(text).not.toMatch(/needs review 0:/);
  });
});
