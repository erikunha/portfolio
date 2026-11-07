import { describe, expect, it, vi } from 'vitest';
import { evaluatePullRequest, type Thread } from '@/scripts/check-pr-comments';

function mkThread(overrides: Partial<Thread> = {}): Thread {
  return {
    id: 'T_1',
    isResolved: true,
    resolvedBy: { login: 'reviewer' },
    comments: [{ author: { login: 'reviewer' } }, { author: { login: 'erikunha' } }],
    ...overrides,
  };
}

const HEAD_SHA = 'a'.repeat(40);
const STALE_SHA = 'b'.repeat(40);

type Review = { state: string; body: string; authorAssociation: string };

function mkReview(overrides: Partial<Review> = {}): Review {
  return {
    state: 'COMMENTED',
    body: `Findings verified and fixed.\n\nself-review: ${HEAD_SHA}`,
    authorAssociation: 'OWNER',
    ...overrides,
  };
}

// The GraphQL payload nests comments under `nodes`; the production parser reads
// `t.comments.nodes`. A mock emitting a bare array is more permissive than the API.
function mockGh(
  threads: Thread[],
  prAuthor = 'erikunha',
  {
    reviews = [mkReview()],
    headRefOid = HEAD_SHA,
  }: { reviews?: Review[]; headRefOid?: string } = {},
) {
  return vi.fn(async (_args: string[]) =>
    JSON.stringify({
      data: {
        repository: {
          pullRequest: {
            author: { login: prAuthor },
            headRefOid,
            reviews: { nodes: reviews },
            reviewThreads: {
              nodes: threads.map((t) => ({ ...t, comments: { nodes: t.comments } })),
            },
          },
        },
      },
    }),
  );
}

const evaluate = (ghExec: ReturnType<typeof mockGh>) =>
  evaluatePullRequest({ prNumber: 42, owner: 'erikunha', repo: 'portfolio', ghExec });

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

  describe('self-review marker', () => {
    it('asks the API for the head SHA and the reviews, which the marker check reads', async () => {
      const ghExec = mockGh([mkThread()]);
      await evaluate(ghExec);
      const sent = ghExec.mock.calls.flat().join(' ');
      expect(sent, 'without headRefOid the marker cannot be compared to the head').toContain(
        'headRefOid',
      );
      expect(sent, 'without authorAssociation any commenter could post the marker').toContain(
        'authorAssociation',
      );
      expect(sent).toMatch(/reviews\(last:\d+\)/);
    });

    it('FAILS with missing_self_review when the PR has no review at all', async () => {
      const result = await evaluate(mockGh([mkThread()], 'erikunha', { reviews: [] }));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe('missing_self_review');
    });

    it('FAILS when the marker names an earlier head, which is what a push after the review leaves', async () => {
      const stale = mkReview({ body: `self-review: ${STALE_SHA}` });
      const result = await evaluate(mockGh([mkThread()], 'erikunha', { reviews: [stale] }));
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('missing_self_review');
        expect(result.message).toContain(HEAD_SHA);
      }
    });

    it('FAILS when the marker carries a short SHA', async () => {
      const short = mkReview({ body: `self-review: ${HEAD_SHA.slice(0, 7)}` });
      const result = await evaluate(mockGh([mkThread()], 'erikunha', { reviews: [short] }));
      expect(result.ok).toBe(false);
    });

    it('FAILS when the review has no marker', async () => {
      const bare = mkReview({ body: 'Looks fine to me.' });
      const result = await evaluate(mockGh([mkThread()], 'erikunha', { reviews: [bare] }));
      expect(result.ok).toBe(false);
    });

    it.each(['CHANGES_REQUESTED', 'DISMISSED', 'PENDING'])(
      'FAILS when the matching review is %s',
      async (state) => {
        const result = await evaluate(
          mockGh([mkThread()], 'erikunha', { reviews: [mkReview({ state })] }),
        );
        expect(result.ok).toBe(false);
      },
    );

    it('FAILS when the marker comes from someone without write standing on the repo', async () => {
      const stranger = mkReview({ authorAssociation: 'NONE' });
      const result = await evaluate(mockGh([mkThread()], 'erikunha', { reviews: [stranger] }));
      expect(result.ok).toBe(false);
    });

    it.each(['COMMENTED', 'APPROVED'])(
      'passes a %s review whose marker names the head',
      async (state) => {
        const result = await evaluate(
          mockGh([mkThread()], 'erikunha', { reviews: [mkReview({ state })] }),
        );
        expect(result.ok).toBe(true);
      },
    );

    it('passes when an older review is stale but a newer one names the head', async () => {
      const reviews = [mkReview({ body: `self-review: ${STALE_SHA}` }), mkReview()];
      const result = await evaluate(mockGh([mkThread()], 'erikunha', { reviews }));
      expect(result.ok).toBe(true);
    });

    it('reports unresolved threads before the missing review, so the first fix is the open thread', async () => {
      const result = await evaluate(
        mockGh([mkThread({ isResolved: false, resolvedBy: null })], 'erikunha', { reviews: [] }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe('unresolved_threads');
    });
  });
});
