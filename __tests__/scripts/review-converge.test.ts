import { describe, expect, it } from 'vitest';
import {
  type ConvergeState,
  type ConvergeThread,
  fetchState,
  MIN_COMMENTS_PER_RESOLVED_THREAD,
  nextStep,
  REVIEWER_WORKFLOW,
} from '@/scripts/review-converge';

const HEAD = '0ae2f0d7f85d0c8e4d1c574b913958ac6c66d3ba';

function thread(over: Partial<ConvergeThread> = {}): ConvergeThread {
  return { id: 'T1', path: 'lib/a.ts', isResolved: true, commentCount: 2, ...over };
}

function state(over: Partial<ConvergeState> = {}): ConvergeState {
  return {
    prNumber: 228,
    headSha: HEAD,
    latestVerdictBody: `Reviewed at head commit \`${HEAD}\`.\n\n**Verdict: Approve.**`,
    threads: [thread()],
    editsReviewerWorkflow: false,
    ...over,
  };
}

describe('review-converge nextStep', () => {
  it('converges on an approve for HEAD with every thread replied and resolved', () => {
    const step = nextStep(state());
    expect(step.done).toBe(true);
    expect(step.action).toBe('converged');
  });

  it('demands replies before anything else when a thread is unresolved', () => {
    const step = nextStep(
      state({
        threads: [thread({ id: 'A', isResolved: false }), thread({ id: 'B' })],
        // an approve is already on record; the unresolved thread must still win
      }),
    );
    expect(step.done).toBe(false);
    expect(step.action).toBe('reply-then-resolve');
    expect(step.threadIds).toEqual(['A']);
  });

  it('catches a silent resolve: resolved but carrying only the original comment', () => {
    const step = nextStep({
      ...state(),
      threads: [thread({ id: 'S', commentCount: 1 })],
    });
    expect(step.done).toBe(false);
    expect(step.action).toBe('add-missing-reply');
    expect(step.threadIds).toEqual(['S']);
  });

  it('converges on a thread that drew a follow-up beyond the reply', () => {
    // Guards the high side of the boundary: with only 1-and-2 fixtures, `<`
    // mutates to `!==` and every 3-comment thread is reported as a silent
    // resolve forever, so the loop can never converge and the hook nags on
    // every push.
    const step = nextStep({ ...state(), threads: [thread({ commentCount: 3 })] });
    expect(step.done).toBe(true);
  });

  it('refuses an approve whose SHA shares a prefix with HEAD and then diverges', () => {
    // Guards against startsWith being weakened to a fixed-length prefix compare,
    // which would read a stale approve as fresh.
    const step = nextStep(
      state({
        latestVerdictBody: `**Verdict: Approve.** Reviewed at head commit \`${HEAD.slice(0, 8)}ffffffff\`.`,
      }),
    );
    expect(step.done).toBe(false);
    expect(step.reason).toMatch(/stale/);
  });

  it(`treats ${MIN_COMMENTS_PER_RESOLVED_THREAD} comments as the minimum evidence of a reply`, () => {
    const below = nextStep({
      ...state(),
      threads: [thread({ commentCount: MIN_COMMENTS_PER_RESOLVED_THREAD - 1 })],
    });
    const at = nextStep({
      ...state(),
      threads: [thread({ commentCount: MIN_COMMENTS_PER_RESOLVED_THREAD })],
    });
    expect(below.action).toBe('add-missing-reply');
    expect(at.done).toBe(true);
  });

  it('requests a review when claude[bot] has posted no parsable verdict', () => {
    const step = nextStep(state({ latestVerdictBody: null }));
    expect(step.action).toBe('request-review');
    expect(step.reason).toMatch(/No parsable verdict/);
  });

  it('requests a review when the verdict renders correctly but parses as none', () => {
    const step = nextStep(
      state({ latestVerdictBody: `Reviewed at head commit \`${HEAD}\`.\n\n**Verdict:** Approve` }),
    );
    expect(step.done).toBe(false);
    expect(step.action).toBe('request-review');
  });

  it('requests a review when the latest verdict is request-changes', () => {
    const step = nextStep(
      state({
        latestVerdictBody: `Reviewed at head commit \`${HEAD}\`.\n\n**Verdict: Request changes.**`,
      }),
    );
    expect(step.action).toBe('request-review');
    expect(step.reason).toMatch(/request-changes/);
  });

  it('refuses a stale approve that reviewed an older SHA', () => {
    const step = nextStep(
      state({
        latestVerdictBody: '**Verdict: Approve.** Reviewed at head commit `deadbeefdeadbeef`.',
      }),
    );
    expect(step.done).toBe(false);
    expect(step.action).toBe('request-review');
    expect(step.reason).toMatch(/stale/);
  });

  it('refuses an approve that states no head SHA at all', () => {
    const step = nextStep(state({ latestVerdictBody: '**Verdict: Approve.**' }));
    expect(step.done).toBe(false);
    expect(step.reason).toMatch(/no SHA stated/);
  });

  it('accepts an abbreviated reviewed SHA that prefixes HEAD', () => {
    const step = nextStep(
      state({ latestVerdictBody: '**Verdict: Approve.** Reviewed at head commit `0ae2f0d7f85d`.' }),
    );
    expect(step.done).toBe(true);
  });

  it('tells a reviewer-workflow PR to comment, since its auto path cannot post', () => {
    // The one case where /claude-review is required rather than harmful: GitHub
    // loads a `pull_request` workflow from the PR head, the action refuses, and
    // the guard skips — so the job goes green having reviewed nothing and
    // "push, it reviews itself" is advice that never terminates.
    const step = nextStep(
      state({
        editsReviewerWorkflow: true,
        latestVerdictBody: `Reviewed at head commit \`${HEAD}\`.\n\n**Verdict: Request changes.**`,
      }),
    );
    expect(step.action).toBe('request-review');
    expect(step.reason).toMatch(/Comment \/claude-review/);
    expect(step.reason).not.toMatch(/the push triggers the review on its own/);
  });

  it('a STALE approve on a reviewer-workflow PR also says only a comment can refresh it', () => {
    // The stale-approve branch carries its own editsReviewerWorkflow ternary, and
    // it had no coverage for the true case — collapsing it to always return the
    // else message left every test green, because the only assertion on that
    // branch matched `/stale/`, which lives in the unconditional prefix.
    const step = nextStep(
      state({
        editsReviewerWorkflow: true,
        latestVerdictBody: '**Verdict: Approve.** Reviewed at head commit `deadbeefdeadbeef`.',
      }),
    );
    expect(step.done).toBe(false);
    expect(step.reason).toMatch(/stale/);
    expect(step.reason).toMatch(/only a \/claude-review comment can refresh it/);
  });

  it('a STALE approve on an ordinary PR says a push refreshes it', () => {
    const step = nextStep(
      state({
        editsReviewerWorkflow: false,
        latestVerdictBody: '**Verdict: Approve.** Reviewed at head commit `deadbeefdeadbeef`.',
      }),
    );
    expect(step.reason).toMatch(/A push triggers a review on its own/);
    expect(step.reason).not.toMatch(/only a \/claude-review comment can refresh it/);
  });

  it('tells an ordinary PR the opposite: push, do not comment', () => {
    const step = nextStep(
      state({
        editsReviewerWorkflow: false,
        latestVerdictBody: `Reviewed at head commit \`${HEAD}\`.\n\n**Verdict: Request changes.**`,
      }),
    );
    expect(step.reason).toMatch(/the push triggers the review on its own/);
    expect(step.reason).not.toMatch(/Comment \/claude-review/);
  });

  it('converges on a PR that drew no review threads at all', () => {
    const step = nextStep(state({ threads: [] }));
    expect(step.done).toBe(true);
  });
});

