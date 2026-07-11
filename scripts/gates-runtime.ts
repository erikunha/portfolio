#!/usr/bin/env tsx

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
let advisoryFailed = false;

function cleanup() {
  for (const child of gateChildren.splice(0)) {
    if (child.pid != null) {
      try {
        process.kill(-child.pid, 'SIGTERM');
      } catch {
        try {
          child.kill('SIGTERM');
          // biome-ignore lint/suspicious/noEmptyBlockStatements: intentional no-op
        } catch {}
      }
    } else {
      try {
        child.kill('SIGTERM');
        // biome-ignore lint/suspicious/noEmptyBlockStatements: intentional no-op
      } catch {}
    }
  }
  if (server) {
    try {
      server.kill('SIGTERM');
      // biome-ignore lint/suspicious/noEmptyBlockStatements: intentional no-op
    } catch {}
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
  env?: Record<string, string | undefined>,
): Promise<GateResult> {
  const start = Date.now();
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    const child = spawn(file, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: env ? { ...process.env, ...env } : process.env,
      detached: true,
    });
    gateChildren.push(child);
    log(`  → ${label}`);
    child.stdout.on('data', (d: Buffer) => {
      chunks.push(d);
    });
    child.stderr.on('data', (d: Buffer) => {
      chunks.push(d);
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
        output: Buffer.concat(chunks).toString(),
      });
    });
  });
}

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

step('Running post-build gates in parallel');

const lhciDesktopPromise = spawnGate('Lighthouse CI — desktop', true, 'pnpm', [
  'exec',
  'lhci',
  'autorun',
  `--collect.url=http://localhost:${PORT}`,
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

for (const r of results) {
  if (r.status === 'fulfilled' && r.value.output.trim()) {
    process.stdout.write(r.value.output);
  } else if (r.status === 'rejected') {
    process.stderr.write(`${C.red}[gates:runtime] Gate crashed: ${r.reason}${C.reset}\n`);
  }
}

log(`\n${C.bold}[gates:runtime] Post-build gate results:${C.reset}`);
for (const r of results) {
  if (r.status === 'rejected') {
    process.stderr.write(
      `${C.red}  ✗${C.reset} [gate crashed]                      (blocking)   — ${String(r.reason)}\n`,
    );
    exitCode = 1;
    continue;
  }
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
