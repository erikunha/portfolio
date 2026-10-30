import { describe, expect, it, vi } from 'vitest';
import { evaluatePullRequest, type Thread } from '@/scripts/check-pr-comments';

const BOT_LOGIN = 'claude[bot]';
const PR_NUMBER = 42;
const REPO = 'erikunha/portfolio';
const PR_HEAD_SHA = 'a'.repeat(40);
const FIX_SHA = 'b'.repeat(40);
const UNREACHABLE_SHA = 'c'.repeat(40);

function mkThread(overrides: Partial<Thread> = {}): Thread {
  return {
    id: 'T_1',
    isResolved: true,
    resolvedBy: { login: 'reviewer' },
    comments: [{ author: { login: 'reviewer' } }, { author: { login: 'erikunha' } }],
    ...overrides,
  };
}

// The GraphQL payload nests comments under `nodes`; the production parser reads
// `t.comments.nodes`. A mock emitting a bare array is more permissive than the API.
function mockGh(threads: Thread[], opts: { prAuthor?: string; reachable?: string[] } = {}) {
  const reachable = new Set(opts.reachable ?? []);
  return vi.fn(async (args: string[]) => {
    const path = args[1] ?? '';
    if (path.startsWith('repos/') && path.includes('/compare/')) {
      const [base = '', head = ''] = (path.split('/compare/')[1] ?? '').split('...');
      const status = base === head ? 'identical' : reachable.has(base) ? 'ahead' : 'diverged';
      return JSON.stringify({ status, ahead_by: 1, behind_by: 0 });
    }
    return JSON.stringify({
      data: {
        repository: {
          pullRequest: {
            author: { login: opts.prAuthor ?? 'erikunha' },
            headRefOid: PR_HEAD_SHA,
            headRepository: { nameWithOwner: REPO },
            reviewThreads: {
              nodes: threads.map((t) => ({ ...t, comments: { nodes: t.comments } })),
            },
          },
        },
      },
    });
  });
}

function botThread(replyBody: string): Thread {
  return mkThread({
    comments: [
      { author: { login: BOT_LOGIN }, body: 'Finding: the null case is unhandled.' },
      { author: { login: 'erikunha' }, body: replyBody },
    ],
  });
}

function commitLink(sha: string, pr = PR_NUMBER, label = sha.slice(0, 7)): string {
  return `[\`${label}\`](https://github.com/${REPO}/pull/${pr}/commits/${sha})`;
}

