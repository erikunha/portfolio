import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { CLAUDE_LOGIN, parseClaudeVerdict } from '@/scripts/check-claude-approval';

const WORKFLOW = join(process.cwd(), '.github', 'workflows', 'claude-review.yml');

const GUARD_STEP = 'Assert this run posted a verdict the merge gate can read';

type Step = { name?: string; run?: string; 'continue-on-error'?: unknown };

function guardStep(): Step {
  const doc = parse(readFileSync(WORKFLOW, 'utf8')) as {
    jobs?: { review?: { steps?: Step[] } };
  };
  const step = doc.jobs?.review?.steps?.find((s) => s.name === GUARD_STEP);
  if (typeof step?.run !== 'string') {
    throw new Error(
      `claude-review.yml has no step named "${GUARD_STEP}" carrying a run: script. That step is the only thing standing between "the action exited 0" and "a review actually happened": the pull_request path posted a track_progress checklist with no verdict on every auto-run and the check still read green. If it was renamed, rename GUARD_STEP with it; do not delete this test.`,
    );
  }
  return step;
}

const guardScript = (): string => guardStep().run as string;

function block(open: RegExp, what: string): string {
  const script = guardScript();
  const hit = open.exec(script);
  if (!hit) throw new Error(`The guard script no longer contains ${what}.`);
  const rest = script.slice(hit.index);
  const end = rest.search(/\n\s*fi\b/);
  return end === -1 ? rest : rest.slice(0, end);
}

const FETCH = /(\w+)=\$\(gh api[\s\S]*?--jq "((?:[^"\\]|\\.)*)"\s*\)/;
const GREP = /\n\s*if printf '%s' "\$(\w+)"\s*\|\s*grep -qiE '([^']+)'; then/;

describe('the guard fetches, filters and tests the same thing the merge gate reads', () => {
  it('greps the output of the filtered fetch, not some other fetch', () => {
    const fetch = FETCH.exec(guardScript());
    const grep = GREP.exec(guardScript());
    expect(fetch, 'no `<var>=$(gh api … --jq "…")` assignment in the guard').toBeTruthy();
    expect(grep, 'no `printf | grep -qiE` verdict test in the guard').toBeTruthy();
    expect(
      grep?.[1],
      `The verdict grep must read the variable the FILTERED fetch assigns. Nothing previously tied them, and substituting an unfiltered \`gh api … --jq '.[].body'\` ran green — which returns both failures at once: a stale prior-run verdict and a bolded "approve" from any author each satisfy the guard while the merge gate reads none.\n\nfetch assigns: ${fetch?.[1]}\ngrep reads:    ${grep?.[1]}`,
    ).toBe(fetch?.[1]);
  });

  it('selects the same comment the gate parses: latest claude[bot], this run only', () => {
    const filter = FETCH.exec(guardScript())?.[2] ?? '';
    expect(
      filter,
      `The jq filter must restrict to ${CLAUDE_LOGIN} (imported from the gate, not mirrored), scope to this run via created_at, and take LAST.\n\nThe author and freshness predicates must be ONE composed expression: asserted separately, rewriting \`and\` to \`or\` leaves both substrings present and both assertions green while the freshness filter stops filtering.\n\n\`last\` matters because check-claude-approval.ts reads only claudeComments.at(-1). Reading the union goes green on a verdict in an older fresh comment while the gate, reading a newer progress comment, sees none — the same silent green one level up.`,
    ).toContain(`select(.user.login == \\"${CLAUDE_LOGIN}\\" and .created_at >= \\"$SINCE\\")`);
    expect(filter).toContain('sort_by(.created_at)');
    expect(filter).toContain('last');
    expect(
      /gh api[^\n]*--paginate --slurp/.test(guardScript()),
      'The fetch must pass --slurp. gh applies --jq PER PAGE under --paginate, so without it `last` yields one body per page and the grep sees their union — reintroducing the exact failure `last` was added to remove, invisibly, and only once a PR passes 30 comments. scripts/inspect-pr-comments.mjs already carries this workaround; the filter must also flatten with .[][] and sort explicitly rather than trusting API order, because the gate sorts.',
    ).toBe(true);
    expect(filter).toContain('.[][]');
  });
});

const SINGLE_LINE_BODIES: ReadonlyArray<readonly [string, boolean]> = [
  ['**Approve**', true],
  ['Reviewed head `a97ed15`. Verdict: **Approve**', true],
  ['**Approve with minor changes**', true],
  ['**Request changes**', true],
  ['**Reject**', true],
  ['Approve', false],
  ['I approve of this approach, ship it', false],
  ['**Summary** of the change', false],
  ['', false],
];

const guardMatches = (body: string): boolean => {
  const pattern = new RegExp(GREP.exec(guardScript())?.[2] ?? '(?!)', 'i');
  return body.split('\n').some((line) => pattern.test(line));
};

