#!/usr/bin/env tsx
// scripts/gates-runtime.ts
//
// Runs server-dependent quality gates locally — mirrors CI's performance and
// e2e-functional jobs so regressions surface before push, not after.
//
// Gates (in order):
//   1. Build          — pnpm build (skip with --skip-build if .next/ is fresh)
//   2. Server start   — pnpm start on :3000 with DEPLOY_SALT
//   3. LHCI desktop   — ADVISORY (median of 3 runs), thresholds from lighthouserc.json
//   4. LHCI mobile    — ADVISORY (median of 3 runs), thresholds from lighthouserc.mobile.json
//   5. axe-core       — playwright tests/a11y --project=chromium (blocking)
//   6. E2E functional — cross-cutting + observability-smoke, chromium only (blocking)
//
// LHCI is ADVISORY locally, AUTHORITATIVE in CI:
//   `throttlingMethod: simulate` + 4x CPU models throttled timing from the HOST trace, so
//   mobile perf scores are not portable — a loaded dev laptop false-fails at ~0.6 while
//   CI's controlled runner passes >=0.9 on the identical config. Blocking the push on that
//   trains SKIP_RUNTIME_GATES bypasses. CI's `performance` job is the real blocking gate
//   (same thresholds, median of 3); locally we print the numbers as signal only.
//
// Skipped locally (CI handles):
//   - Visual regression (Linux Chromium baselines; use playwright MCP for manual check)
//   - AI eval (requires live API keys + Upstash)
//   - WebKit matrix (non-deterministic pixel rendering; not a required gate)
//   - LHCI multi-URL (6 URLs in CI; lean to 1 URL locally). Run count stays at the
//     config's 3 (median) for honest local numbers.
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
// Tracks advisory (non-blocking) gate failures separately from exitCode, so the final
// summary can stay honest: a green "all passed" line must not hide an LHCI advisory miss
// (which may be a real local breakage — lhci missing / config error — not just a threshold).
let advisoryFailed = false;

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

function run(
  label: string,
  file: string,
  args: string[],
  env?: Record<string, string | undefined>,
) {
  step(label);
  execFileSync(file, args, { stdio: 'inherit', env: { ...process.env, ...env } });
  pass(label);
}

function gate(
  label: string,
  file: string,
  args: string[],
  env?: Record<string, string | undefined>,
) {
  try {
    run(label, file, args, env);
  } catch {
    process.stderr.write(`${C.red}  ✗ ${label} failed${C.reset}\n`);
    exitCode = 1;
  }
}

// Advisory gate: runs and prints results, but does NOT block the push on failure.
// WHY: LHCI uses `throttlingMethod: simulate` + 4x CPU multiplier, which models the
// throttled timing from the HOST's observed trace — so mobile perf scores are not
// portable across machines (a dev laptop under load false-fails at ~0.6 while CI's
// controlled runner passes ≥0.9 on the identical config + thresholds). Enforcing a
// CI-calibrated absolute threshold on arbitrary local hardware trains gate bypasses.
// The authoritative perf gate is CI's `performance` job (blocking, same thresholds,
// median of 3). Locally we surface the numbers as advisory signal only.
function advisory(
  label: string,
  file: string,
  args: string[],
  env?: Record<string, string | undefined>,
) {
  try {
    run(label, file, args, env);
  } catch (err) {
    // run() throws on a non-zero LHCI exit (assertion miss) OR a genuine failure
    // (lhci crash, missing config, command-not-found). Echo the underlying message so
    // a real breakage is distinguishable from a perf/threshold miss — both stay advisory.
    const msg = err instanceof Error ? err.message : String(err);
    advisoryFailed = true;
    process.stderr.write(
      `${C.yellow}  ⚠ ${label} did not pass locally — ADVISORY, not blocking.${C.reset}\n` +
        `${C.dim}    ${msg}\n` +
        '    Simulate-throttled LHCI is host-dependent and not portable; the authoritative\n' +
        `    perf gate runs on CI's controlled hardware (blocking, identical thresholds).${C.reset}\n`,
    );
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

// ── Gate 2: Start server ──────────────────────────────────────────────────────

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

// ── Gate 3: Lighthouse desktop ────────────────────────────────────────────────

advisory('Lighthouse CI — desktop', 'pnpm', [
  'exec',
  'lhci',
  'autorun',
  `--collect.url=http://localhost:${PORT}`,
  // numberOfRuns inherited from lighthouserc.json (3) — median smooths host-load variance
  '--upload.target=filesystem',
  '--upload.outputDir=.lhci-local/desktop',
]);

// ── Gate 4: Lighthouse mobile ─────────────────────────────────────────────────

advisory('Lighthouse CI — mobile', 'pnpm', [
  'exec',
  'lhci',
  'autorun',
  '--config=lighthouserc.mobile.json',
  `--collect.url=http://localhost:${PORT}`,
  // numberOfRuns inherited from lighthouserc.mobile.json (3) — median smooths host-load variance
  '--upload.target=filesystem',
  '--upload.outputDir=.lhci-local/mobile',
]);

// ── Gate 5: axe-core a11y ─────────────────────────────────────────────────────

gate('axe-core a11y scan', 'pnpm', ['playwright', 'test', 'tests/a11y', '--project=chromium']);

// ── Gate 6: E2E functional ────────────────────────────────────────────────────

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
  if (advisoryFailed) {
    log(
      `\n${C.green}${C.bold}[gates:runtime] All blocking runtime gates passed.${C.reset} ` +
        `${C.yellow}LHCI advisory did not pass locally (see ⚠ above) — CI's perf gate is authoritative.${C.reset}\n`,
    );
  } else {
    log(`\n${C.green}${C.bold}[gates:runtime] All runtime gates passed.${C.reset}\n`);
  }
} else {
  process.stderr.write(
    `\n${C.red}${C.bold}[gates:runtime] One or more runtime gates failed. Fix before pushing.${C.reset}\n\n`,
  );
}

process.exit(exitCode);
