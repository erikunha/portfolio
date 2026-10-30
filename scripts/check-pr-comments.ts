#!/usr/bin/env tsx
import { execFile } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { sanitizeSecrets } from './lib/sanitize-secrets';

const execFileP = promisify(execFile);

export type Thread = {
  id: string;
  isResolved: boolean;
  resolvedBy: { login: string } | null;
  comments: Array<{ author: { login: string } | null; body?: string }>;
};

export type Warning = { code: 'suspicious_self_resolve'; threadId: string };

export type ReplyLinkIssue = {
  code: 'reply_missing_commit_link' | 'reply_commit_unreachable';
  threadId: string;
  detail: string;
};

export type EvalResult =
  | { ok: true; warnings: Warning[] }
  | {
      ok: false;
      code:
        | 'unresolved_threads'
        | 'silent_resolve'
        | 'reply_missing_commit_link'
        | 'reply_commit_unreachable'
        | 'gh_auth_missing'
        | 'graphql_failure'
        | 'unknown';
      message: string;
      unresolvedThreads?: string[];
      offendingThreads?: string[];
    };

export type GhExec = (args: string[]) => Promise<string>;

const CLAUDE_BOT_LOGINS = new Set(['claude[bot]', 'claude']);
const FIX_CLAIM_PATTERN =
  /\b(fixed|fixes|addressed|done|changed|resolved|implemented|updated|patched)\b/i;
