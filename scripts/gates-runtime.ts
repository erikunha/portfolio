#!/usr/bin/env tsx
// scripts/gates-runtime.ts
//
// Runs server-dependent quality gates locally — mirrors CI's performance and
// e2e-functional jobs so regressions surface before push, not after.
//
// Gates (in order):
//   1. Build          — pnpm build (skip with --skip-build if .next/ is fresh)
//   2. Server start   — pnpm start on :3000 with DEPLOY_SALT
//   3-4. Sequential   — LHCI desktop (advisory), then LHCI mobile (advisory)
//   5-6. Parallel     — axe-core (blocking), E2E functional (blocking)
//
// LHCI desktop+mobile run sequentially (chained Promises) because LHCI anchors
// .lighthouseci/ to process.cwd() with no CLI override — concurrent runs race in
// collect/assert on that shared directory. axe and E2E have no shared state and
// run in parallel. Wall-clock: max(LHCI-desktop+LHCI-mobile, axe, E2E) (~2-3 min).
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
const gateChildren: ChildProcess[] = [];
let exitCode = 0;
// Tracks advisory (non-blocking) gate failures separately from exitCode, so the final
// summary can stay honest: a green "all passed" line must not hide an LHCI advisory miss
// (which may be a real local breakage — lhci missing / config error — not just a threshold).
let advisoryFailed = false;

function cleanup() {
  for (const child of gateChildren) {
    if (child.pid != null) {
      // Kill the whole process group so grandchildren (e.g. Playwright-spawned Chromium)
      // are reaped too. Falls back to direct SIGTERM if the group kill fails (e.g. if the
      // process already exited).
      try {
        process.kill(-child.pid, 'SIGTERM');
      } catch {
        child.kill('SIGTERM');
      }
    } else {
      child.kill('SIGTERM');
    }
  }
  gateChildren.length = 0;
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

interface GateResult {
  label: string;
  advisory: boolean;
  passed: boolean;
  durationMs: number;
  output: string;
}

function spawnGate(
  label: string,
  isAdvisory: boolean,
  file: string,
  args: string[],
): Promise<GateResult> {
  const start = Date.now();
  return new Promise((resolve) => {
    let output = '';
    // detached: true puts each gate in its own process group so cleanup() can
    // kill the whole tree (pnpm -> Playwright -> Chromium) via process.kill(-pid).
    const child = spawn(file, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
      detached: true,
    });
    gateChildren.push(child);
    child.stdout.on('data', (d: Buffer) => {
      output += d.toString();
    });
    child.stderr.on('data', (d: Buffer) => {
      output += d.toString();
    });
    child.on('error', (err) => {
      const ei = gateChildren.indexOf(child);
      if (ei !== -1) gateChildren.splice(ei, 1);
      resolve({
        label,
        advisory: isAdvisory,
        passed: false,
        durationMs: Date.now() - start,
        output: err.message,
      });
    });
    child.on('close', (code) => {
      const ci = gateChildren.indexOf(child);
      if (ci !== -1) gateChildren.splice(ci, 1);
      resolve({
        label,
        advisory: isAdvisory,
        passed: code === 0,
        durationMs: Date.now() - start,
        output,
      });
    });
  });
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

// ── Gates 3-6: Post-build gates (parallel) ────────────────────────────────────
// These 4 gates have no data dependency on each other. Running them sequentially
// via execFileSync wastes ~4-5 min of wall-clock time. spawn-based parallel runner
// reduces wall-clock to the max of the 4 (~90s).

step('Running post-build gates in parallel');

// LHCI anchors .lighthouseci/ to process.cwd() with no CLI flag to relocate it
// (`--collect.outputDir` does not exist on the collect command and is silently discarded).
// Concurrent desktop+mobile runs race in collect/assert on that shared directory.
// Chain mobile off desktop so they run sequentially without blocking the parallel
// axe/E2E gates, which have no shared state with each other or with LHCI.
const lhciDesktopPromise = spawnGate('Lighthouse CI — desktop', true, 'pnpm', [
  'exec',
  'lhci',
  'autorun',
  `--collect.url=http://localhost:${PORT}`,
  // numberOfRuns inherited from lighthouserc.json (3) — median smooths host-load variance
  '--upload.target=filesystem',
  '--upload.outputDir=.lhci-local/desktop',
]);
const lhciMobilePromise = lhciDesktopPromise.then(() =>
  spawnGate('Lighthouse CI — mobile', true, 'pnpm', [
    'exec',
    'lhci',
    'autorun',
    '--config=lighthouserc.mobile.json',
    `--collect.url=http://localhost:${PORT}`,
    // numberOfRuns inherited from lighthouserc.mobile.json (3) — median smooths host-load variance
    '--upload.target=filesystem',
    '--upload.outputDir=.lhci-local/mobile',
  ]),
);

const gatePromises = [
  lhciDesktopPromise,
  lhciMobilePromise,
  spawnGate('axe-core a11y scan', false, 'pnpm', [
    'playwright',
    'test',
    'tests/a11y',
    '--project=chromium',
    '--output=.playwright-results/axe',
  ]),
  spawnGate('E2E functional — chromium', false, 'pnpm', [
    'playwright',
    'test',
    '--project=chromium',
    'tests/e2e/cross-cutting.spec.ts',
    'tests/e2e/observability-smoke.spec.ts',
    '--output=.playwright-results/e2e',
  ]),
];

const timeoutPromise = new Promise<never>((_, reject) =>
  setTimeout(() => reject(new Error('gates:runtime exceeded 300s wall-clock limit')), 300_000),
);

let results: PromiseSettledResult<GateResult>[];
try {
  results = (await Promise.race([
    Promise.allSettled(gatePromises),
    timeoutPromise,
  ])) as PromiseSettledResult<GateResult>[];
} catch (err) {
  process.stderr.write(
    `${C.red}${C.bold}[gates:runtime] ${err instanceof Error ? err.message : String(err)}${C.reset}\n`,
  );
  cleanup();
  process.exit(1);
}

// Print all buffered output first (deferred to avoid interleaving during parallel run)
for (const r of results) {
  if (r.status === 'fulfilled' && r.value.output.trim()) {
    process.stdout.write(r.value.output);
  }
}

// Print result summary
log(`\n${C.bold}[gates:runtime] Post-build gate results:${C.reset}`);
for (const r of results) {
  if (r.status !== 'fulfilled') continue;
  const { label, advisory: isAdvisory, passed, durationMs } = r.value;
  const icon = passed ? `${C.green}  ✓` : `${C.red}  ✗`;
  const tag = isAdvisory ? '(advisory)' : '(blocking)';
  log(`${icon}${C.reset} ${label.padEnd(35)} ${tag.padEnd(12)} ${(durationMs / 1000).toFixed(1)}s`);
  if (!passed) {
    if (isAdvisory) {
      advisoryFailed = true;
    } else {
      exitCode = 1;
    }
  }
}

// ── Teardown ──────────────────────────────────────────────────────────────────

cleanup();

if (exitCode === 0) {
  if (advisoryFailed) {
    log(
      `\n${C.green}${C.bold}[gates:runtime] All blocking runtime gates passed.${C.reset} ` +
        `${C.yellow}LHCI advisory did not pass locally (see above) — CI's perf gate is authoritative.${C.reset}\n`,
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
