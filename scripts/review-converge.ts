#!/usr/bin/env tsx
import { execFile } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import {
  CLAUDE_LOGIN,
  type ClaudeVerdict,
  extractReviewedSha,
  parseClaudeVerdict,
} from './check-claude-approval';

const execFileP = promisify(execFile);

export const MIN_COMMENTS_PER_RESOLVED_THREAD = 2;

export type ConvergeThread = {
  id: string;
  path: string | null;
  isResolved: boolean;
  commentCount: number;
};

export type ConvergeState = {
  prNumber: number;
  headSha: string;
  latestVerdictBody: string | null;
  threads: ConvergeThread[];
};

export type ConvergeAction =
  | 'reply-then-resolve'
  | 'add-missing-reply'
  | 'request-review'
  | 'converged';

export type ConvergeStep = {
  done: boolean;
  action: ConvergeAction;
  reason: string;
  threadIds: string[];
};

/**
 * Ordered because the steps are not commutative: re-requesting a review before
 * the threads are answered spends a review cycle on a state the author has not
 * finished responding to, and resolving before replying destroys the only
 * record connecting a finding to its fix.
 */
export function nextStep(state: ConvergeState): ConvergeStep {
  const unresolved = state.threads.filter((t) => !t.isResolved);
  if (unresolved.length > 0) {
    return {
      done: false,
      action: 'reply-then-resolve',
      reason: `${unresolved.length} unresolved thread(s). Reply in each citing the fix SHA, then resolve. Never resolve silently.`,
      threadIds: unresolved.map((t) => t.id),
    };
  }

  const silent = state.threads.filter(
    (t) => t.isResolved && t.commentCount < MIN_COMMENTS_PER_RESOLVED_THREAD,
  );
  if (silent.length > 0) {
    return {
      done: false,
      action: 'add-missing-reply',
      reason: `${silent.length} thread(s) resolved with a single comment, which means the fix was never recorded against the finding. Add the missing reply.`,
      threadIds: silent.map((t) => t.id),
    };
  }

  const verdict: ClaudeVerdict = state.latestVerdictBody
    ? parseClaudeVerdict(state.latestVerdictBody)
    : 'none';
  const reviewedSha = state.latestVerdictBody ? extractReviewedSha(state.latestVerdictBody) : null;

  if (verdict !== 'approve') {
    return {
      done: false,
      action: 'request-review',
      reason:
        verdict === 'none'
          ? 'No parsable verdict from claude[bot] on this PR. Comment /claude-review.'
          : `Latest verdict is "${verdict}". Fix the findings, then comment /claude-review.`,
      threadIds: [],
    };
  }

  if (!reviewedSha || !state.headSha.startsWith(reviewedSha)) {
    return {
      done: false,
      action: 'request-review',
      reason: `Approve is stale: reviewed ${reviewedSha ?? '(no SHA stated)'} but HEAD is ${state.headSha.slice(0, 12)}. Comment /claude-review.`,
      threadIds: [],
    };
  }

  return {
    done: true,
    action: 'converged',
    reason: `Approve on ${state.headSha.slice(0, 12)}, every thread resolved with a reply.`,
    threadIds: [],
  };
}

const THREADS_QUERY = `query($owner:String!,$repo:String!,$pr:Int!){
  repository(owner:$owner,name:$repo){
    pullRequest(number:$pr){
      headRefOid
      reviewThreads(first:100){
        nodes{
          id
          isResolved
          comments(first:100){ totalCount nodes{ path } }
        }
      }
    }
  }
}`;

type ThreadsEnvelope = {
  data?: {
    repository?: {
      pullRequest?: {
        headRefOid?: string;
        reviewThreads?: {
          nodes?: Array<{
            id: string;
            isResolved: boolean;
            comments?: { totalCount?: number; nodes?: Array<{ path?: string }> };
          }>;
        };
      };
    };
  };
};

async function gh(args: string[]): Promise<string> {
  const { stdout } = await execFileP('gh', args, { maxBuffer: 20 * 1024 * 1024 });
  return stdout;
}

export async function fetchState(
  owner: string,
  repo: string,
  prNumber: number,
): Promise<ConvergeState> {
  const raw = await gh([
    'api',
    'graphql',
    '-f',
    `query=${THREADS_QUERY}`,
    '-F',
    `owner=${owner}`,
    '-F',
    `repo=${repo}`,
    '-F',
    `pr=${prNumber}`,
  ]);
  const pr = (JSON.parse(raw) as ThreadsEnvelope).data?.repository?.pullRequest;
  if (!pr?.headRefOid) throw new Error(`could not read PR #${prNumber} head SHA from GraphQL`);

  const threads: ConvergeThread[] = (pr.reviewThreads?.nodes ?? []).map((n) => ({
    id: n.id,
    path: n.comments?.nodes?.[0]?.path ?? null,
    isResolved: n.isResolved,
    commentCount: n.comments?.totalCount ?? 0,
  }));

  const commentsRaw = await gh([
    'api',
    '--paginate',
    '--slurp',
    `repos/${owner}/${repo}/issues/${prNumber}/comments`,
  ]);
  const pages = JSON.parse(commentsRaw) as Array<
    Array<{ user?: { login?: string }; body?: string }>
  >;
  const claudeBodies = pages
    .flat()
    .filter((c) => c.user?.login === CLAUDE_LOGIN)
    .map((c) => c.body ?? '');

  return {
    prNumber,
    headSha: pr.headRefOid,
    latestVerdictBody: claudeBodies.length > 0 ? (claudeBodies.at(-1) ?? null) : null,
    threads,
  };
}

async function main(): Promise<void> {
  const prRaw = await gh(['pr', 'view', '--json', 'number', '--jq', '.number']).catch(() => '');
  const prNumber = Number(prRaw.trim());
  if (!Number.isInteger(prNumber) || prNumber <= 0) {
    process.stdout.write('[review-converge] no open PR for this branch — nothing to converge.\n');
    return;
  }

  const repoRaw = await gh([
    'repo',
    'view',
    '--json',
    'owner,name',
    '--jq',
    '.owner.login+"/"+.name',
  ]);
  const [owner, repo] = repoRaw.trim().split('/');
  if (!owner || !repo) throw new Error(`could not resolve owner/repo, got "${repoRaw.trim()}"`);

  const state = await fetchState(owner, repo, prNumber);
  const step = nextStep(state);

  if (step.done) {
    process.stdout.write(`[review-converge] OK — ${step.reason}\n`);
    return;
  }

  process.stderr.write(`\n[review-converge] NOT CONVERGED — PR #${prNumber}\n`);
  process.stderr.write(`  ${step.reason}\n`);
  if (step.threadIds.length > 0) {
    for (const t of step.threadIds) {
      const thread = state.threads.find((x) => x.id === t);
      process.stderr.write(`    ${t}${thread?.path ? ` (${thread.path})` : ''}\n`);
    }
  }
  process.stderr.write('  See .claude/skills/review-convergence for the loop.\n\n');
  process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err: unknown) => {
    process.stderr.write(`[review-converge] ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  });
}
