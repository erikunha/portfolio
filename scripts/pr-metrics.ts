#!/usr/bin/env tsx

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileP = promisify(execFile);

const CLAUDE_REVIEW_TRIGGER = /^\s*\/claude-review\s*$/m;

interface PrJson {
  number: number;
  additions: number;
  deletions: number;
  createdAt: string;
  title: string;
}

interface IssueComment {
  body: string;
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

async function resolveRepo(): Promise<string> {
  const { stdout } = await execFileP(
    'gh',
    ['repo', 'view', '--json', 'owner,name', '-q', '.owner.login + "/" + .name'],
    { encoding: 'utf8' },
  );
  return stdout.trim();
}

async function run() {
  const prNumber = await resolvePrNumber(process.argv[2]);
  const repo = await resolveRepo();

  const { stdout: prOut } = await execFileP(
    'gh',
    ['pr', 'view', prNumber.toString(), '--json', 'number,additions,deletions,createdAt,title'],
    { encoding: 'utf8' },
  );
  const pr = JSON.parse(prOut) as PrJson;

  const { stdout: commentsOut } = await execFileP(
    'gh',
    ['api', `repos/${repo}/issues/${prNumber}/comments`, '--paginate'],
    { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 },
  );
  const comments = JSON.parse(commentsOut) as IssueComment[];

  const claudeReviewTriggers = comments.filter((c) => CLAUDE_REVIEW_TRIGGER.test(c.body));
  const cycleCount = claudeReviewTriggers.length;

  const daysOpen = Math.floor(
    (Date.now() - new Date(pr.createdAt).getTime()) / (1000 * 60 * 60 * 24),
  );
  const totalLines = pr.additions + pr.deletions;

  const C = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    yellow: '\x1b[33m',
    green: '\x1b[32m',
    dim: '\x1b[2m',
  };

  process.stdout.write(`\n${C.bold}[pr-metrics] PR #${prNumber}${C.reset}\n`);
  process.stdout.write(`  Title:  ${pr.title}\n`);
  process.stdout.write(
    `  Size:   ${C.bold}+${pr.additions}${C.reset} / ${C.bold}-${pr.deletions}${C.reset} (${totalLines} total lines)\n`,
  );
  process.stdout.write(`  Open:   ${daysOpen} day(s)\n`);

  const cycleLabel =
    cycleCount === 0
      ? `${C.dim}0 — not yet requested${C.reset}`
      : cycleCount === 1
        ? `${C.green}1 (initial review)${C.reset}`
        : cycleCount === 2
          ? `${C.yellow}2 (one re-request)${C.reset}`
          : `${C.yellow}${cycleCount} (${cycleCount - 1} re-request(s))${C.reset}`;

  process.stdout.write(`  claude-review cycles: ${cycleLabel}\n`);

  if (cycleCount > 2) {
    process.stdout.write(
      `\n  ${C.yellow}⚠ ${cycleCount} claude-review cycles — more than 2 cycles signals that thinking-risk-premortem\n` +
        `    or TDD failed upstream. Bugs reached review that should have been caught earlier.${C.reset}\n`,
    );
  }

  process.stdout.write('\n');
}

run().catch((err) => {
  process.stderr.write(`[pr-metrics] ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
