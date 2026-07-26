import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CLAUDE_LOGIN, parseClaudeVerdict } from '@/scripts/check-claude-approval';

const WORKFLOW = join(process.cwd(), '.github', 'workflows', 'claude-review.yml');

const source = () => readFileSync(WORKFLOW, 'utf8');

const GUARD_LINE = /grep -qiE '([^']+)'/;
const JQ_ARG = /--jq "((?:[^"\\]|\\.)*)"/;
const EMPTY_SINCE_BLOCK = /if \[ -z "\$\{SINCE:-\}" \]; then([\s\S]*?)\n\s*fi/;
const SKIP_BLOCK = /if \[ "\$GITHUB_EVENT_NAME" = "pull_request" \]([\s\S]*?)\n\s*fi/;

function extract(pattern: RegExp, what: string): string {
  const hit = pattern.exec(source())?.[1];
  if (!hit) {
    throw new Error(
      `claude-review.yml no longer contains ${what}. That guard is the only thing standing between "the action exited 0" and "a review actually happened": the pull_request path posted a track_progress checklist with no verdict on every auto-run and the check still read green. If it moved, point this test at its new home; do not delete it.`,
    );
  }
  return hit;
}

const guardMatches = (body: string): boolean => {
  const pattern = new RegExp(extract(GUARD_LINE, "a `grep -qiE '…'` verdict guard"), 'i');
  return body.split('\n').some((line) => pattern.test(line));
};

const PARSER_SEES_VERDICT: ReadonlyArray<readonly [string, boolean]> = [
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

describe('the verdict guard is never looser than the gate it protects', () => {
  it.each(PARSER_SEES_VERDICT)('%j — a guard match implies the gate sees a verdict', (body) => {
    if (!guardMatches(body)) return;
    expect(
      parseClaudeVerdict(body),
      `The workflow guard matched this body but scripts/check-claude-approval.ts does not read a verdict from it.\n\nThat is the fail-open direction and the only one that matters: the job goes green having "seen a verdict" while the merge gate reads none, which is the silent-green failure the guard exists to end. The reverse (guard narrower than parser) is a false red — noisy, not dangerous.\n\nThe verdict word must sit inside ** ** for the parser to see it, so the guard carries that requirement too.\n\nbody: ${JSON.stringify(body)}`,
    ).not.toBe('none');
  });

  it.each(PARSER_SEES_VERDICT.filter(([body]) => !body.includes('\n')))(
    '%j — on a single-line body the two agree exactly',
    (body, expected) => {
      expect({ guard: guardMatches(body), parser: parseClaudeVerdict(body) !== 'none' }).toEqual({
        guard: expected,
        parser: expected,
      });
    },
  );

  it('is narrower across a newline, because grep is line-oriented and the parser is not', () => {
    const wrapped = '**Approve\nwith minor changes**';
    expect(
      { guard: guardMatches(wrapped), parser: parseClaudeVerdict(wrapped) },
      'This case exists to force the two models apart. JS `[^*]` matches a newline so the parser reads a verdict here; grep never matches across one so the guard does not. Modelling the guard with a whole-string RegExp hides that and overstates what the guard accepts. The divergence is fail-CLOSED — a review the merge gate would approve reds the job — so it is acceptable, but it must stay visible rather than be discovered live.',
    ).toEqual({ guard: false, parser: 'approve' });
  });
});

describe('the guard does not fail open in the ways a naive version would', () => {
  it('passes the jq filter as one argument, not with gh-unsupported --arg', () => {
    expect(
      source().includes('--jq --arg'),
      '`gh api` has no --arg flag. --jq consumes the NEXT TOKEN as its filter, so `--jq --arg since "$X" \'<filter>\'` makes the filter the literal string "--arg" and hands gh stray positionals. Verified 2026-07-26: that form exits 1 where the same call without it exits 0. Under `set -e` the assignment dies and the step fails on EVERY run, including one whose review posted a perfect verdict.',
    ).toBe(false);
  });

  it('composes the author and freshness predicates with and, inside the live jq filter', () => {
    expect(
      extract(JQ_ARG, 'a `--jq "…"` filter argument'),
      `The guard's jq select must be exactly this composed expression, and it is asserted against the EXTRACTED --jq argument rather than the whole file.\n\nTwo failures this shape prevents. Asserting the conjuncts separately does not hold the property: rewriting \`and\` to \`or\` leaves both substrings present and both assertions green while the freshness filter stops filtering, so a push whose review posts nothing passes on the previous head's verdict. And asserting over the whole file lets a predicate survive in a dead comment while the live filter loses it — this workflow already carries a long prose block naming created_at and parseClaudeVerdict.\n\nThe timestamp must stay INLINED: an earlier version paired \`.created_at >= $since\` with \`gh api --jq --arg since\`, which gh cannot parse, so pinning that spelling pinned the broken form.`,
    ).toContain(`select(.user.login == \\"${CLAUDE_LOGIN}\\" and .created_at >= \\"$SINCE\\")`);
  });

  it('refuses, rather than degrades, when the review-start timestamp is missing', () => {
    expect(
      // biome-ignore lint/suspicious/noTemplateCurlyInString: POSIX parameter expansion quoted from the shell under test, not a JS placeholder; the rule cannot tell them apart, and the exact syntax is what makes this message findable in the workflow.
      extract(EMPTY_SINCE_BLOCK, 'an `if [ -z "${SINCE:-}" ]` guard'),
      'The empty-SINCE block must exit non-zero. Pinning only its message is not pinning the property: flipping `exit 1` to `exit 0` leaves every string intact while execution falls through to an unscoped filter — jq compares strings, so `.created_at >= ""` is true for every comment and a previous run\'s verdict silently passes. The exit code IS the behaviour.',
    ).toContain('exit 1');
  });

  it('skips only the pull_request path it cannot review, never the comment path', () => {
    const block = extract(SKIP_BLOCK, 'a workflow-editing skip keyed on $GITHUB_EVENT_NAME');
    expect(
      block,
      "The skip must stay scoped to pull_request and must exit 0. Dropping the event conjunct makes it fire on issue_comment too, silently disabling the guard on the /claude-review path — the one path that CAN post a verdict on a workflow-editing PR, and the one this step's own FAIL message recommends as the workaround.",
    ).toContain('exit 0');
    expect(block).toContain('claude-review.yml');
  });
});
