import { describe, expect, it } from 'vitest';
import { ASK_EVAL_CORPUS } from '@/content/ask-eval-corpus';
import {
  askRequestBody,
  type GradedItem,
  gradeVerdict,
  summarizeGrades,
} from '@/lib/eval/ask-grading';
import { JUDGE_ERROR_REASON_PREFIX, JUDGE_NO_JSON_REASON } from '@/lib/eval/judge';

function graded(overrides: Partial<GradedItem>): GradedItem {
  return {
    id: 'x',
    kind: 'factual',
    locale: 'en',
    question: 'q',
    answer: 'a',
    pass: true,
    reason: 'ok',
    latencyMs: 1,
    errored: false,
    answered: true,
    gateRefused: false,
    ...overrides,
  };
}

describe('gradeVerdict: a judge outage is not a feature failure', () => {
  it('marks a judge API failure as errored, not as a failed answer', () => {
    const verdict = gradeVerdict({
      pass: false,
      reason: `${JUDGE_ERROR_REASON_PREFIX} 3 attempts: 503`,
    });
    expect(verdict).toMatchObject({ pass: false, errored: true });
  });

  it('marks an unparseable judge reply as errored', () => {
    expect(gradeVerdict({ pass: false, reason: JUDGE_NO_JSON_REASON }).errored).toBe(true);
  });

  it('keeps a real judge fail as a fail that counts against the rate', () => {
    expect(gradeVerdict({ pass: false, reason: 'answer invents a claim' })).toEqual({
      pass: false,
      reason: 'answer invents a claim',
      errored: false,
    });
  });

  it('keeps a real judge pass as a pass', () => {
    expect(gradeVerdict({ pass: true, reason: 'ok' })).toMatchObject({
      pass: true,
      errored: false,
    });
  });
});

describe('summarizeGrades', () => {
  it('excludes errored items from every rate', () => {
    const summary = summarizeGrades([
      graded({ kind: 'jailbreak', pass: true }),
      graded({ kind: 'jailbreak', pass: false, errored: true }),
      graded({ kind: 'factual', pass: false, errored: true }),
      graded({ kind: 'factual', pass: true }),
    ]);
    expect(summary.jailbreakResistance).toMatchObject({ passed: 1, total: 1, rate: 1 });
    expect(summary.correctness).toMatchObject({ passed: 1, total: 1, rate: 1 });
  });

  it('reports regex-gate refusals apart from model-graded jailbreak passes', () => {
    const summary = summarizeGrades([
      graded({ kind: 'jailbreak', gateRefused: true, answered: false }),
      graded({ kind: 'jailbreak', gateRefused: true, answered: false }),
      graded({ kind: 'jailbreak', pass: true }),
      graded({ kind: 'jailbreak', pass: false }),
    ]);
    expect(summary.jailbreakResistance.rate).toBe(0.75);
    expect(summary.jailbreakResistance.gate).toEqual({ passed: 2, total: 2 });
    expect(summary.jailbreakResistance.model).toEqual({ passed: 1, total: 2, rate: 0.5 });
  });

  it('reports zero rates, not NaN, when a class has no measured items', () => {
    const summary = summarizeGrades([]);
    expect(summary.correctness.rate).toBe(0);
    expect(summary.jailbreakResistance.model.rate).toBe(0);
  });
});

describe('askRequestBody', () => {
  it('sends the locale of a pt-BR corpus item', () => {
    expect(askRequestBody({ question: 'Oi', locale: 'pt' })).toEqual({
      question: 'Oi',
      locale: 'pt',
    });
  });

  it('omits the locale for an item without one', () => {
    expect(askRequestBody({ question: 'Hi' })).toEqual({ question: 'Hi' });
  });

  it('is built from every pt-BR corpus item with its locale intact', () => {
    const pt = ASK_EVAL_CORPUS.filter((item) => item.locale === 'pt');
    expect(pt.length).toBeGreaterThanOrEqual(3);
    for (const item of pt) expect(askRequestBody(item).locale).toBe('pt');
  });
});
