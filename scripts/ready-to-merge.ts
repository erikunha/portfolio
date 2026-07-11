#!/usr/bin/env tsx

import { execFileSync } from 'node:child_process';

const prNumber = process.argv[2];

try {
  execFileSync('pnpm', ['ci:local'], { stdio: 'inherit' });
} catch {
  process.stderr.write('\n[ready-to-merge] ci:local failed — fix before re-running.\n');
  process.exit(1);
}

try {
  execFileSync('pnpm', ['tsx', 'scripts/check-branch-protection.ts', 'main'], {
    stdio: 'inherit',
  });
} catch {
  process.stderr.write('\n[ready-to-merge] branch-protection check failed. See message above.\n');
  process.exit(1);
}

const claudeArgs = ['tsx', 'scripts/check-claude-approval.ts', ...(prNumber ? [prNumber] : [])];
try {
  execFileSync('pnpm', claudeArgs, { stdio: 'inherit' });
} catch {
  process.stderr.write('\n[ready-to-merge] claude-review gate failed. See message above.\n');
  process.exit(1);
}

const gateArgs = ['tsx', 'scripts/check-pr-comments.ts', ...(prNumber ? [prNumber] : [])];
try {
  execFileSync('pnpm', gateArgs, { stdio: 'inherit' });
} catch {
  process.exit(1);
}

try {
  execFileSync('pnpm', ['tsx', 'scripts/pr-metrics.ts', ...(prNumber ? [prNumber] : [])], {
    stdio: 'inherit',
  });
  // biome-ignore lint/suspicious/noEmptyBlockStatements: intentional no-op
} catch {}

process.stdout.write('\n[ready-to-merge] OK — safe to gh pr merge.\n');
