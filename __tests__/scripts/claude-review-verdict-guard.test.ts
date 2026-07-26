import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseClaudeVerdict } from '@/scripts/check-claude-approval';

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
    const guardSaysVerdict = guard.test(body);
    const parserSaysVerdict = parseClaudeVerdict(body) !== 'none';
    expect(
      { guard: guardSaysVerdict, parser: parserSaysVerdict },
      `The workflow guard and scripts/check-claude-approval.ts disagree about whether this body carries a verdict.\n\nA guard LOOSER than the parser is the dangerous direction: the job goes green having "seen a verdict" while the merge gate reads none, which is the silent-green failure the guard exists to end. A guard STRICTER reds a healthy review.\n\nThe verdict word must sit inside ** ** for the parser to see it, so the guard carries that same requirement. Change both together or neither.\n\nbody: ${JSON.stringify(body)}`,
    ).toEqual({ guard: expected, parser: expected });
  });

  it('scopes to comments from this run, so a stale verdict cannot satisfy it', () => {
    const source = readFileSync(WORKFLOW, 'utf8');
    expect(
      source.includes('.created_at >= $since'),
      "The guard must filter comments by created_at against a timestamp taken before the action runs. Without it, a push whose review posts nothing passes on the PREVIOUS head's verdict comment — the same stale-approval class check-claude-approval.ts already guards with its head-SHA check.",
    ).toBe(true);
  });
});
