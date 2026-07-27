#!/usr/bin/env tsx

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

try {
  execFileSync('pnpm', ['ci:local'], { stdio: 'inherit' });
} catch {
  process.stderr.write(
    `\n${C.red}[ready-for-pr] FAIL${C.reset} — ci:local failed. Fix before opening PR.\n`,
  );
  process.exit(1);
}

try {
  execFileSync('pnpm', ['bundle-check'], { stdio: 'inherit' });
} catch {
  process.stderr.write(
    `\n${C.red}[ready-for-pr] FAIL${C.reset} — bundle-check failed. Reduce chunk sizes before opening PR.\n`,
  );
  process.exit(1);
}

try {
  execFileSync('pnpm', ['route-js-check'], { stdio: 'inherit' });
} catch {
  process.stderr.write(
    `\n${C.red}[ready-for-pr] FAIL${C.reset} — route-js-check failed. A route is over its total or app-owned JS budget.\n`,
  );
  process.exit(1);
}

if (SKIP_RUNTIME) {
  process.stdout.write(
    `${C.yellow}[ready-for-pr] Runtime gates skipped (--skip-runtime).${C.reset}\n`,
  );
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
process.stdout.write(`\n${C.dim}Before gh pr create:${C.reset}\n`);
process.stdout.write(
  `${C.dim}  1. Playwright visual check (desktop 1280×720 + mobile 375×812)${C.reset}\n`,
);
process.stdout.write(
  `${C.dim}  2. Dispatch pr-review-toolkit:code-reviewer — address Critical/Important findings${C.reset}\n`,
);
process.stdout.write(
  `${C.dim}  3. gh pr create — fill EVERY section from .github/pull_request_template.md${C.reset}\n`,
);
process.stdout.write(`\n${C.dim}After gh pr create:${C.reset}\n`);
process.stdout.write(
  `${C.dim}  4. pnpm validate-pr-body <pr> — gate: fails if any template section is empty${C.reset}\n`,
);
process.stdout.write(
  `${C.dim}  5. Do NOT comment /claude-review — gh pr create already triggered it${C.reset}\n` +
    `${C.dim}     (a comment cancels the run; except on a claude-review.yml edit). Poll: pnpm review:converge${C.reset}\n\n`,
);
