#!/usr/bin/env tsx
// Usage: pnpm ready-to-merge [pr-number]
//
// Pre-merge wrapper: runs the local CI chain (lint + typecheck + content
// validate + client-naming + tests), the branch-protection gate, then the
// PR comment gate. PR number is optional — when omitted, `check-pr-comments.ts`
// infers it from the current branch via `gh pr view`.
//
// Why the branch-protection check lives here and NOT in CI:
//   The GitHub Actions GITHUB_TOKEN cannot read the
//   `/branches/{branch}/protection` endpoint — it requires repo-admin token
//   power (a PAT or GitHub App installation token), and `administration` is
//   not even a grantable GITHUB_TOKEN permission. Run locally, `gh` carries
//   the developer's own admin auth, so the check verifiably activates here.
//   See DECISIONS.md (audit standard #4: no dead-code security theater).
//
// Why a wrapper script vs. a direct pnpm chain:
//   pnpm ready-to-merge 42  →  pnpm interprets `42` as a pnpm flag, not a
//   script arg. The standard pnpm workaround is `pnpm ready-to-merge -- 42`
//   but that's a footgun: omitting `--` silently passes nothing through
//   and check-pr-comments.ts auto-infers from branch (which may be the
//   wrong PR). This wrapper makes positional args work natively.

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

const gateArgs = ['tsx', 'scripts/check-pr-comments.ts', ...(prNumber ? [prNumber] : [])];
try {
  execFileSync('pnpm', gateArgs, { stdio: 'inherit' });
} catch {
  process.exit(1);
}

process.stdout.write('\n[ready-to-merge] OK — safe to gh pr merge.\n');
