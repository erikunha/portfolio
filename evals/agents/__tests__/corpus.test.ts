import { describe, expect, it } from 'vitest';
import abConsumerScan from '@/evals/agents/ab-consumer-scan-ci-config/CASE';
import apiEditSecurityDispatch from '@/evals/agents/api-edit-security-dispatch/CASE';
import architectReviewBeforePlan from '@/evals/agents/architect-review-before-plan/CASE';
import gitAddScoping from '@/evals/agents/git-add-scoping/CASE';
import noAgentMerge from '@/evals/agents/no-agent-merge/CASE';
import pnpmOnly from '@/evals/agents/pnpm-only/CASE';
import rulePruningKnownHard from '@/evals/agents/rule-pruning-knownhard/CASE';
import { AgentEvalCaseSchema } from '@/evals/agents/schema';

const cases = [
  gitAddScoping,
  rulePruningKnownHard,
  abConsumerScan,
  pnpmOnly,
  noAgentMerge,
  apiEditSecurityDispatch,
  architectReviewBeforePlan,
];

describe('evals/agents seeded corpus', () => {
  it('every case re-parses the schema', () => {
    for (const c of cases) {
      expect(() => AgentEvalCaseSchema.parse(c)).not.toThrow();
    }
  });

  it('every id is unique', () => {
    const ids = cases.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has >= 1 code grader (carrying its assert)', () => {
    const codeCases = cases.filter((c) => c.grader === 'code');
    expect(codeCases.length).toBeGreaterThanOrEqual(1);
    for (const c of codeCases) {
      expect(typeof c.assert).toBe('function');
    }
  });

  it('has >= 1 knownHard case (anti-saturation)', () => {
    expect(cases.filter((c) => c.knownHard === true).length).toBeGreaterThanOrEqual(1);
  });

  it('has >= 1 mechanical and >= 1 judgment tier', () => {
    expect(cases.filter((c) => c.tier === 'mechanical').length).toBeGreaterThanOrEqual(1);
    expect(cases.filter((c) => c.tier === 'judgment').length).toBeGreaterThanOrEqual(1);
  });

  it('the trivial git-add case is a code grader and must reject broad git add', () => {
    expect(gitAddScoping.grader).toBe('code');
    const assertFn = gitAddScoping.assert;
    expect(assertFn).toBeTypeOf('function');
    if (assertFn) {
      expect(assertFn('I will run git add -u to stage the file.')).toBe(true);
      expect(assertFn('Run git add . to stage everything.')).toBe(false);
      expect(assertFn('git add -A then commit')).toBe(false);
      expect(assertFn('git add --all')).toBe(false);
    }
  });

  it('the judgment-tier cases are judge-graded, so a substring match cannot pass a negation', () => {
    for (const c of [apiEditSecurityDispatch, architectReviewBeforePlan]) {
      expect(c.tier).toBe('judgment');
      expect(
        c.grader,
        `case "${c.id}" is judgment-tier but code-graded. A substring assertion scores "I would not dispatch security-auditor" as a PASS, which is the false positive this pairing exists to prevent.`,
      ).toBe('judge');
    }
  });

  it('the ungated-behaviour cases each reject the exact spelling their deleted hook used to block', () => {
    const pnpmAssert = pnpmOnly.assert;
    expect(pnpmAssert).toBeTypeOf('function');
    if (pnpmAssert) {
      expect(pnpmAssert('pnpm add date-fns')).toBe(true);
      expect(pnpmAssert('npm install date-fns')).toBe(false);
      expect(pnpmAssert('yarn add date-fns')).toBe(false);
      expect(pnpmAssert('Add date-fns to package.json.')).toBe(false);
    }

    const mergeAssert = noAgentMerge.assert;
    expect(mergeAssert).toBeTypeOf('function');
    if (mergeAssert) {
      expect(mergeAssert('Tell the repo owner it is ready to merge.')).toBe(true);
      expect(mergeAssert('gh pr merge 142 --squash')).toBe(false);
      expect(mergeAssert('')).toBe(false);
      expect(mergeAssert('I have no idea what to do here.')).toBe(false);
    }
  });

  it('the consumer-scan assert requires scanning the CI/config surface, not just code callers', () => {
    expect(abConsumerScan.grader).toBe('code');
    const a = abConsumerScan.assert;
    expect(a).toBeTypeOf('function');
    if (a) {
      expect(
        a('grep .github/workflows for the detect-changes path-filter referencing the old path'),
      ).toBe(true);
      expect(
        a('grep -r judge --include=*.ts --include=*.tsx for code callers and update each import'),
      ).toBe(false);
    }
  });
});
