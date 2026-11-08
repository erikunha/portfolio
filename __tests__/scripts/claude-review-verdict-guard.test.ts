import { execFileSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const WORKFLOW = join(process.cwd(), '.github', 'workflows', 'claude-review.yml');

const GUARD_STEP = 'Assert this run posted a readable verdict';

const CLAUDE_LOGIN = 'claude[bot]';

type Step = { name?: string; run?: string; if?: unknown; 'continue-on-error'?: unknown };

function guardStep(): Step {
  const doc = parse(readFileSync(WORKFLOW, 'utf8')) as {
    jobs?: { review?: { steps?: Step[] } };
  };
  const step = doc.jobs?.review?.steps?.find((s) => s.name === GUARD_STEP);
  if (typeof step?.run !== 'string') {
    throw new Error(
      `claude-review.yml has no step named "${GUARD_STEP}" carrying a run: script. That step is the only thing standing between "the action exited 0" and "a review actually happened": a review that posts no verdict still exits 0 and the check reads green. If it was renamed, rename GUARD_STEP with it; do not delete this test.`,
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

describe('the guard fetches, filters and tests the latest review comment of this run', () => {
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
      `The verdict grep must read the variable the FILTERED fetch assigns. Nothing previously tied them, and substituting an unfiltered \`gh api … --jq '.[].body'\` ran green, which returns both failures at once: a stale prior-run verdict and a bolded "approve" from any author each satisfy the guard although this run posted nothing.\n\nfetch assigns: ${fetch?.[1]}\ngrep reads:    ${grep?.[1]}`,
    ).toBe(fetch?.[1]);
  });

  it('selects the latest claude[bot] comment of this run only', () => {
    const filter = FETCH.exec(guardScript())?.[2] ?? '';
    expect(
      filter,
      `The jq filter must restrict to ${CLAUDE_LOGIN}, scope to this run via created_at, and take LAST.\n\nThe author and freshness predicates must be ONE composed expression: asserted separately, rewriting \`and\` to \`or\` leaves both substrings present and both assertions green while the freshness filter stops filtering.\n\n\`last\` matters because the action edits its verdict into its newest comment. Reading the union goes green on a verdict in an older fresh comment while the newest one, a progress checklist, holds none.`,
    ).toContain(`select(.user.login == \\"${CLAUDE_LOGIN}\\" and .created_at >= \\"$SINCE\\")`);
    expect(filter).toContain('sort_by(.created_at)');
    expect(filter).toContain('last');
    expect(
      /gh api[^\n]*--paginate --slurp/.test(guardScript()),
      'The fetch must pass --slurp. gh applies --jq PER PAGE under --paginate, so without it `last` yields one body per page and the grep sees their union, reintroducing the exact failure `last` was added to remove, invisibly, and only once a PR passes 30 comments. The filter must also flatten with .[][] and sort explicitly rather than trusting API order.',
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
  ['**Summary** we approve of nothing here **Notes**', false],
  ['**Done** traced the reject-then-refund path. Verdict: **Approve**', true],
  ['', false],
];

const guardMatches = (body: string): boolean => {
  const pattern = new RegExp(GREP.exec(guardScript())?.[2] ?? '(?!)', 'i');
  return body.split('\n').some((line) => pattern.test(line));
};

describe('the guard verdict pattern accepts a bold verdict and nothing else', () => {
  it('keeps a non-empty corpus, since it.each([]) registers nothing and still reports PASS', () => {
    expect(
      SINGLE_LINE_BODIES.length,
      'Emptying this table removes every verdict-shape case with no red: vitest reports PASS over zero registered tests.',
    ).toBeGreaterThan(5);
  });

  it.each(SINGLE_LINE_BODIES)('%j reads as a verdict: %s', (body, expected) => {
    expect(guardMatches(body)).toBe(expected);
  });

  it('never matches a progress checklist with no verdict', () => {
    const checklist = '### Review\n- [x] Gather context\n- [x] Check schema compatibility';
    expect(
      guardMatches(checklist),
      'That body is a progress checklist with no verdict. If the guard ever accepts it, the guard has become the bug it was written to catch.',
    ).toBe(false);
  });

  it('is line-oriented, so a verdict wrapped across a newline reads as none', () => {
    expect(guardMatches('**Approve\nwith minor changes**')).toBe(false);
  });

  it('fails closed when a code-span glob shares the verdict line', () => {
    expect(
      guardMatches('Touches `app/api/**`. **Verdict: Approve.**'),
      'The ** inside the code span pairs with the verdict opener, so the line reads as no verdict. That reds the job and asks for a retry; it never passes a run that posted nothing.',
    ).toBe(false);
  });
});

describe('the guard reds the job when this run posted no verdict', () => {
  type Run = { body: string; since?: string };

  function runGuard({ body, since = '2026-01-01T00:00:00Z' }: Run) {
    const bin = mkdtempSync(join(tmpdir(), 'guard-gh-'));
    writeFileSync(
      join(bin, 'gh'),
      // The stub REJECTS `--slurp` together with ANY filter flag, which is gh's
      // real predicate: --jq, its shorthand -q, and --template all trip it
      // ("the --slurp option is not supported with --jq or --template"). A stub
      // that accepts what the real binary refuses pins its own behaviour, not
      // the command under test.
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
          // gh --paginate --slurp emits an array of pages; the guard pipes that
          // into jq, so the stub must speak the same shape the real API does
          // rather than a bare markdown body.
          GUARD_STUB_PAGES: JSON.stringify([
            [{ user: { login: 'claude[bot]' }, created_at: '2030-01-01T00:00:00Z', body }],
          ]),
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
    ['a body with no verdict reds', { body: 'nothing' }, 1],
    [
      'a verdict wrapped across a newline, which the line-oriented grep must reject',
      { body: '**Approve\nwith minor changes**' },
      1,
    ],
  ];

  it('keeps every executed row, since it.each([]) registers nothing and still reports PASS', () => {
    expect(
      EXECUTED_CASES.length,
      'Emptying this table removes every execution-based assertion while vitest reports PASS over zero registered tests, the silent green the corpus check above exists to prevent.',
    ).toBeGreaterThanOrEqual(5);
  });

  it.each(EXECUTED_CASES)('runs the WHOLE guard under bash: %s', (_label, run, expected) => {
    const { status, stderr } = runGuard(run);
    expect(
      { status, unbound: /unbound variable/.test(stderr) },
      `The ENTIRE run: script is executed here with gh stubbed on PATH, not a trailing slice of it.\n\nSlicing from the grep left everything before it unexecuted, so an \`exit 0\` placed after the fetch bypassed every assertion.\n\nEvery variable the script reads is stubbed, because \`set -u\` aborts on an unset one before the guard's own exit and the row would pass for the wrong reason. The unbound check keeps that visible.\n\nstderr: ${stderr.trim()}`,
    ).toEqual({ status: expected, unbound: false });
  });

  it('carries no || true and no continue-on-error, either of which unblocks the exit', () => {
    expect(
      /\|\|\s*true/.test(guardScript()),
      'A `|| true` in the guard stops the grep failing the step, so the terminal exit becomes unreachable.',
    ).toBe(false);
    expect(
      guardStep().if,
      'The step must run unconditionally. Replacing `if: always()` with any falsy expression skips it, the job reports success, and every assertion in this file still passes.',
    ).toBe('always()');
    expect(
      guardStep()['continue-on-error'] ?? false,
      'continue-on-error makes the step exit non-blocking, so the job goes green over a run that posted no verdict while every assertion here, including the executed rows, which measure the script in isolation and cannot see the step wrapper, still passes.',
    ).toBe(false);
  });

  it('refuses, rather than degrades, when the review-start timestamp is missing', () => {
    expect(
      block(/if \[ -z "\$\{SINCE:-\}" \]/, 'an empty-timestamp refusal'),
      'The empty-SINCE block must exit non-zero. jq compares strings, so `.created_at >= ""` is true for every comment: falling through silently removes the run-scoping and a previous run\'s verdict passes. The exit code IS the behaviour.',
    ).toContain('exit 1');
  });

  it('asserts every comment-triggered run, with no event or diff carve-out', () => {
    expect(
      /GITHUB_EVENT_NAME|gh pr diff/.test(guardScript()),
      'The guard now branches on the event or the diff. Every run is comment-triggered and runs the default-branch workflow, so it can always post a verdict; any skip is a silent green.',
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
