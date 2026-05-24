#!/usr/bin/env tsx
// scripts/gates-runtime.ts
//
// Runs server-dependent quality gates locally — mirrors CI's performance and
// e2e-functional jobs so regressions surface before push, not after.
//
// Gates (in order):
//   1. Build          — pnpm build (skip with --skip-build if .next/ is fresh)
//   2. Server start   — pnpm start on :3000 with DEPLOY_SALT
//   3. LHCI desktop   — 1 run on localhost:3000, thresholds from lighthouserc.json
//   4. LHCI mobile    — 1 run on localhost:3000, thresholds from lighthouserc.mobile.json
//   5. axe-core       — playwright tests/a11y --project=chromium
//   6. E2E functional — cross-cutting + observability-smoke, chromium only
//
// Skipped locally (CI handles):
//   - Visual regression (Linux Chromium baselines; use playwright MCP for manual check)
//   - AI eval (requires live API keys + Upstash)
//   - WebKit matrix (non-deterministic pixel rendering; not a required gate)
//   - LHCI multi-URL (6 URLs × 3 runs in CI; lean 1 URL × 1 run locally)
//
// Usage:
//   pnpm gates:runtime              — full run including build
//   pnpm gates:runtime --skip-build — reuse existing .next/ (must exist)

import { type ChildProcess, execFileSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

const SKIP_BUILD = process.argv.includes('--skip-build');
const PORT = 3000;

const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
};

const log = (s: string) => process.stdout.write(`${s}\n`);
const step = (s: string) => log(`\n${C.bold}[gates:runtime]${C.reset} ${s}...`);
const pass = (s: string) => log(`${C.green}  ✓${C.reset} ${s}`);
const skipStep = (s: string) => log(`${C.yellow}  – ${s}${C.reset}`);

log(`\n${C.bold}[gates:runtime] Server-dependent quality gates${C.reset}\n`);

let server: ChildProcess | null = null;
let exitCode = 0;

function cleanup() {
  if (server) {
    server.kill('SIGTERM');
    server = null;
  }
}

process.on('exit', cleanup);
process.on('SIGINT', () => {
  cleanup();
  process.exit(130);
});
process.on('SIGTERM', () => {
  cleanup();
  process.exit(143);
});

function run(label: string, file: string, args: string[], env?: NodeJS.ProcessEnv) {
  step(label);
  execFileSync(file, args, { stdio: 'inherit', env: { ...process.env, ...env } });
  pass(label);
}

function gate(label: string, file: string, args: string[], env?: NodeJS.ProcessEnv) {
  try {
    run(label, file, args, env);
  } catch {
    process.stderr.write(`${C.red}  ✗ ${label} failed${C.reset}\n`);
    exitCode = 1;
  }
}

// ── Gate 1: Build ─────────────────────────────────────────────────────────────

if (SKIP_BUILD) {
  if (!existsSync('.next')) {
    process.stderr.write(
      `${C.red}--skip-build: .next/ not found. Run without the flag first.${C.reset}\n`,
    );
    process.exit(1);
  }
  skipStep('Build skipped (--skip-build). Using existing .next/');
} else {
  run('Build', 'pnpm', ['build'], {
    DEPLOY_SALT: 'local-gates',
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? '',
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL ?? '',
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN ?? '',
    RESEND_API_KEY: process.env.RESEND_API_KEY ?? '',
  });
}

// ── Start server ──────────────────────────────────────────────────────────────

step('Starting production server');
server = spawn('pnpm', ['start'], {
  env: { ...process.env, DEPLOY_SALT: 'local-gates' },
  stdio: 'pipe',
});
server.on('error', (err) => {
  process.stderr.write(`${C.red}Server failed to start: ${err.message}${C.reset}\n`);
  cleanup();
  process.exit(1);
});

run('Wait for server', 'npx', [
  '--yes',
  'wait-on',
  `http://localhost:${PORT}`,
  '--timeout',
  '30000',
]);

// ── Gate 2: Lighthouse desktop ────────────────────────────────────────────────

gate('Lighthouse CI — desktop', 'pnpm', [
  'exec',
  'lhci',
  'autorun',
  `--collect.url=http://localhost:${PORT}`,
  '--collect.numberOfRuns=1',
  '--upload.target=filesystem',
  '--upload.outputDir=.lhci-local/desktop',
]);

// ── Gate 3: Lighthouse mobile ─────────────────────────────────────────────────

gate('Lighthouse CI — mobile', 'pnpm', [
  'exec',
  'lhci',
  'autorun',
  '--config=lighthouserc.mobile.json',
  `--collect.url=http://localhost:${PORT}`,
  '--collect.numberOfRuns=1',
  '--upload.target=filesystem',
  '--upload.outputDir=.lhci-local/mobile',
]);

// ── Gate 4: axe-core a11y ─────────────────────────────────────────────────────

gate('axe-core a11y scan', 'pnpm', ['playwright', 'test', 'tests/a11y', '--project=chromium']);

// ── Gate 5: E2E functional ────────────────────────────────────────────────────

gate('E2E functional — chromium', 'pnpm', [
  'playwright',
  'test',
  '--project=chromium',
  'tests/e2e/cross-cutting.spec.ts',
  'tests/e2e/observability-smoke.spec.ts',
]);

// ── Teardown ──────────────────────────────────────────────────────────────────

cleanup();

if (exitCode === 0) {
  log(`\n${C.green}${C.bold}[gates:runtime] All runtime gates passed.${C.reset}\n`);
} else {
  process.stderr.write(
    `\n${C.red}${C.bold}[gates:runtime] One or more runtime gates failed. Fix before pushing.${C.reset}\n\n`,
  );
}

process.exit(exitCode);
