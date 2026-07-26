import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CLAUDE_LOGIN, parseClaudeVerdict } from '@/scripts/check-claude-approval';

const WORKFLOW = join(process.cwd(), '.github', 'workflows', 'claude-review.yml');

const GUARD_LINE = /grep -qiE '([^']+)'/;

function guardPattern(): RegExp {
  const source = readFileSync(WORKFLOW, 'utf8');
  const raw = GUARD_LINE.exec(source)?.[1];
  if (!raw) {
    throw new Error(
      'claude-review.yml no longer contains a `grep -qiE \'…\'` verdict guard. That step is the only thing standing between "the action exited 0" and "a review actually happened" — the pull_request path posted a track_progress checklist with no verdict on every auto-run and the check still read green. If the guard moved, point this test at its new home; do not delete it.',
    );
  }
  return new RegExp(raw.replace(/\\\\/g, '\\'), 'i');
}

const CASES: ReadonlyArray<readonly [string, boolean]> = [
  ['**Approve**', true],
  ['Reviewed head `a97ed15`. Verdict: **Approve**', true],
  ['**Approve with minor changes**', true],
  ['**Request changes**', true],
  ['**Reject**', true],
  ['Approve', false],
  ['I approve of this approach, ship it', false],
  ['### Review\n- [x] Gather context\n- [x] Check schema compatibility', false],
  ['**Summary** of the change', false],
  ['', false],
];

describe('the workflow verdict guard agrees with the gate it protects', () => {
  const guard = guardPattern();

  it.each(CASES)('%j — guard and parseClaudeVerdict reach the same answer', (body, expected) => {
    const guardSaysVerdict = body.split('\n').some((line) => guard.test(line));
    const parserSaysVerdict = parseClaudeVerdict(body) !== 'none';
    expect(
      { guard: guardSaysVerdict, parser: parserSaysVerdict },
      `The workflow guard and scripts/check-claude-approval.ts disagree about whether this body carries a verdict.\n\nA guard LOOSER than the parser is the dangerous direction: the job goes green having "seen a verdict" while the merge gate reads none, which is the silent-green failure the guard exists to end. A guard STRICTER reds a healthy review.\n\nThe verdict word must sit inside ** ** for the parser to see it, so the guard carries that same requirement. Change both together or neither.\n\nbody: ${JSON.stringify(body)}`,
    ).toEqual({ guard: expected, parser: expected });
  });

  it('scopes to comments from this run, so a stale verdict cannot satisfy it', () => {
    const source = readFileSync(WORKFLOW, 'utf8');
    expect(
      source.includes('.created_at >= \\"$SINCE\\"'),
      'The guard must filter comments by created_at against a timestamp taken before the action runs. Without it, a push whose review posts nothing passes on the PREVIOUS head\'s verdict comment — the same stale-approval class check-claude-approval.ts guards with its head-SHA check.\n\nThe timestamp must be INLINED into the filter. An earlier version wrote `.created_at >= $since` with `gh api --jq --arg since`, and `gh api` has no --arg flag: --jq consumed "--arg" as the filter, gh got four positionals, and the step died before fetching anything. This assertion deliberately pins the inlined form, because pinning the $since form pins the broken one.',
    ).toBe(true);
  });
});

describe('the guard does not fail open in the ways a naive version would', () => {
  const workflow = () => readFileSync(WORKFLOW, 'utf8');

  it('passes the jq filter as a single argument, not with gh-unsupported --arg', () => {
    expect(
      workflow().includes('--jq --arg'),
      '`gh api` has no --arg flag. --jq consumes the NEXT TOKEN as its filter, so `--jq --arg since "$X" \'<filter>\'` makes the filter the literal string "--arg" and hands gh three stray positional args. Verified 2026-07-26: that form exits 1 while the same call without --arg exits 0. Under `set -e` the assignment dies and the step fails on EVERY run, including one whose review posted a perfect verdict.',
    ).toBe(false);
  });

  it('counts only comments authored by the login the merge gate reads', () => {
    expect(
      workflow().includes(`.user.login == \\"${CLAUDE_LOGIN}\\"`),
      `The guard must restrict to ${CLAUDE_LOGIN}, which is imported from check-claude-approval.ts rather than mirrored, because that module filters on it before parsing. Without the author predicate, any human timeline comment containing a bolded "approve" satisfies the guard while the merge gate still reads none — a guard looser than the gate it protects, which is the precise failure it was written to prevent.`,
    ).toBe(true);
  });

  it('fails closed when the review-start timestamp is missing', () => {
    expect(
      workflow().includes('no review-start timestamp'),
      'jq compares strings, so `.created_at >= ""` is true for every comment. If the timestamp step is skipped or renamed, an empty SINCE silently removes the run-scoping and a previous run\'s verdict passes. The guard must refuse before querying rather than degrade to accepting anything.',
    ).toBe(true);
  });

  it('skips itself on PRs that edit this workflow, which the action cannot review', () => {
    expect(
      workflow().includes('this PR edits claude-review.yml'),
      'The action refuses to run when the workflow differs from the default branch, so the auto path cannot post a verdict on a workflow-editing PR no matter what that PR does. Asserting one produces a red that no amount of fixing can clear, which trains override — the false-positive budget CLAUDE.md sets. The guard must detect that case and skip with an explanation.',
    ).toBe(true);
  });
});
