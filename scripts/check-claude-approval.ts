#!/usr/bin/env tsx
// Usage: pnpm tsx scripts/check-claude-approval.ts [pr-number]
//
// Called by ready-to-merge.ts — not run directly in CI.
// Checks that the latest claude[bot] (/claude-review) overview verdict on the PR
// is Approve, and that the review was run against the CURRENT head commit.
// Exits 0 if approved-on-HEAD, 1 otherwise.
//
// Replaces the former Copilot gate (check-copilot-approval.ts): as of 2026-06-20
// claude-review is the sole AI reviewer. This gate is stronger than the old one —
// the old gate only checked that a Copilot review EXISTED; this one checks the
// VERDICT and that it is not stale against a newer head.
//
// This is an AI agent harness tool. The repo owner may merge at any time without
// running this check. Only AI agents are bound by the rule.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileP = promisify(execFile);
const CLAUDE_LOGIN = 'claude[bot]';

export type ClaudeVerdict = 'approve' | 'request-changes' | 'reject' | 'none';

// Parse the bold verdict line from a claude-review overview comment. Only a BOLD
// (`**…**`) verdict counts — prose mentioning "approve" must never be read as a
// verdict. Checked reject → request-changes → approve so the most-blocking wins.
export function parseClaudeVerdict(body: string): ClaudeVerdict {
  if (/\*\*[^*]*\breject\b[^*]*\*\*/i.test(body)) return 'reject';
  if (/\*\*[^*]*\brequest changes\b[^*]*\*\*/i.test(body)) return 'request-changes';
  if (/\*\*[^*]*\bapprove\b[^*]*\*\*/i.test(body)) return 'approve';
  return 'none';
}

// Extract the head SHA the review states it ran against. The overview format has
// varied ("Reviewed at head commit `sha`.", "Reviewed at HEAD `sha`.",
// "(head `sha`)"), so match a backticked 7-40 hex token right after "head".
export function extractReviewedSha(body: string): string | null {
  const sha = body.match(/\bhead\b(?:\s+commit)?\s*`([0-9a-f]{7,40})`/i)?.[1];
  return sha ? sha.toLowerCase() : null;
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

  const verdict = parseClaudeVerdict(latest.body);
  if (verdict === 'none') {
    fail(prNumber, 'Latest claude-review has no verdict yet (review in progress?). Wait for it.');
  }
  if (verdict === 'reject' || verdict === 'request-changes') {
    fail(prNumber, `Latest claude-review verdict is "${verdict}". Address findings and re-review.`);
  }

  // verdict === 'approve' — guard against a stale Approve on an older commit.
  const reviewedSha = extractReviewedSha(latest.body);
  if (reviewedSha && !headSha.startsWith(reviewedSha)) {
    fail(
      prNumber,
      `claude-review approved ${reviewedSha} but HEAD is ${headSha.slice(0, 12)} — STALE. ` +
        'Re-run `/claude-review` against the current head.',
    );
  }

  const shaNote = reviewedSha
    ? `on ${reviewedSha.slice(0, 12)}`
    : '(reviewed SHA unverified — not stated in overview)';
  process.stdout.write(`[claude-gate] OK (pr=${prNumber}, verdict=approve ${shaNote})\n`);
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

// Only run the gate when invoked directly, not when imported by the unit test.
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  run().catch((err) => {
    process.stderr.write(`[claude-gate] ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  });
}
