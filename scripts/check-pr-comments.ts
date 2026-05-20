#!/usr/bin/env tsx
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileP = promisify(execFile);

export type Thread = {
  id: string;
  isResolved: boolean;
  resolvedBy: { login: string } | null;
  comments: Array<{ author: { login: string }; body: string }>;
};

export type Warning = { code: 'suspicious_self_resolve'; threadId: string };

export type EvalResult =
  | { ok: true; warnings: Warning[] }
  | {
      ok: false;
      code: 'unresolved_threads' | 'gh_auth_missing' | 'graphql_failure' | 'unknown';
      message: string;
      unresolvedThreads?: string[];
    };

export type GhExec = (args: string[]) => Promise<string>;

const QUERY = `query($owner:String!,$repo:String!,$pr:Int!){
  repository(owner:$owner,name:$repo){
    pullRequest(number:$pr){
      author{login}
      reviewThreads(first:100){
        nodes{
          id
          isResolved
          resolvedBy{login}
          comments(first:1){nodes{author{login} body}}
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
        reviewThreads: {
          nodes: Array<{
            id: string;
            isResolved: boolean;
            resolvedBy: { login: string } | null;
            comments: { nodes: Array<{ author: { login: string }; body: string }> };
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
    comments: t.comments.nodes,
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

  const warnings: Warning[] = threads
    .filter((t) => t.resolvedBy?.login === author)
    .map((t) => ({ code: 'suspicious_self_resolve' as const, threadId: t.id }));

  return { ok: true, warnings };
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
      process.stderr.write(`PR_GATE_FAIL code=${result.code} ${result.message}\n`);
      if (result.unresolvedThreads) {
        for (const id of result.unresolvedThreads) process.stderr.write(`  unresolved: ${id}\n`);
      }
      process.exit(1);
    }
    for (const w of result.warnings) {
      process.stderr.write(`PR_GATE_WARN code=${w.code} thread=${w.threadId}\n`);
    }
    process.stdout.write(`PR gate OK (pr=${prNumber}, warnings=${result.warnings.length})\n`);
    process.exit(0);
  } catch (e) {
    process.stderr.write(`PR_GATE_FAIL code=unknown ${(e as Error).message}\n`);
    process.exit(2);
  }
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) void main();
