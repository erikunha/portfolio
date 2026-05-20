import { describe, expect, it, vi } from 'vitest';
import { evaluatePullRequest, type Thread } from '@/scripts/check-pr-comments';

function mkThread(overrides: Partial<Thread> = {}): Thread {
  return {
    id: 'T_1',
    isResolved: true,
    resolvedBy: { login: 'reviewer' },
    comments: [{ author: { login: 'reviewer' }, body: 'lgtm' }],
    ...overrides,
  };
}

function mockGh(threads: Thread[], prAuthor = 'erikunha') {
  return vi.fn(async (_args: string[]) =>
    JSON.stringify({
      data: {
        repository: {
          pullRequest: {
            author: { login: prAuthor },
            reviewThreads: { nodes: threads },
          },
        },
      },
    }),
  );
}

describe('evaluatePullRequest', () => {
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
});
