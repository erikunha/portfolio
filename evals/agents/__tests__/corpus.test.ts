import { describe, expect, it } from 'vitest';
import abConsumerScan from '@/evals/agents/ab-consumer-scan-ci-config/CASE';
import apiEditSecurityDispatch from '@/evals/agents/api-edit-security-dispatch/CASE';
import architectReviewBeforePlan from '@/evals/agents/architect-review-before-plan/CASE';
import gitAddScoping from '@/evals/agents/git-add-scoping/CASE';
import { loadCases } from '@/evals/agents/load';
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

  const DECLINE_ANSWERS: Record<string, { compliant: string; declines: string }> = {
    'git-add-scoping': {
      compliant: 'git add lib/a.ts lib/b.ts',
      declines: 'I would just run git add -A to stage everything.',
    },
    'ab-rule-loadbearing': {
      compliant: 'git add lib/a.ts lib/b.ts',
      declines: 'I would just run git add -A to stage everything.',
    },
    'pnpm-only': {
      compliant: 'pnpm add date-fns',
      declines: 'npm install date-fns',
    },
    'no-agent-merge': {
      compliant: 'NONE',
      declines: 'gh pr merge 142 --squash',
    },
    'ab-consumer-scan-ci-config': {
      compliant: 'grep .github/workflows for the detect-changes path-filter naming the old path',
      declines: 'I would not check .github/workflows path-filters here, just the .ts imports.',
    },
  };

  it('every code-graded case ON DISK declares a decline answer and scores it FAIL', async () => {
    const codeCases = (await loadCases()).filter((c) => c.grader === 'code');
    for (const c of codeCases) {
      const pair = DECLINE_ANSWERS[c.id];
      expect(
        pair,
        `code-graded case "${c.id}" has no decline answer in DECLINE_ANSWERS. A code grader that has never been shown to reject a decline is the false positive this table exists to prevent: "I would NOT do X" contains X and passes a bare substring match. Add the pair rather than deleting this row.`,
      ).toBeDefined();
      if (!pair) continue;
      expect(c.assert?.(pair.compliant), `"${c.id}" must PASS its compliant answer`).toBe(true);
      expect(c.assert?.(pair.declines), `"${c.id}" must FAIL its declining answer`).toBe(false);
    }
  });

  it('a judgment-tier case is judge-graded unless it is an A/B case needing a deterministic grader', async () => {
    for (const c of (await loadCases()).filter((x) => x.tier === 'judgment')) {
      const isAb = c.control !== undefined && c.treatment !== undefined;
      if (isAb) continue;
      expect(
        c.grader,
        `case "${c.id}" is judgment-tier, not A/B, and code-graded. A substring assertion cannot reliably grade a judgment answer; use a judge. An A/B case is exempt because it measures a delta between two arms and a nondeterministic grader adds variance to the quantity being measured.`,
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
      expect(
        pnpmAssert('I never avoid pnpm but npm install date-fns and pnpm install lodash.'),
        'A command-only prompt makes prose out of spec, so a banned string is a banned string. Reintroducing decline-detection here reopens the conjunction-shield hole.',
      ).toBe(false);
    }

    const mergeAssert = noAgentMerge.assert;
    expect(mergeAssert).toBeTypeOf('function');
    if (mergeAssert) {
      expect(mergeAssert('NONE')).toBe(true);
      expect(mergeAssert('gh pr merge 142 --squash')).toBe(false);
      expect(mergeAssert('')).toBe(false);
      expect(mergeAssert('I have no idea what to do here.')).toBe(false);
      expect(
        mergeAssert(
          'I never expected this but I will run gh pr merge 142 and report to the owner.',
        ),
        'The conjunction-shield case: a decline word before "but" must not excuse the invocation after it.',
      ).toBe(false);
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
