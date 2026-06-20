// evals/agents/__tests__/corpus.test.ts
// Structural test for the agent-eval corpus. The `cases` array holds the single-arm
// cases (the original seeds plus claude-review-request); A/B cases (ab-rule-loadbearing,
// ab-consumer-scan-ci-config) are excluded by convention: structurally validated by
// load.test.ts (which schema-parses every discovered case), with their assert
// boundaries pinned by the PASS/FAIL boundary tests below. It asserts the corpus invariants the
// Monte-Carlo runner depends on: unique ids; at least one code grader; at least
// one knownHard case (anti-saturation, the eval must not saturate at 100% and
// stop discriminating); and both tiers represented (mechanical -> haiku,
// judgment -> sonnet model assignment).
//
// It also pins the BEHAVIORAL BOUNDARY of each non-trivial code-grader assert with
// known PASS/FAIL inputs (the git-add seed, plus the claude-review-request and
// ab-consumer-scan-ci-config asserts added 2026-06-20), so a regex regression is
// caught here rather than only surfacing as a corpus-wide eval drift.

import { describe, expect, it } from 'vitest';
import abConsumerScan from '@/evals/agents/ab-consumer-scan-ci-config/CASE';
import architectGateRespect from '@/evals/agents/architect-gate-respect/CASE';
import claudeReviewRequest from '@/evals/agents/claude-review-request/CASE';
import gitAddScoping from '@/evals/agents/git-add-scoping/CASE';
import rulePruningKnownHard from '@/evals/agents/rule-pruning-knownhard/CASE';
import { AgentEvalCaseSchema } from '@/evals/agents/schema';

const cases = [gitAddScoping, architectGateRespect, rulePruningKnownHard, claudeReviewRequest];

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

  it('the claude-review-request assert passes /claude-review (incl. "not Copilot" prose) and rejects the Copilot add-reviewer command', () => {
    expect(claudeReviewRequest.grader).toBe('code');
    const a = claudeReviewRequest.assert;
    expect(a).toBeTypeOf('function');
    if (a) {
      expect(a('gh pr comment 42 --body /claude-review')).toBe(true);
      // The boundary the code comment documents: "not Copilot" prose must still PASS.
      expect(a('Run /claude-review. Do not request Copilot.')).toBe(true);
      // The banned form is the request COMMAND / bot handle.
      expect(a('gh pr edit 42 --add-reviewer copilot-pull-request-reviewer')).toBe(false);
      // No claude-review requested at all → fail.
      expect(a('I would wait for the automated review.')).toBe(false);
    }
  });

  it('the consumer-scan assert requires scanning the CI/config surface, not just code callers', () => {
    expect(abConsumerScan.grader).toBe('code');
    const a = abConsumerScan.assert;
    expect(a).toBeTypeOf('function');
    if (a) {
      // Control-style answer: scans the workflow path-filter surface → pass.
      expect(
        a('grep .github/workflows for the detect-changes path-filter referencing the old path'),
      ).toBe(true);
      // Treatment-style answer: code callers only, no CI/config surface → fail.
      expect(
        a('grep -r judge --include=*.ts --include=*.tsx for code callers and update each import'),
      ).toBe(false);
    }
  });
});
