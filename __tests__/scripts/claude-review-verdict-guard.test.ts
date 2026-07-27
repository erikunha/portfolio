import { execFileSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { CLAUDE_LOGIN, parseClaudeVerdict } from '@/scripts/check-claude-approval';

const WORKFLOW = join(process.cwd(), '.github', 'workflows', 'claude-review.yml');

const GUARD_STEP = 'Assert this run posted a verdict the merge gate can read';

type Step = { name?: string; run?: string; if?: unknown; 'continue-on-error'?: unknown };

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

// Matches the fetch PIPED INTO jq, not gh's --jq. gh refuses `--slurp` with
// `--jq` and prints usage, so the old shape could never have run; this regex
// failing is the signal that someone reintroduced it.
const FETCH = /(\w+)=\$\(gh api[\s\S]*?\|\s*jq -r "((?:[^"\\]|\\.)*)"\s*\)/;
const GREP = /\n\s*if printf '%s' "\$(\w+)"\s*\|\s*grep -qiE '([^']+)'; then/;

describe('the guard fetches, filters and tests the same thing the merge gate reads', () => {
  it('no gh api fetch in this workflow passes a filter flag alongside --slurp', () => {
    // gh refuses --slurp with --jq, -q, or --template. The stub encodes that, but
    // only for the step it executes; this reads the WHOLE file, because the same
    // invalid invocation shipped twice — once in the guard and once in the
    // cancelled-run supersede step, which no test selects.
    // Backslash-continuations are joined FIRST. Without that the scan sees only
    // the first physical line of each fetch, and a `--jq` on the continuation
    // line is invisible — which is exactly how the supersede step's copy of this
    // bug survived the first version of this assertion.
    const yml = readFileSync(WORKFLOW, 'utf8').replace(/\\\n\s*/g, ' ');
    const fetches = yml.match(/gh api[^\n]*/g) ?? [];
    expect(fetches.length).toBeGreaterThan(0);
    for (const f of fetches) {
      if (!f.includes('--slurp')) continue;
      expect(
        /--jq|(?:^|\s)-q(?:\s|$)|--template/.test(f),
        `A gh api call combines --slurp with a filter flag. gh refuses that, writes to stderr and exits 1, so under set -euo pipefail the step dies at the assignment. Pipe into a real jq instead.\n\n${f}`,
      ).toBe(false);
    }
  });

  it('greps the output of the filtered fetch, not some other fetch', () => {
    const fetch = FETCH.exec(guardScript());
    const grep = GREP.exec(guardScript());
    expect(fetch, 'no `<var>=$(gh api … | jq -r "…")` assignment in the guard').toBeTruthy();
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
  type Run = {
    body: string;
    since?: string;
    event?: string;
    changed?: string;
  };

  function runGuard({
    body,
    since = '2026-01-01T00:00:00Z',
    event = 'pull_request',
    changed = 'README.md',
  }: Run) {
    const bin = mkdtempSync(join(tmpdir(), 'guard-gh-'));
    writeFileSync(
      join(bin, 'gh'),
      // The stub REJECTS `--slurp` together with ANY filter flag, which is gh's
      // real predicate: --jq, its shorthand -q, and --template all trip it
      // ("the --slurp option is not supported with --jq or --template"). Without
      // this the stub answers any argument list, so the guard's fetch could be
      // malformed and every row still passed — which is how a broken `gh api`
      // shipped and red every unskipped run. A stub that accepts what the real
      // binary refuses pins its own behaviour, not the command under test.
      [
        '#!/usr/bin/env bash',
        'if [ "$1" = "api" ]; then',
        '  args="$*"',
        '  case "$args" in',
        '    *--slurp*--jq*|*--jq*--slurp*|*--slurp*-q\\ *|*-q\\ *--slurp*|*--slurp*--template*|*--template*--slurp*)',
        '      echo "the \\`--slurp\\` option is not supported with \\`--jq\\` or \\`--template\\`" >&2',
        '      exit 1',
        '      ;;',
        '  esac',
        '  printf \'%s\' "$GUARD_STUB_PAGES"',
        'else',
        '  printf \'%s\\n\' "$GUARD_STUB_CHANGED"',
        'fi',
        '',
      ].join('\n'),
    );
    chmodSync(join(bin, 'gh'), 0o755);
    try {
      execFileSync('bash', ['-c', guardScript()], {
        stdio: 'pipe',
        env: {
          ...process.env,
          PATH: `${bin}:${process.env.PATH ?? ''}`,
          PR: '227',
          REPO: 'o/r',
          SINCE: since,
          GITHUB_EVENT_NAME: event,
          // gh --paginate --slurp emits an array of pages; the guard pipes that
          // into jq, so the stub must speak the same shape the real API does
          // rather than a bare markdown body.
          GUARD_STUB_PAGES: JSON.stringify([
            [{ user: { login: 'claude[bot]' }, created_at: '2030-01-01T00:00:00Z', body }],
          ]),
          GUARD_STUB_CHANGED: changed,
          VERDICT_RETRY_SLEEP: '0',
        },
      });
      return { status: 0, stderr: '' };
    } catch (error) {
      const e = error as { status?: number; stderr?: Buffer };
      return { status: e.status ?? -1, stderr: e.stderr?.toString() ?? '' };
    } finally {
      rmSync(bin, { recursive: true, force: true });
    }
  }

  const EXECUTED_CASES: ReadonlyArray<readonly [string, Run, number]> = [
    ['no verdict in the fetched body', { body: '### Review\n- [x] Gather context' }, 1],
    ['a verdict in the fetched body', { body: 'head `abc1234`. **Approve**' }, 0],
    ['no review-start timestamp', { body: '**Approve**', since: '' }, 1],
    [
      'a workflow-editing PR is asserted like any other, never skipped',
      { body: 'nothing', changed: '.github/workflows/claude-review.yml' },
      1,
    ],
    [
      'a verdict wrapped across a newline, which the line-oriented grep must reject',
      { body: '**Approve\nwith minor changes**' },
      1,
    ],
    [
      'a comment-event run must still be asserted, never skipped',
      { body: 'nothing', event: 'issue_comment', changed: '.github/workflows/claude-review.yml' },
      1,
    ],
  ];

  it('keeps every executed row, since it.each([]) registers nothing and still reports PASS', () => {
    expect(
      EXECUTED_CASES.length,
      'Emptying this table removes every execution-based assertion while vitest reports PASS over zero registered tests — the silent green the corpus check above exists to prevent.',
    ).toBeGreaterThanOrEqual(6);
  });

  it.each(EXECUTED_CASES)('runs the WHOLE guard under bash: %s', (_label, run, expected) => {
    const { status, stderr } = runGuard(run);
    expect(
      { status, unbound: /unbound variable/.test(stderr) },
      `The ENTIRE run: script is executed here with gh stubbed on PATH, not a trailing slice of it.\n\nSlicing from the grep left everything before it unexecuted, so an \`exit 0\` placed after the fetch bypassed every assertion — the same class one level up. Executing the whole script is what removes it rather than moving it.\n\nEvery variable the script reads is stubbed, because an earlier version stubbed only \`fresh\` and \`set -u\` aborted on \`$PR\` three lines before the guard's own exit, making the row pass for the wrong reason. The unbound check is what keeps that visible.\n\nstderr: ${stderr.trim()}`,
    ).toEqual({ status: expected, unbound: false });
  });

  it('carries no || true and no continue-on-error, either of which unblocks the exit', () => {
    expect(
      /\|\|\s*true/.test(guardScript()),
      'A `|| true` in the guard stops the grep failing the step, so the terminal exit becomes unreachable.',
    ).toBe(false);
    expect(
      guardStep().if,
      "The step must run unconditionally. Replacing `if: always()` with any falsy expression — `github.event_name == 'issue_comment'` is the plausible edit for silencing it on the auto path — skips the step on the exact pull_request path that has never once posted a verdict, the job reports success, and every assertion in this file still passes. Same silent-green consequence as continue-on-error, one field over.",
    ).toBe('always()');
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

  it('carries no event-based skip: under pull_request_target every run is assertable', () => {
    // The carve-out that used to live here skipped `pull_request` runs whose diff
    // touched this workflow, because GitHub loaded the workflow from the PR head
    // and the action refused, so no verdict could exist to assert. The trigger is
    // now `pull_request_target`, which always runs the base copy — the action
    // never refuses, and a surviving skip would hide a real no-verdict behind a
    // green check. Reintroducing one must red here rather than pass quietly.
    const script = guardScript();
    expect(
      /GITHUB_EVENT_NAME/.test(script),
      'The guard reintroduced an event-name branch. Under pull_request_target the auto path can always post a verdict, so any event-based skip is a silent green waiting to happen.',
    ).toBe(false);
    expect(
      /SKIP\s/.test(script),
      'The guard reintroduced a SKIP path. Every run this guard sees can now be asserted; a skip means a run that reviewed nothing reports success.',
    ).toBe(false);
  });
});

describe('the workflow grants the API scopes its own guard needs', () => {
  const permissions = (): Record<string, unknown> => {
    const doc = parse(readFileSync(WORKFLOW, 'utf8')) as {
      permissions?: Record<string, unknown>;
      jobs?: { review?: { permissions?: Record<string, unknown> } };
    };
    // A job-level block REPLACES the workflow-level set rather than merging, so
    // reading only the top level would report `issues: read` from a block the
    // runner ignores. ci.yml already scopes at job level in eight places.
    return doc.jobs?.review?.permissions ?? doc.permissions ?? {};
  };

  it('declares issues when the guard reads the Issues API', () => {
    const usesIssuesApi = /gh api[\s\S]*?\/issues\//.test(guardScript());
    if (!usesIssuesApi) return;
    expect(
      permissions().issues,
      '`none` is a valid GitHub Actions permission value meaning NO access, so asserting the key is merely present passes on the broken state — the level is the property. The guard fetches PR conversation comments from repos/:owner/:repo/issues/:number/comments. That endpoint is gated by the `issues` permission, NOT by `pull-requests` — the sibling claude.yml declares `issues: write` for equivalent access.\n\nWithout it the call 403s, `set -e` aborts the assignment before any diagnostic prints, and the step reds on EVERY run: a permanent false red on the gate this workflow exists to add, indistinguishable in the log from a real missing verdict.\n\nThe executed rows cannot catch this. They stub `gh` on PATH, so no row ever exercises a real API permission — which is exactly why this assertion is structural and lives here.',
    ).toMatch(/^(read|write)$/);
  });
});