describe('review-converge fetchState', () => {
  const HEAD_OID = 'aaaaaaaabbbbbbbbccccccccddddddddeeeeeeee';

  function stubGh(over: { hasNextPage?: boolean; comments?: unknown[]; changed?: string[] } = {}) {
    return async (args: string[]): Promise<string> => {
      if (args[1] === 'graphql') {
        return JSON.stringify({
          data: {
            repository: {
              pullRequest: {
                headRefOid: HEAD_OID,
                reviewThreads: {
                  pageInfo: { hasNextPage: over.hasNextPage ?? false },
                  nodes: [
                    {
                      id: 'T1',
                      isResolved: true,
                      comments: { totalCount: 2, nodes: [{ path: 'lib/a.ts' }] },
                    },
                  ],
                },
              },
            },
          },
        });
      }
      if (args[0] === 'pr' && args[1] === 'diff') {
        if (over.diffFails) throw new Error('gh: API rate limit exceeded');
        return (over.changed ?? []).join('\n');
      }
      return JSON.stringify([over.comments ?? []]);
    };
  }

  it('detects a PR that changes the reviewer workflow, and one that does not', async () => {
    // Read from `gh pr diff --name-only`, so the flag reflects the PR's real
    // contents rather than anything the caller asserts about it.
    const edits = await fetchState(
      'o',
      'r',
      1,
      stubGh({ changed: ['README.md', REVIEWER_WORKFLOW] }),
    );
    expect(edits.editsReviewerWorkflow).toBe(true);
    const plain = await fetchState('o', 'r', 1, stubGh({ changed: ['README.md'] }));
    expect(plain.editsReviewerWorkflow).toBe(false);
  });

  it('throws when the diff read fails, rather than reading it as "does not edit"', async () => {
    // The failure path of the try/catch that replaced a blanket `.catch(() => '')`.
    // Untested, reverting to the blanket catch left every case green while a
    // transient gh error silently produced editsReviewerWorkflow=false — the
    // wrong-but-plausible value that resurrects the never-terminating advice.
    await expect(fetchState('o', 'r', 1, stubGh({ diffFails: true }))).rejects.toThrow(
      /could not read the changed files/,
    );
    await expect(fetchState('o', 'r', 1, stubGh({ diffFails: true }))).rejects.toThrow(
      /rate limit exceeded/,
    );
  });

  it('refuses to converge on a truncated thread page rather than reporting resolved', async () => {
    await expect(fetchState('o', 'r', 1, stubGh({ hasNextPage: true }))).rejects.toThrow(
      /more than 100 review threads/,
    );
  });

  it('asks GraphQL for pageInfo, so the truncation guard has an input to read', async () => {
    // The stub answers with pageInfo whatever the query says, so the throw test
    // above stays green if `pageInfo{ hasNextPage }` is dropped from the query —
    // it pins the stub, not the request. Assert the query itself: without this,
    // a truncated thread set optional-chains to undefined and converges.
    let sentQuery = '';
    await fetchState('o', 'r', 1, async (args) => {
      const q = args.find((a) => a.startsWith('query='));
      if (q) sentQuery = q;
      return stubGh()(args);
    });
    expect(sentQuery).toMatch(/pageInfo\s*\{\s*hasNextPage\s*\}/);
  });

  it('picks the latest claude comment by created_at, not by array position', async () => {
    const state = await fetchState(
      'o',
      'r',
      1,
      stubGh({
        comments: [
          {
            user: { login: 'claude[bot]' },
            created_at: '2026-07-26T23:00:00Z',
            body: `**Verdict: Approve.** Reviewed at head commit \`${HEAD_OID}\`.`,
          },
          {
            user: { login: 'claude[bot]' },
            created_at: '2026-07-26T22:00:00Z',
            body: '**Verdict: Request changes.**',
          },
        ],
      }),
    );
    // Newest is the approve even though it is not last in the array.
    expect(nextStep(state).done).toBe(true);
  });

  it('ignores comments from anyone other than claude[bot]', async () => {
    const state = await fetchState(
      'o',
      'r',
      1,
      stubGh({
        comments: [
          {
            user: { login: 'someone' },
            created_at: '2026-07-26T23:00:00Z',
            body: `**Verdict: Approve.** Reviewed at head commit \`${HEAD_OID}\`.`,
          },
        ],
      }),
    );
    expect(nextStep(state).action).toBe('request-review');
  });
});