const NEGATION_PATTERN =
  /(n't|\b(?:no|not|never|none|nothing|neither|nor|without|unable|unnecessary|unneeded)\b)/i;
const CLAUSE_SPLIT_PATTERN = /[.!?;\n]+|,\s+/;
const FULL_SHA_LENGTH = 40;
const MIN_SHORT_SHA_LENGTH = 7;
const COMMIT_LINK_PATTERN = new RegExp(
  `\\[\\x60?([0-9a-fA-F]{${MIN_SHORT_SHA_LENGTH},${FULL_SHA_LENGTH}})\\x60?\\]\\(\\s*https:\\/\\/github\\.com\\/([^/\\s)]+)\\/([^/\\s)]+)\\/pull\\/(\\d+)\\/commits\\/([0-9a-fA-F]{${FULL_SHA_LENGTH}})\\s*\\)`,
  'g',
);
const COMPARE_STATUS_IDENTICAL = 'identical';
const COMPARE_STATUS_AHEAD = 'ahead';

const QUERY = `query($owner:String!,$repo:String!,$pr:Int!){
  repository(owner:$owner,name:$repo){
    pullRequest(number:$pr){
      author{login}
      headRefOid
      headRepository{nameWithOwner}
      reviewThreads(first:100){
        nodes{
          id
          isResolved
          resolvedBy{login}
          comments(first:100){nodes{author{login} body}}
        }
      }
    }
  }
}`;

type GraphQLEnvelope = {
  data?: {
    repository?: {
      pullRequest?: {
        author: { login: string };
        headRefOid: string | null;
        headRepository: { nameWithOwner: string } | null;
        reviewThreads: {
          nodes: Array<{
            id: string;
            isResolved: boolean;
            resolvedBy: { login: string } | null;
            comments: { nodes: Array<{ author: { login: string } | null; body: string }> };
          }>;
        };
      };
    };
  };
  errors?: Array<{ message: string }>;
};

export async function evaluatePullRequest(opts: {
  prNumber: number;
  owner: string;
  repo: string;
  ghExec: GhExec;
}): Promise<EvalResult> {
  let raw: string;
  try {
    raw = await opts.ghExec([
      'api',
      'graphql',
      '-f',
      `query=${QUERY}`,
      '-F',
      `owner=${opts.owner}`,
      '-F',
      `repo=${opts.repo}`,
      '-F',
      `pr=${opts.prNumber}`,
    ]);
  } catch (e) {
    const msg = (e as Error).message ?? String(e);
    if (/auth|login|token/i.test(msg)) {
      return { ok: false, code: 'gh_auth_missing', message: msg };
    }
    return { ok: false, code: 'unknown', message: msg };
  }

  let envelope: GraphQLEnvelope;
  try {
    envelope = JSON.parse(raw) as GraphQLEnvelope;
  } catch (e) {
    return {
      ok: false,
      code: 'graphql_failure',
      message: `non-JSON gh output: ${(e as Error).message}`,
    };
  }

  if (envelope.errors && envelope.errors.length > 0) {
    return {
      ok: false,
      code: 'graphql_failure',
      message: envelope.errors.map((x) => x.message).join('; '),
    };
  }

  const pr = envelope.data?.repository?.pullRequest;
  if (!pr) {
    return { ok: false, code: 'graphql_failure', message: 'pullRequest not found in response' };
  }

  const author = pr.author.login;
  const threads: Thread[] = pr.reviewThreads.nodes.map((t) => ({
    id: t.id,
    isResolved: t.isResolved,
    resolvedBy: t.resolvedBy,
    comments: t.comments.nodes.map((c) => ({ author: c.author, body: c.body })),
  }));

  const unresolved = threads.filter((t) => !t.isResolved).map((t) => t.id);
  if (unresolved.length > 0) {
    return {
      ok: false,
      code: 'unresolved_threads',
      message: `${unresolved.length} unresolved review thread(s) on PR #${opts.prNumber}: ${unresolved.join(', ')}`,
      unresolvedThreads: unresolved,
    };
  }

  const silent = threads.filter((t) => t.comments.length < 2).map((t) => t.id);
  if (silent.length > 0) {
    return {
      ok: false,
      code: 'silent_resolve',
      message: `${silent.length} resolved thread(s) on PR #${opts.prNumber} carry only the finding and no reply: ${silent.join(', ')}. Reply with a link to the fix commit, then resolve.`,
      unresolvedThreads: silent,
    };
  }

  const headSha = pr.headRefOid;
  const headRepo = pr.headRepository?.nameWithOwner ?? `${opts.owner}/${opts.repo}`;
  const replyIssues: ReplyLinkIssue[] = [];
  for (const thread of threads) {
    if (!thread.comments.some((c) => isBotLogin(c.author?.login))) continue;
    for (const comment of thread.comments) {
      if (comment.author?.login !== author) continue;
      const body = comment.body ?? '';
      if (!claimsFix(body)) continue;
      const links = extractCommitLinks(body).filter((l) =>
        isWellFormedLink(l, { owner: opts.owner, repo: opts.repo, prNumber: opts.prNumber }),
      );
      if (links.length === 0) {
        replyIssues.push({
          code: 'reply_missing_commit_link',
          threadId: thread.id,
          detail: `reply claims a fix but carries no commit link: "${truncate(body)}"`,
        });
        continue;
      }
      for (const link of links) {
        const reachability = await isAncestorOfHead({
          sha: link.sha,
          headSha,
          repoFullName: headRepo,
          ghExec: opts.ghExec,
        });
        if (reachability.authFailure) {
          return { ok: false, code: 'gh_auth_missing', message: reachability.detail };
        }
        if (!reachability.reachable) {
          replyIssues.push({
            code: 'reply_commit_unreachable',
            threadId: thread.id,
            detail: `commit ${link.sha} is not an ancestor of the PR head (${headSha ?? 'unknown'}): ${reachability.detail}`,
          });
        }
      }
    }
  }

  if (replyIssues.length > 0) {
    const missing = replyIssues.filter((i) => i.code === 'reply_missing_commit_link');
    const reported = missing.length > 0 ? missing : replyIssues;
    const code = reported[0]?.code ?? 'reply_missing_commit_link';
    const ids = [...new Set(reported.map((i) => i.threadId))];
    return {
      ok: false,
      code,
      message: `${reported.length} fix-claiming repl${reported.length === 1 ? 'y' : 'ies'} on PR #${opts.prNumber} do not carry a reachable commit link: ${ids.join(', ')}. ${reported.map((i) => i.detail).join(' | ')}. Required form: [\`<short-sha>\`](https://github.com/${opts.owner}/${opts.repo}/pull/${opts.prNumber}/commits/<full-sha>), where the commit is an ancestor of the PR head. A reply explaining why no change was made needs no link.`,
      offendingThreads: ids,
    };
  }

  const warnings: Warning[] = threads
    .filter((t) => t.resolvedBy?.login === author)
    .map((t) => ({ code: 'suspicious_self_resolve' as const, threadId: t.id }));

  return { ok: true, warnings };
}

function isBotLogin(login: string | null | undefined): boolean {
  return login !== null && login !== undefined && CLAUDE_BOT_LOGINS.has(login.toLowerCase());
}

export type CommitLink = {
  label: string;
  owner: string;
  repo: string;
  pr: number;
  sha: string;
};

export function extractCommitLinks(body: string): CommitLink[] {
  const links: CommitLink[] = [];
  for (const match of body.matchAll(COMMIT_LINK_PATTERN)) {
    const [, label, owner, repo, pr, sha] = match;
    if (!label || !owner || !repo || !pr || !sha) continue;
    links.push({
      label,
      owner,
      repo,
      pr: Number(pr),
      sha: sha.toLowerCase(),
    });
  }
  return links;
}

function isWellFormedLink(
  link: CommitLink,
  ctx: { owner: string; repo: string; prNumber: number },
): boolean {
  if (link.owner.toLowerCase() !== ctx.owner.toLowerCase()) return false;
  if (link.repo.toLowerCase() !== ctx.repo.toLowerCase()) return false;
  if (link.pr !== ctx.prNumber) return false;
  if (link.label.length < MIN_SHORT_SHA_LENGTH) return false;
  return link.sha.startsWith(link.label.toLowerCase());
}

export function claimsFix(body: string): boolean {
  return body
    .split(CLAUSE_SPLIT_PATTERN)
    .map((clause) => clause.trim())
    .filter((clause) => clause.length > 0)
    .some((clause) => {
      const claim = FIX_CLAIM_PATTERN.exec(clause);
      if (!claim) return false;
      const negation = NEGATION_PATTERN.exec(clause);
      const negatedBeforeClaim = negation !== null && negation.index < claim.index;
      return !negatedBeforeClaim;
    });
}

async function isAncestorOfHead(opts: {
  sha: string;
  headSha: string | null;
  repoFullName: string;
  ghExec: GhExec;
}): Promise<{ reachable: boolean; detail: string; authFailure?: boolean }> {
  if (!opts.headSha) {
    return { reachable: false, detail: 'the PR head SHA was not returned by the API' };
  }
  const path = `repos/${opts.repoFullName}/compare/${opts.sha}...${opts.headSha}`;
  try {
    const raw = await opts.ghExec(['api', path]);
    const parsed = JSON.parse(raw) as { status?: string; behind_by?: number };
    const status = parsed.status;
    const behindBy = parsed.behind_by;
    const notBehind = behindBy === undefined || behindBy === 0;
    if (status === COMPARE_STATUS_IDENTICAL || (status === COMPARE_STATUS_AHEAD && notBehind)) {
      return { reachable: true, detail: `compare status=${status}` };
    }
    return {
      reachable: false,
      detail: `compare status=${status ?? 'unknown'} behind_by=${behindBy ?? 'unknown'}`,
    };
  } catch (e) {
    const msg = (e as Error).message ?? String(e);
    if (/auth|login|token/i.test(msg)) {
      return { reachable: false, detail: msg, authFailure: true };
    }
    return { reachable: false, detail: `compare request failed: ${msg}` };
  }
}

function truncate(body: string, max = 120): string {
  const flat = body.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max)}...` : flat;
}

async function defaultGhExec(args: string[]): Promise<string> {
  const { stdout } = await execFileP('gh', args, { encoding: 'utf8' });
  return stdout;
}

async function resolvePrNumber(passed: string | undefined): Promise<number> {
  if (passed && /^\d+$/.test(passed)) return Number(passed);
  const { stdout } = await execFileP('gh', ['pr', 'view', '--json', 'number', '-q', '.number'], {
    encoding: 'utf8',
  });
  const n = Number(stdout.trim());
  if (!Number.isFinite(n)) throw new Error('could not infer PR number from current branch');
  return n;
}

async function resolveOwnerRepo(): Promise<{ owner: string; repo: string }> {
  const { stdout } = await execFileP(
    'gh',
    ['repo', 'view', '--json', 'owner,name', '-q', '.owner.login + "/" + .name'],
    { encoding: 'utf8' },
  );
  const [owner, repo] = stdout.trim().split('/');
  if (!owner || !repo) throw new Error('could not resolve owner/repo from gh');
  return { owner, repo };
}

async function main() {
  try {
    const prNumber = await resolvePrNumber(process.argv[2]);
    const { owner, repo } = await resolveOwnerRepo();
    const result = await evaluatePullRequest({ prNumber, owner, repo, ghExec: defaultGhExec });
    if (!result.ok) {
      process.stderr.write(sanitizeSecrets(`PR_GATE_FAIL code=${result.code} ${result.message}\n`));
      if (result.unresolvedThreads) {
        for (const id of result.unresolvedThreads) process.stderr.write(`  unresolved: ${id}\n`);
      }
      if (result.offendingThreads) {
        for (const id of result.offendingThreads) process.stderr.write(`  thread: ${id}\n`);
      }
      process.exit(1);
    }
    for (const w of result.warnings) {
      if (process.env.GITHUB_ACTIONS === 'true') {
        process.stderr.write(
          sanitizeSecrets(
            `::warning title=PR review thread self-resolved::PR author resolved their own review thread (id=${w.threadId}). Verify the underlying issue was actually addressed.\n`,
          ),
        );
      } else {
        process.stderr.write(sanitizeSecrets(`PR_GATE_WARN code=${w.code} thread=${w.threadId}\n`));
      }
    }
    process.stdout.write(`PR gate OK (pr=${prNumber}, warnings=${result.warnings.length})\n`);
    process.exit(0);
  } catch (e) {
    process.stderr.write(sanitizeSecrets(`PR_GATE_FAIL code=unknown ${(e as Error).message}\n`));
    process.exit(2);
  }
}

const isMain =
  typeof process.argv[1] === 'string' && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) void main();
