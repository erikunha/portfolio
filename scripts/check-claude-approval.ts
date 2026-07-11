#!/usr/bin/env tsx

import { execFile } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

const execFileP = promisify(execFile);
const CLAUDE_LOGIN = 'claude[bot]';

export type ClaudeVerdict = 'approve' | 'request-changes' | 'reject' | 'none';

export function parseClaudeVerdict(body: string): ClaudeVerdict {
  if (/\*\*[^*]*\breject\b[^*]*\*\*/i.test(body)) return 'reject';
  if (/\*\*[^*]*\brequest changes\b[^*]*\*\*/i.test(body)) return 'request-changes';
  if (/\*\*[^*]*\bapprove\b[^*]*\*\*/i.test(body)) return 'approve';
  return 'none';
}

export function extractReviewedSha(body: string): string | null {
  const sha = body.match(/\bhead\b[^`\n]{0,24}`([0-9a-f]{7,40})`/i)?.[1];
  return sha ? sha.toLowerCase() : null;
}

export type GateResult = { ok: boolean; reason: string };

export function evaluateGate(
  verdict: ClaudeVerdict,
  reviewedSha: string | null,
  headSha: string,
): GateResult {
  if (verdict === 'none') return { ok: false, reason: 'no verdict yet (review in progress?)' };
  if (verdict === 'reject' || verdict === 'request-changes') {
    return { ok: false, reason: `verdict is "${verdict}" — address findings and re-review` };
  }
  if (!reviewedSha) {
    return {
      ok: false,
      reason:
        'approved, but the overview states no head SHA — cannot confirm the review is on HEAD',
    };
  }
  if (!headSha.startsWith(reviewedSha)) {
    return {
      ok: false,
      reason: `approved ${reviewedSha} but HEAD is ${headSha.slice(0, 12)} — STALE; re-run /claude-review`,
    };
  }
  return { ok: true, reason: `verdict=approve on ${reviewedSha.slice(0, 12)}` };
}

async function run() {
  const prNumber = await resolvePrNumber(process.argv[2]);

  const { stdout: repoOut } = await execFileP(
    'gh',
    ['repo', 'view', '--json', 'owner,name', '-q', '.owner.login + "/" + .name'],
    { encoding: 'utf8' },
  );
  const repo = repoOut.trim();

  const { stdout: headOut } = await execFileP(
    'gh',
    ['api', `repos/${repo}/pulls/${prNumber}`, '-q', '.head.sha'],
    { encoding: 'utf8' },
  );
  const headSha = headOut.trim().toLowerCase();

  const { stdout } = await execFileP(
    'gh',
    ['api', '--paginate', `repos/${repo}/issues/${prNumber}/comments`],
    { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 },
  );
  type IssueComment = { user: { login: string }; body: string; created_at: string };
  const comments = JSON.parse(stdout) as IssueComment[];
  const claudeComments = comments
    .filter((c) => c.user.login === CLAUDE_LOGIN)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const latest = claudeComments.at(-1);

  if (!latest) {
    fail(prNumber, 'No claude-review found. Comment `/claude-review` on the PR and wait for it.');
  }

  const result = evaluateGate(
    parseClaudeVerdict(latest.body),
    extractReviewedSha(latest.body),
    headSha,
  );
  if (!result.ok) {
    fail(prNumber, `${result.reason}.`);
  }
  process.stdout.write(`[claude-gate] OK (pr=${prNumber}, ${result.reason})\n`);
}

function fail(prNumber: number, msg: string): never {
  process.stderr.write(`[claude-gate] PR #${prNumber}: ${msg}\n`);
  process.exit(1);
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

if (
  typeof process.argv[1] === 'string' &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  run().catch((err) => {
    process.stderr.write(`[claude-gate] ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  });
}
