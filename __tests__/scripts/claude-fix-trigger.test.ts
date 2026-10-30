import { execFileSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { extractReviewedSha, parseClaudeVerdict } from '@/scripts/check-claude-approval';

const SCRIPT = join(process.cwd(), 'scripts', 'check-claude-fix-trigger.mjs');

type Api = {
  pull?: Record<string, unknown>;
  files?: string[];
  threads?: Array<Record<string, unknown>>;
  comments?: Array<Record<string, unknown>>;
  commits?: Array<Record<string, unknown>>;
};

type Env = {
  reviewConclusion?: string;
  headRepository?: string;
  headBranch?: string;
  baseRef?: string;
  prNumber?: string;
  allowMainBase?: string;
  maxRounds?: string;
  labels?: string[];
  files?: string[];
  threads?: Array<Record<string, unknown>>;
  comments?: Array<Record<string, unknown>>;
  commits?: Array<Record<string, unknown>>;
};

const HEAD_SHA = 'a'.repeat(40);

const DEFAULT_PULL = {
  number: 231,
  base: { ref: 'feat/integration', sha: 'b'.repeat(40) },
  head: { ref: 'feat/part', sha: HEAD_SHA, repo: { full_name: 'owner/name' } },
  labels: [],
};

const botThread = (createdAt: string, resolved = false) => ({
  id: 'THREAD_node_id',
  isResolved: resolved,
  comments: {
    nodes: [
      {
        databaseId: 4242,
        author: { login: 'claude[bot]' },
        createdAt,
        body: 'the finding',
      },
    ],
  },
});

function stub(): { dir: string; log: string } {
  const dir = mkdtempSync(join(tmpdir(), 'claude-fix-gh-'));
  const log = join(dir, 'calls.log');
  writeFileSync(
    join(dir, 'gh'),
    [
      '#!/usr/bin/env bash',
      'args="$*"',
      'echo "$args" >> "$GH_STUB_LOG"',
      'case "$args" in',
      '  *"graphql"*)',
      `    printf '%s' "$GH_STUB_THREADS"`,
      '    ;;',
      '  *"/issues/"*)',
      `    printf '%s' "$GH_STUB_COMMENTS"`,
      '    ;;',
      '  *"/files"*)',
      `    printf '%s' "$GH_STUB_FILES"`,
      '    ;;',
      '  *"/commits"*)',
      `    printf '%s' "$GH_STUB_COMMITS"`,
      '    ;;',
      '  *" -X POST"*)',
      `    printf '%s' "$GH_STUB_POST"`,
      '    ;;',
      '  *)',
      `    printf '%s' "$GH_STUB_PULL"`,
      '    ;;',
      'esac',
      '',
    ].join('\n'),
  );
  chmodSync(join(dir, 'gh'), 0o755);
  return { dir, log };
}

function runGate(env: Env = {}, api: Api = {}) {
  const { dir, log } = stub();
  const output = join(dir, 'github_output');
  writeFileSync(output, '');
  const pull = {
    ...DEFAULT_PULL,
    ...(api.pull ?? {}),
    base: {
      ...DEFAULT_PULL.base,
      ...(api.pull?.base ?? {}),
      ...(env.baseRef ? { ref: env.baseRef } : {}),
    },
    labels: (env.labels ?? []).map((name) => ({ name })),
  };
  const files = env.files ?? api.files ?? [];
  const threads = env.threads ?? api.threads ?? [];
  const comments = env.comments ?? api.comments ?? [];
  const commits = env.commits ?? api.commits ?? [];
  try {
    execFileSync('node', [SCRIPT], {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${dir}:${process.env.PATH ?? ''}`,
        GH_STUB_LOG: log,
        GH_STUB_PULL: JSON.stringify(pull),
        GH_STUB_FILES: JSON.stringify([files.map((filename) => ({ filename }))]),
        GH_STUB_THREADS: JSON.stringify({
          data: { repository: { pullRequest: { reviewThreads: { nodes: threads } } } },
        }),
        GH_STUB_COMMENTS: JSON.stringify([comments]),
        GH_STUB_COMMITS: JSON.stringify([commits]),
        GH_STUB_POST: '{}',
        GITHUB_OUTPUT: output,
        REPO: 'owner/name',
        OWNER: 'owner',
        REPO_NAME: 'name',
        DEFAULT_BRANCH: 'main',
        HEAD_SHA,
        HEAD_BRANCH: env.headBranch ?? 'feat/part',
        HEAD_REPOSITORY: env.headRepository ?? 'owner/name',
        REVIEW_CONCLUSION: env.reviewConclusion ?? 'success',
        REVIEW_STARTED_AT: '2030-01-01T00:00:00Z',
        PR_NUMBER: env.prNumber ?? '231',
        ALLOW_MAIN_BASE: env.allowMainBase ?? '',
        MAX_ROUNDS: env.maxRounds ?? '',
      },
    });
    const written = readFileSync(output, 'utf8');
    const outputs: Record<string, string> = {};
    for (const line of written.split('\n')) {
      const [key, ...rest] = line.split('=');
      if (key) outputs[key] = rest.join('=');
    }
    return outputs;
  } catch (error) {
    const e = error as { status?: number; stderr?: Buffer };
    throw new Error(
      `the gate script exited ${e.status ?? -1}: ${e.stderr?.toString() ?? 'no stderr'}`,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const REQUEST_CHANGES_ON_HEAD = {
  user: { login: 'claude[bot]' },
  created_at: '2030-01-01T01:00:00Z',
  body: `Reviewed at head commit \`${HEAD_SHA}\`\n\n**Verdict: Request changes.**`,
};

describe('the gate decides whether the fixer may act on a pull request', () => {
  it('acts when the review left an unresolved claude[bot] finding', () => {
    const outputs = runGate({}, { threads: [botThread('2030-01-01T02:00:00Z')] });
    expect(outputs.should_fix).toBe('true');
    expect(outputs.trigger).toBe('threads');
  });

  it('acts on a request-changes verdict that names the head', () => {
    const outputs = runGate({}, { comments: [REQUEST_CHANGES_ON_HEAD] });
    expect(outputs.should_fix).toBe('true');
    expect(outputs.trigger).toBe('verdict');
  });

  it('does not act on a verdict that names an older commit than the head', () => {
    const outputs = runGate(
      {},
      {
        comments: [
          {
            user: { login: 'claude[bot]' },
            created_at: '2030-01-01T01:00:00Z',
            body: `Reviewed at head commit \`${'c'.repeat(40)}\`\n\n**Verdict: Request changes.**`,
          },
        ],
      },
    );
    expect(outputs.should_fix).toBe('false');
  });

  it('does not act on an approving verdict', () => {
    const outputs = runGate(
      {},
      {
        comments: [
          {
            user: { login: 'claude[bot]' },
            created_at: '2030-01-01T01:00:00Z',
            body: `Reviewed at head commit \`${HEAD_SHA}\`\n\n**Verdict: Approve.**`,
          },
        ],
      },
    );
    expect(outputs.should_fix).toBe('false');
  });

  it('does not act when the review run failed', () => {
    const outputs = runGate(
      { reviewConclusion: 'failure' },
      { threads: [botThread('2030-01-01T02:00:00Z')] },
    );
    expect(outputs.should_fix).toBe('false');
    expect(outputs.reason).toContain('concluded');
  });

  it('does not act on a fork', () => {
    const outputs = runGate(
      { headRepository: 'someone/else' },
      { threads: [botThread('2030-01-01T02:00:00Z')] },
    );
    expect(outputs.should_fix).toBe('false');
    expect(outputs.reason).toContain('someone/else');
  });

  it('does not act on a pull request based on the default branch unless the variable allows it', () => {
    const based = runGate({ baseRef: 'main' }, { threads: [botThread('2030-01-01T02:00:00Z')] });
    expect(based.should_fix).toBe('false');
    expect(based.reason).toContain('CLAUDE_FIX_ALLOW_MAIN_BASE');

    const allowed = runGate(
      { baseRef: 'main', allowMainBase: 'true' },
      { threads: [botThread('2030-01-01T02:00:00Z')] },
    );
    expect(allowed.should_fix).toBe('true');
  });

  it('does not act when the pull request carries the external-fixer label', () => {
    const outputs = runGate(
      { labels: ['external-fixer'] },
      { threads: [botThread('2030-01-01T02:00:00Z')] },
    );
    expect(outputs.should_fix).toBe('false');
    expect(outputs.reason).toContain('external-fixer');
  });

  it('does not act when the pull request changes an instruction-shaped file', () => {
    const outputs = runGate(
      { files: ['lib/CLAUDE.md'] },
      { threads: [botThread('2030-01-01T02:00:00Z')] },
    );
    expect(outputs.should_fix).toBe('false');
    expect(outputs.reason).toContain('lib/CLAUDE.md');
  });

  it('does not act on a thread the reviewer already resolved', () => {
    const outputs = runGate({}, { threads: [botThread('2030-01-01T02:00:00Z', true)] });
    expect(outputs.should_fix).toBe('false');
  });

  it('does not act on a thread that predates the review run', () => {
    const outputs = runGate({}, { threads: [botThread('2020-01-01T02:00:00Z')] });
    expect(outputs.should_fix).toBe('false');
  });
});

// The gate script is plain JavaScript and cannot import the TypeScript parser
// the merge gate uses, so it carries its own copy of the verdict and head-SHA
// patterns. These cases hold the two together: the oracle is the merge gate's
// own parser, imported, never a second copy of it.
const VERDICT_CORPUS: ReadonlyArray<readonly [string, string]> = [
  ['**Approve**', 'approve'],
  ['**Approve with minor changes**', 'approve'],
  ['**Request changes**', 'request-changes'],
  ['**Request changes** on the auth layer', 'request-changes'],
  ['**Reject**', 'reject'],
  ['Approve', 'none'],
  ['I approve of this approach', 'none'],
  ['### Review\n- [x] Gather context', 'none'],
  ['**Summary** of the change', 'none'],
];

describe('the gate reads the reviewer verdict exactly as the merge gate reads it', () => {
  it('keeps a non-empty corpus, since it.each([]) registers nothing and still reports PASS', () => {
    expect(VERDICT_CORPUS.length).toBeGreaterThan(5);
  });

  it.each(VERDICT_CORPUS)('agrees with the merge gate parser on %j', (body, expected) => {
    expect(parseClaudeVerdict(body)).toBe(expected);

    const comment = {
      user: { login: 'claude[bot]' },
      created_at: '2030-01-01T01:00:00Z',
      body: `Reviewed at head commit \`${HEAD_SHA}\`\n\n${body}`,
    };
    const outputs = runGate({}, { comments: [comment] });
    const blocking = expected === 'request-changes' || expected === 'reject';
    // The gate reads the head SHA only out of a comment that carries a verdict,
    // because that is the only place the SHA decides anything. A comment with
    // no verdict is not a verdict comment, so the gate reads no SHA from it.
    const expectedSha = expected === 'none' ? '' : (extractReviewedSha(comment.body) ?? '');
    expect(
      { trigger: outputs.trigger, reviewedSha: outputs.reviewed_sha },
      `The gate and the merge gate disagree about the reviewer's verdict.\n\nbody: ${body}\ngate parser: ${expected}\nmerge gate parser: ${parseClaudeVerdict(body)}`,
    ).toEqual({
      trigger: blocking ? 'verdict' : 'none',
      reviewedSha: expectedSha,
    });
  });

  it('agrees with the merge gate parser on the head SHA it reads out of the verdict', () => {
    const bodies = [
      `Reviewed at head commit \`${HEAD_SHA}\``,
      `Reviewed at head commit \`${HEAD_SHA.slice(0, 12)}\``,
      'Reviewed at head commit `not-a-sha`',
      'no head here',
    ];
    for (const body of bodies) {
      const comment = {
        user: { login: 'claude[bot]' },
        created_at: '2030-01-01T01:00:00Z',
        body: `**Request changes**\n\n${body}`,
      };
      const outputs = runGate({}, { comments: [comment] });
      expect(
        { reviewedSha: outputs.reviewed_sha },
        `The gate read a different head SHA than the merge gate would read from the same body.\n\nbody: ${body}`,
      ).toEqual({ reviewedSha: extractReviewedSha(body) ?? '' });
    }
  });
});

describe('the round cap stops the loop and hands it to a human, once', () => {
  const botCommit = { author: { login: 'claude[bot]' } };

  it('acts while the bot has authored fewer commits than the cap', () => {
    const outputs = runGate(
      { maxRounds: '3' },
      { threads: [botThread('2030-01-01T02:00:00Z')], commits: [botCommit, botCommit] },
    );
    expect(outputs.should_fix).toBe('true');
  });

  it('stops once the bot authored as many commits as the cap', () => {
    const outputs = runGate(
      { maxRounds: '3' },
      {
        threads: [botThread('2030-01-01T02:00:00Z')],
        commits: [botCommit, botCommit, botCommit],
      },
    );
    expect(outputs.should_fix).toBe('false');
    expect(outputs.reason).toContain('round cap');
  });

  it('defaults the cap to five when the repository variable is unset', () => {
    const commits = Array.from({ length: 5 }, () => botCommit);
    const atCap = runGate({}, { threads: [botThread('2030-01-01T02:00:00Z')], commits });
    expect(atCap.should_fix).toBe('false');
    expect(atCap.reason).toContain('round cap of 5');

    const underCap = runGate(
      {},
      { threads: [botThread('2030-01-01T02:00:00Z')], commits: commits.slice(0, 4) },
    );
    expect(underCap.should_fix).toBe('true');
  });

  it('counts only the commits the bot authored', () => {
    const outputs = runGate(
      { maxRounds: '2' },
      {
        threads: [botThread('2030-01-01T02:00:00Z')],
        commits: [{ author: { login: 'erikunha' } }, { author: { login: 'erikunha' } }],
      },
    );
    expect(outputs.should_fix).toBe('true');
    expect(outputs.bot_commits).toBe('0');
  });
});
