#!/usr/bin/env tsx
// Usage: pnpm tsx scripts/check-copilot-approval.ts [pr-number]
//
// Called by ready-to-merge.ts — not run directly in CI.
// Checks that copilot-pull-request-reviewer has reviewed the PR.
// Exits 0 if Copilot has reviewed, 1 if not.
//
// This is an AI agent harness tool. The repo owner may merge at any time
// without running this check. Only AI agents are bound by the rule.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileP = promisify(execFile);
const COPILOT_LOGIN = 'copilot-pull-request-reviewer[bot]';

async function run() {
  const passed = process.argv[2];

  const prNumber = await resolvePrNumber(passed);

  const { stdout: repoOut } = await execFileP(
    'gh',
    ['repo', 'view', '--json', 'owner,name', '-q', '.owner.login + "/" + .name'],
    { encoding: 'utf8' },
  );
  const repo = repoOut.trim();

  const { stdout } = await execFileP('gh', ['api', `repos/${repo}/pulls/${prNumber}/reviews`], {
    encoding: 'utf8',
  });

  type RestReview = { user: { login: string }; state: string };
  const reviews = JSON.parse(stdout) as RestReview[];
  const copilotReviews = reviews.filter((r) => r.user.login === COPILOT_LOGIN);

  if (copilotReviews.length === 0) {
    process.stderr.write(
      `[copilot-gate] No review found from ${COPILOT_LOGIN} on PR #${prNumber}.\n`,
    );
    process.stderr.write(
      `  Request review: gh pr edit ${prNumber} --add-reviewer copilot-pull-request-reviewer\n`,
    );
    process.stderr.write('  Then wait for Copilot to review, address all threads, and re-run.\n');
    process.exit(1);
  }

  process.stdout.write(`[copilot-gate] OK (pr=${prNumber}, reviews=${copilotReviews.length})\n`);
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

run().catch((err) => {
  process.stderr.write(`[copilot-gate] ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
