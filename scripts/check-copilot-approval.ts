#!/usr/bin/env tsx
// Usage: pnpm copilot-gate [pr-number]
//
// Verifies that copilot-pull-request-reviewer has reviewed the PR at least
// once. An empty thread list passes the unresolved-thread check but does NOT
// mean Copilot has reviewed — this gate catches that case.
//
// Exits 0 if a Copilot review exists, 1 if not.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileP = promisify(execFile);

const COPILOT_LOGIN = 'copilot-pull-request-reviewer';

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

type RestReview = { state: string; user: { login: string } };

async function main() {
  const prNumber = await resolvePrNumber(process.argv[2]);
  const { owner, repo } = await resolveOwnerRepo();

  const { stdout } = await execFileP(
    'gh',
    ['api', `repos/${owner}/${repo}/pulls/${prNumber}/reviews`],
    { encoding: 'utf8' },
  );

  const reviews: RestReview[] = JSON.parse(stdout) as RestReview[];
  const copilotReviews = reviews.filter((r) => r.user.login === COPILOT_LOGIN);

  if (copilotReviews.length === 0) {
    process.stderr.write(
      `COPILOT_GATE_FAIL: copilot-pull-request-reviewer has not reviewed PR #${prNumber}.\n`,
    );
    process.stderr.write(
      `  Request review: gh pr edit ${prNumber} --add-reviewer copilot-pull-request-reviewer\n`,
    );
    process.stderr.write('  Then wait for Copilot to review, address all threads, and re-run.\n');
    process.exit(1);
  }

  process.stdout.write(`Copilot review OK (pr=${prNumber}, reviews=${copilotReviews.length})\n`);
}

void main().catch((e) => {
  process.stderr.write(`COPILOT_GATE_FAIL code=unknown ${(e as Error).message}\n`);
  process.exit(2);
});
