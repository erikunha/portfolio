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

export const REVIEWER_WORKFLOW = '.github/workflows/claude-review.yml';

export type ConvergeState = {
  prNumber: number;
  headSha: string;
  latestVerdictBody: string | null;
  threads: ConvergeThread[];
  /**
   * True when this PR changes the reviewer's own workflow. GitHub loads a
   * `pull_request` workflow from the PR head, so the action refuses and the auto
   * path can never post a verdict here — the guard skips and the job goes green
   * having reviewed nothing. Telling the author to "push, it reviews itself" in
   * that state is advice that never terminates.
   */
  editsReviewerWorkflow: boolean;
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
    const selfEdit = state.editsReviewerWorkflow
      ? ` This PR changes ${REVIEWER_WORKFLOW}, so the auto path CANNOT review it — the action refuses when the workflow differs from the default branch, and the guard skips. Comment /claude-review, which runs the default-branch copy. This is the one case where that comment is required.`
      : '';
    return {
      done: false,
      action: 'request-review',
      reason:
        verdict === 'none'
          ? `No parsable verdict from claude[bot] on this PR.${selfEdit || ' If a review is already running for this HEAD, wait for it — a /claude-review comment cancels the in-flight auto-run. Comment only if no run will fire.'}`
          : `Latest verdict is "${verdict}".${selfEdit || ' Fix the findings and push; the push triggers the review on its own.'}`,
      threadIds: [],
    };
  }

  if (!reviewedSha || !state.headSha.startsWith(reviewedSha)) {
    return {
      done: false,
      action: 'request-review',
      reason: `Approve is stale: reviewed ${reviewedSha ?? '(no SHA stated)'} but HEAD is ${state.headSha.slice(0, 12)}.${
        state.editsReviewerWorkflow
          ? ` This PR changes ${REVIEWER_WORKFLOW}, so only a /claude-review comment can refresh it.`
          : ' A push triggers a review on its own; comment /claude-review only if none will fire.'
      }`,
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
        pageInfo{ hasNextPage }
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
          pageInfo?: { hasNextPage?: boolean };
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

export type GhExec = (args: string[]) => Promise<string>;

const realGh: GhExec = async (args) => {
  const { stdout } = await execFileP('gh', args, { maxBuffer: 20 * 1024 * 1024 });
  return stdout;
};

export async function fetchState(
  owner: string,
  repo: string,
  prNumber: number,
  gh: GhExec = realGh,
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

  if (pr.reviewThreads?.pageInfo?.hasNextPage) {
    throw new Error(
      `PR #${prNumber} has more than 100 review threads. Converging on a truncated set would report "resolved" while unresolved threads sit past the page boundary, so this refuses rather than guessing.`,
    );
  }

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
    Array<{ user?: { login?: string }; body?: string; created_at?: string }>
  >;
  // Sorted by created_at rather than array position, matching how
  // check-claude-approval.ts picks the latest. The merge gate reading a
  // different comment than this loop is precisely the disagreement that sharing
  // its parsers was supposed to rule out.
  const claudeBodies = pages
    .flat()
    .filter((c) => c.user?.login === CLAUDE_LOGIN)
    .sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''))
    .map((c) => c.body ?? '');

  // No blanket catch, for the same reason main() below does not have one: a
  // swallowed failure here reads as "this PR does not edit the workflow", which
  // sends the caller back to "push, it reviews itself" — the never-terminating
  // advice editsReviewerWorkflow exists to prevent — with no sign the check
  // failed. Wrong-but-plausible is the worst state for this flag.
  let changed: string;
  try {
    changed = await gh(['pr', 'diff', String(prNumber), '--name-only']);
  } catch (err) {
    throw new Error(
      `could not read the changed files for PR #${prNumber}, so whether it edits ${REVIEWER_WORKFLOW} is unknown: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  return {
    prNumber,
    headSha: pr.headRefOid,
    editsReviewerWorkflow: changed
      .split('\n')
      .map((l) => l.trim())
      .includes(REVIEWER_WORKFLOW),
    latestVerdictBody: claudeBodies.length > 0 ? (claudeBodies.at(-1) ?? null) : null,
    threads,
  };
}

async function main(): Promise<void> {
  // A narrow catch, not a blanket one. `gh pr view` exits non-zero for the
  // ordinary "this branch has no PR yet" state AND for auth/rate-limit failures,
  // and the two must not collapse: swallowing both reports "nothing to converge"
  // for a lookup that never ran, and the hook calls this only after confirming a
  // PR IS open, so that reads as converged. Swallowing neither breaks the
  // standalone run this command exists for. So: recognise no-PR, rethrow the rest.
  let prRaw: string;
  try {
    prRaw = await realGh(['pr', 'view', '--json', 'number', '--jq', '.number']);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/no pull requests? found|no open pull requests?/i.test(msg)) {
      process.stdout.write('[review-converge] no open PR for this branch — nothing to converge.\n');
      return;
    }
    throw new Error(`could not determine whether this branch has an open PR: ${msg}`);
  }

  const prNumber = Number(prRaw.trim());
  if (!Number.isInteger(prNumber) || prNumber <= 0) {
    process.stdout.write('[review-converge] no open PR for this branch — nothing to converge.\n');
    return;
  }

  const repoRaw = await realGh([
    'repo',
    'view',
    '--json',
    'owner,name',
    '--jq',
    '.owner.login+"/"+.name',
  ]);
  const [owner, repo] = repoRaw.trim().split('/');
  if (!owner || !repo) throw new Error(`could not resolve owner/repo, got "${repoRaw.trim()}"`);

  const state = await fetchState(owner, repo, prNumber, realGh);
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
