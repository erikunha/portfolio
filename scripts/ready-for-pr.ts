#!/usr/bin/env tsx
// Usage: pnpm ready-for-pr [--skip-runtime]
//
// Pre-PR gate: verifies the branch is clean and sized correctly before
// `gh pr create`. Run this before opening any PR.
//
// Gates (in order):
//   1. pnpm ci:local      — lint + typecheck + content validate + tests
//   2. pnpm pr-size       — branch complexity; exits 1 if red (split required)
//   3. pnpm gates:runtime — build + server + LHCI + axe + E2E (skip with --skip-runtime)
//
// On pass: prints next-step reminder (visual check + auto-review).
// On fail: exits 1 with clear message about which gate failed.

import { execFileSync } from 'node:child_process';

const SKIP_RUNTIME = process.argv.includes('--skip-runtime');

const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  dim: '\x1b[2m',
};

process.stdout.write(`\n${C.bold}[ready-for-pr] Running pre-PR gates...${C.reset}\n\n`);

// Gate 1: full local CI
try {
  execFileSync('pnpm', ['ci:local'], { stdio: 'inherit' });
} catch {
  process.stderr.write(
    `\n${C.red}[ready-for-pr] FAIL${C.reset} — ci:local failed. Fix before opening PR.\n`,
  );
  process.exit(1);
}

// Gate 2: PR size
let sizeRed = false;
try {
  execFileSync('pnpm', ['pr-size'], { stdio: 'inherit' });
} catch {
  sizeRed = true;
}

if (sizeRed) {
  process.stderr.write(`\n${C.red}[ready-for-pr] FAIL${C.reset} — branch is too large (red).\n`);
  process.stderr.write(
    `${C.dim}  Open a PR now with completed milestones, continue remaining work on a new branch.${C.reset}\n`,
  );
  process.stderr.write(
    `${C.dim}  If you intentionally want to open a large PR, skip this gate and run gh pr create manually.${C.reset}\n\n`,
  );
  process.exit(1);
}

// Gate 3: runtime gates (build + server + LHCI + axe + E2E)
if (SKIP_RUNTIME) {
  process.stdout.write(`${C.yellow}[ready-for-pr] Gate 3 skipped (--skip-runtime).${C.reset}\n`);
} else {
  try {
    execFileSync('pnpm', ['gates:runtime'], { stdio: 'inherit' });
  } catch {
    process.stderr.write(
      `\n${C.red}[ready-for-pr] FAIL${C.reset} — gates:runtime failed. Fix Lighthouse/a11y/E2E before opening PR.\n`,
    );
    process.stderr.write(
      `${C.dim}  Run \`pnpm gates:runtime --skip-build\` after a fix to re-run without rebuilding.${C.reset}\n\n`,
    );
    process.exit(1);
  }
}

process.stdout.write(`\n${C.green}${C.bold}[ready-for-pr] OK${C.reset} — safe to open PR.\n`);
process.stdout.write(`\n${C.dim}Next steps before gh pr create:${C.reset}\n`);
process.stdout.write(
  `${C.dim}  1. Playwright visual check (desktop 1280×720 + mobile 375×812)${C.reset}\n`,
);
process.stdout.write(
  `${C.dim}  2. Run pr-review-toolkit:review-pr skill — address Critical/Important findings${C.reset}\n`,
);
process.stdout.write(
  `${C.dim}  3. gh pr create — fill EVERY section from .github/pull_request_template.md (run pnpm validate-pr-body <pr> after to confirm)${C.reset}\n`,
);
process.stdout.write(
  `${C.dim}  4. pnpm validate-pr-body <pr> — gate: fails if any template section is empty${C.reset}\n`,
);
process.stdout.write(
  `${C.dim}  5. gh pr edit <pr> --add-reviewer copilot-pull-request-reviewer${C.reset}\n\n`,
);