describe('evaluatePullRequest', () => {
  it('asks the API for more than one comment per thread', async () => {
    const ghExec = mockGh([mkThread()]);
    await evaluatePullRequest({ prNumber: 42, owner: 'erikunha', repo: 'portfolio', ghExec });
    const sent = ghExec.mock.calls.flat().join(' ');
    const pageSize = /comments\(first:(\d+)\)/.exec(sent)?.[1];
    expect(
      Number(pageSize),
      'The silent-resolve check counts comments, so the query must page more than one. At first:1 every thread returns a single comment and every thread reads as a silent resolve. Every assertion here mocks ghExec, so nothing else in this file can see the query string.',
    ).toBeGreaterThan(1);
  });

  it('FAILS a resolved thread carrying only the finding — a silent resolve', async () => {
    const ghExec = mockGh([mkThread({ comments: [{ author: { login: 'claude' } }] })]);
    const result = await evaluatePullRequest({
      prNumber: 42,
      owner: 'erikunha',
      repo: 'portfolio',
      ghExec,
    });
    expect(
      result.ok,
      'A thread resolved with one comment is the finding closed with no reply. Measured across the PRs merged 2026-07-27, every thread carried 2 comments — finding plus a reply citing the fix SHA. One comment means the reply never happened.',
    ).toBe(false);
    if (!result.ok) expect(result.code).toBe('silent_resolve');
  });

  it('passes a resolved thread carrying a reply', async () => {
    const ghExec = mockGh([
      mkThread({
        comments: [{ author: { login: 'claude' } }, { author: { login: 'erikunha' } }],
      }),
    ]);
    const result = await evaluatePullRequest({
      prNumber: 42,
      owner: 'erikunha',
      repo: 'portfolio',
      ghExec,
    });
    expect(result.ok).toBe(true);
  });

  it('does not fault an UNRESOLVED single-comment thread for the reply it has not needed yet', async () => {
    const ghExec = mockGh([
      mkThread({ isResolved: false, comments: [{ author: { login: 'claude' } }] }),
    ]);
    const result = await evaluatePullRequest({
      prNumber: 42,
      owner: 'erikunha',
      repo: 'portfolio',
      ghExec,
    });
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(
        result.code,
        'An open thread with one comment is a finding awaiting a fix, not a silent resolve. Reporting it as silent_resolve would name the wrong defect and send the reader looking for a reply they were never meant to have written yet.',
      ).toBe('unresolved_threads');
  });

  it('passes when every thread is resolved by someone other than the PR author', async () => {
    const ghExec = mockGh([mkThread()]);
    const result = await evaluatePullRequest({
      prNumber: 42,
      owner: 'erikunha',
      repo: 'portfolio',
      ghExec,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.warnings).toEqual([]);
  });

  it('fails with code "unresolved_threads" when any thread is unresolved', async () => {
    const ghExec = mockGh([
      mkThread({ id: 'T_1' }),
      mkThread({ id: 'T_2', isResolved: false, resolvedBy: null }),
    ]);
    const result = await evaluatePullRequest({
      prNumber: 42,
      owner: 'erikunha',
      repo: 'portfolio',
      ghExec,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('unresolved_threads');
      expect(result.unresolvedThreads).toEqual(['T_2']);
    }
  });

  it('warns "suspicious_self_resolve" when PR author resolved their own thread', async () => {
    const ghExec = mockGh([mkThread({ resolvedBy: { login: 'erikunha' } })]);
    const result = await evaluatePullRequest({
      prNumber: 42,
      owner: 'erikunha',
      repo: 'portfolio',
      ghExec,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.warnings).toContainEqual({
        code: 'suspicious_self_resolve',
        threadId: 'T_1',
      });
    }
  });

  it('fails with code "gh_auth_missing" when gh exits with auth error', async () => {
    const ghExec = vi.fn(async () => {
      const err = new Error('gh: auth required') as Error & { code?: string };
      err.code = 'GH_AUTH';
      throw err;
    });
    const result = await evaluatePullRequest({
      prNumber: 42,
      owner: 'erikunha',
      repo: 'portfolio',
      ghExec,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('gh_auth_missing');
  });

  it('fails with code "graphql_failure" when GraphQL returns errors array', async () => {
    const ghExec = vi.fn(async () => JSON.stringify({ errors: [{ message: 'rate limited' }] }));
    const result = await evaluatePullRequest({
      prNumber: 42,
      owner: 'erikunha',
      repo: 'portfolio',
      ghExec,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('graphql_failure');
  });

  describe('fix-claiming replies must cite a reachable commit', () => {
    it('passes a fix-claiming reply whose commit link points at an ancestor of the PR head', async () => {
      const ghExec = mockGh([botThread(`Fixed in ${commitLink(FIX_SHA)}`)], {
        reachable: [FIX_SHA],
      });
      const result = await evaluatePullRequest({
        prNumber: PR_NUMBER,
        owner: 'erikunha',
        repo: 'portfolio',
        ghExec,
      });
      expect(
        result.ok,
        'The owner rule (2026-10-30) wants a clickable link to the fix commit, reachable from the PR head. This reply carries one and the commit is an ancestor of the head, so the gate must stay green.',
      ).toBe(true);
    });

    it('FAILS a fix-claiming reply carrying only a bare SHA', async () => {
      const ghExec = mockGh([botThread(`Fixed in ${FIX_SHA.slice(0, 7)}.`)]);
      const result = await evaluatePullRequest({
        prNumber: PR_NUMBER,
        owner: 'erikunha',
        repo: 'portfolio',
        ghExec,
      });
      expect(
        result.ok,
        'A bare SHA is not a link. The rule asks for a clickable [`short`](https://github.com/erikunha/portfolio/pull/<n>/commits/<full-sha>) so a reader can land on the commit; a bare short SHA cannot be clicked and is the shape the rule exists to remove.',
      ).toBe(false);
      if (!result.ok) expect(result.code).toBe('reply_missing_commit_link');
    });

    it('FAILS a fix-claiming reply whose commit is not an ancestor of the PR head', async () => {
      const ghExec = mockGh([botThread(`Fixed in ${commitLink(UNREACHABLE_SHA)}`)], {
        reachable: [FIX_SHA],
      });
      const result = await evaluatePullRequest({
        prNumber: PR_NUMBER,
        owner: 'erikunha',
        repo: 'portfolio',
        ghExec,
      });
      expect(
        result.ok,
        'A link to a commit the PR head does not contain proves nothing about the fix landing. The link can be well-formed and still name a commit from another branch, so reachability is a separate property from link shape and the gate has to check it.',
      ).toBe(false);
      if (!result.ok) expect(result.code).toBe('reply_commit_unreachable');
    });

    it('passes a reply explaining why no change was made', async () => {
      const ghExec = mockGh([
        botThread('The code was not changed: the finding does not reproduce on the current head.'),
      ]);
      const result = await evaluatePullRequest({
        prNumber: PR_NUMBER,
        owner: 'erikunha',
        repo: 'portfolio',
        ghExec,
      });
      expect(
        result.ok,
        'The rule explicitly exempts a reply that explains why no change was made. It claims no fix, so it carries no commit and needs no link.',
      ).toBe(true);
    });

    it('FAILS a bare SHA in a reply whose later clause also carries a negation', async () => {
      const ghExec = mockGh([
        botThread(`Fixed in ${FIX_SHA.slice(0, 7)} - no other changes needed.`),
      ]);
      const result = await evaluatePullRequest({
        prNumber: PR_NUMBER,
        owner: 'erikunha',
        repo: 'portfolio',
        ghExec,
      });
      expect(
        result.ok,
        'The negation lands after the claim word, so it negates a later statement ("no other changes needed"), not the fix claim itself. Treating it as a negation of the claim would let "Fixed in <sha> - no other changes" through with no link at all.',
      ).toBe(false);
      if (!result.ok) expect(result.code).toBe('reply_missing_commit_link');
    });

    it('FAILS a link that names another pull request', async () => {
      const ghExec = mockGh([botThread(`Fixed in ${commitLink(FIX_SHA, PR_NUMBER + 1)}`)], {
        reachable: [FIX_SHA],
      });
      const result = await evaluatePullRequest({
        prNumber: PR_NUMBER,
        owner: 'erikunha',
        repo: 'portfolio',
        ghExec,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe('reply_missing_commit_link');
    });

    it('does not ask a link of a thread raised by someone other than claude-review', async () => {
      const ghExec = mockGh([
        mkThread({
          comments: [
            { author: { login: 'a-human-reviewer' }, body: 'Finding worth a look.' },
            { author: { login: 'erikunha' }, body: `Fixed in ${FIX_SHA.slice(0, 7)}.` },
          ],
        }),
      ]);
      const result = await evaluatePullRequest({
        prNumber: PR_NUMBER,
        owner: 'erikunha',
        repo: 'portfolio',
        ghExec,
      });
      expect(
        result.ok,
        'The owner rule scopes the requirement to claude-review threads. A human reviewer sets their own expectations, and holding their replies to a form the repo does not prescribe would be a gate inventing a rule.',
      ).toBe(true);
    });
  });
});