describe('the guard verdict pattern is never looser than the gate it protects', () => {
  it('keeps a non-empty agreement corpus, since it.each([]) registers nothing and still reports PASS', () => {
    expect(
      SINGLE_LINE_BODIES.length,
      "Emptying this table removes every guard-vs-parser agreement case with no red: vitest reports PASS over zero registered tests. The file's central claim would then rest on two hand-written cases while the suite still read green.",
    ).toBeGreaterThan(5);
  });

  it.each(SINGLE_LINE_BODIES)('%j — on one line the two agree exactly', (body, expected) => {
    expect({ guard: guardMatches(body), parser: parseClaudeVerdict(body) !== 'none' }).toEqual({
      guard: expected,
      parser: expected,
    });
  });

  it('never matches the track_progress checklist the gate reads as no verdict', () => {
    const checklist = '### Review\n- [x] Gather context\n- [x] Check schema compatibility';
    expect(
      { guard: guardMatches(checklist), parser: parseClaudeVerdict(checklist) },
      'That body is exactly what the pull_request path posted on every auto-run while the check read green and the merge gate read none. If the guard ever accepts it, the guard has become the bug it was written to catch.',
    ).toEqual({ guard: false, parser: 'none' });
  });

  it('is narrower across a newline, because grep is line-oriented and the parser is not', () => {
    const wrapped = '**Approve\nwith minor changes**';
    expect(
      { guard: guardMatches(wrapped), parser: parseClaudeVerdict(wrapped) },
      'This case forces the two models apart. JS `[^*]` matches a newline so the parser reads a verdict; grep never matches across one so the guard does not. The divergence is fail-CLOSED — a review the gate would approve reds the job — acceptable, but it must stay visible rather than be met live.',
    ).toEqual({ guard: false, parser: 'approve' });
  });
});

describe('the guard reds the job, and skips only what it provably cannot review', () => {
  it.each([
    ['a body the gate reads as no verdict', '### Review\n- [x] Gather context', 1],
    ['a body carrying a verdict', 'Reviewed head `abc1234`. **Approve**', 0],
  ])('runs under bash and exits %s -> %d', (_label, body, expected) => {
    const script = guardScript();
    const fragment = script.slice(script.search(GREP));
    let status = 0;
    try {
      execFileSync('bash', ['-euo', 'pipefail', '-c', `fresh=$1\n${fragment}`, '_', body], {
        stdio: 'pipe',
      });
    } catch (error) {
      status = (error as { status?: number }).status ?? -1;
    }
    expect(
      status,
      `The verdict branch is EXECUTED here rather than pattern-matched. Every structural assertion in this file has been bypassed at a coordinate it did not pin: a single \`!\` inverted the test with all sixteen green, and an unconditional \`exit 0\` inserted between the grep's fi and the FAIL branch left the guard incapable of failing while a trailing-position check still passed. Running it answers the only question that matters — given this body, does the script exit non-zero?\n\nbody: ${JSON.stringify(body)}`,
    ).toBe(expected);
  });

  it('carries no || true and no continue-on-error, either of which unblocks the exit', () => {
    expect(
      /\|\|\s*true/.test(guardScript()),
      'A `|| true` in the guard stops the grep failing the step, so the terminal exit becomes unreachable.',
    ).toBe(false);
    expect(
      guardStep()['continue-on-error'] ?? false,
      'continue-on-error makes the step exit non-blocking, so the job goes green over a run that posted no verdict while every assertion here — including the executed one above, which measures the script in isolation and cannot see the step wrapper — still passes.',
    ).toBe(false);
  });

  it('refuses, rather than degrades, when the review-start timestamp is missing', () => {
    expect(
      block(/if \[ -z "\$\{SINCE:-\}" \]/, 'an empty-timestamp refusal'),
      'The empty-SINCE block must exit non-zero. jq compares strings, so `.created_at >= ""` is true for every comment: falling through silently removes the run-scoping and a previous run\'s verdict passes. The exit code IS the behaviour.',
    ).toContain('exit 1');
  });

  it('skips on BOTH the event and the file predicate, never on the echo alone', () => {
    const skip = block(
      /if \[ "\$GITHUB_EVENT_NAME" = "pull_request" \]/,
      'a workflow-editing skip',
    );
    expect(
      skip,
      'The skip must test the DIFF, not just the event. Asserting the string "claude-review.yml" was satisfied by the echo INSIDE the block, so deleting the whole `gh pr diff … | grep -qx …` conjunct ran green — the guard would then skip every pull_request run unconditionally while CI stayed green, which is the permanent silent green this workflow already paid for once.',
    ).toContain("grep -qx '.github/workflows/claude-review.yml'");
    expect(skip).toContain('exit 0');
  });
});
