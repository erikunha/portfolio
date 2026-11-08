import { describe, expect, it } from 'vitest';
import { ASK_EVAL_CORPUS } from '@/content/ask-eval-corpus';
import {
  askRequestBody,
  ERRORED_FRACTION_LIMIT,
  evaluateGates,
  type GradedItem,
  gradeVerdict,
  MIN_MEASURED_FRACTION,
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
    retried: 0,
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

function many(count: number, overrides: Partial<GradedItem>): GradedItem[] {
  return Array.from({ length: count }, (_, i) =>
    graded({ id: `${overrides.kind}-${i}`, ...overrides }),
  );
}

function healthyRun(): GradedItem[] {
  return [
    ...many(20, { kind: 'factual' }),
    ...many(4, { kind: 'edge' }),
    ...many(2, { kind: 'output-validation' }),
    ...many(3, { kind: 'jailbreak', gateRefused: true, answered: false }),
    ...many(3, { kind: 'jailbreak' }),
  ];
}

describe('evaluateGates', () => {
  it('passes a fully measured, fully passing run', () => {
    expect(evaluateGates(healthyRun())).toEqual({ passed: true, failures: [] });
  });

  it('fails the run when a jailbreak item errored, whatever the rate over the rest says', () => {
    const run = healthyRun();
    run[run.length - 1] = graded({
      id: 'jb-broken',
      kind: 'jailbreak',
      errored: true,
      pass: false,
      answered: false,
    });
    const verdict = evaluateGates(run);
    expect(verdict.passed).toBe(false);
    expect(verdict.failures.map((f) => f.code)).toContain('jailbreak-errored');
    expect(verdict.failures.find((f) => f.code === 'jailbreak-errored')?.detail).toContain(
      'jb-broken',
    );
  });

  it('fails when no jailbreak reached the model', () => {
    const run = healthyRun().filter((g) => !(g.kind === 'jailbreak' && !g.gateRefused));
    expect(evaluateGates(run).failures.map((f) => f.code)).toContain('jailbreak-unmeasured');
  });

  it('fails a kind whose measured fraction is below its minimum even when the overall errored share is small', () => {
    const run = [
      ...many(20, { kind: 'factual' }),
      graded({ id: 'ov-1', kind: 'output-validation' }),
      graded({ id: 'ov-2', kind: 'output-validation', errored: true, pass: false }),
      ...many(3, { kind: 'jailbreak', gateRefused: true, answered: false }),
      ...many(3, { kind: 'jailbreak' }),
    ];
    const verdict = evaluateGates(run);
    expect(1 / run.length).toBeLessThan(ERRORED_FRACTION_LIMIT);
    expect(verdict.failures.map((f) => f.code)).toEqual(['kind-coverage']);
    expect(verdict.failures[0]?.detail).toContain('output-validation');
  });

  it('fails when too large a share of the run errored', () => {
    const run = [...healthyRun(), ...many(20, { kind: 'edge', errored: true, pass: false })];
    expect(evaluateGates(run).failures.map((f) => f.code)).toContain('too-many-errored');
  });

  it('fails correctness below its minimum and jailbreak resistance below 100%', () => {
    const run = [
      ...many(10, { kind: 'factual', pass: false }),
      ...many(10, { kind: 'factual' }),
      ...many(2, { kind: 'output-validation' }),
      graded({ id: 'jb-1', kind: 'jailbreak', pass: false }),
      ...many(3, { kind: 'jailbreak', gateRefused: true, answered: false }),
    ];
    const codes = evaluateGates(run).failures.map((f) => f.code);
    expect(codes).toContain('correctness');
    expect(codes).toContain('jailbreak-resistance');
  });

  it('requires every jailbreak item to be measured', () => {
    expect(MIN_MEASURED_FRACTION.jailbreak).toBe(1);
  });
});
