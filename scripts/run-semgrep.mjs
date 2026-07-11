#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const SEMGREP_BIN = process.env.SEMGREP_BIN;
const RUNNER_CANDIDATES = SEMGREP_BIN ? [[SEMGREP_BIN]] : [['semgrep']];
const DEFAULT_PATHS = ['app', 'lib', 'components', 'scripts'];

const REGISTRY_CONFIGS = ['p/typescript', 'p/react', 'p/nextjs'];
const VENDORED_CONFIG = '.semgrep';

function parseArgs(argv) {
  const args = { sarif: null, error: false, paths: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--sarif') {
      args.sarif = argv[++i];
      if (!args.sarif) {
        console.error('[run-semgrep] --sarif requires a path argument');
        process.exit(2);
      }
    } else if (a === '--error') args.error = true;
    else args.paths.push(a);
  }
  if (args.paths.length === 0) args.paths = DEFAULT_PATHS;
  return args;
}

function resolveRunner() {
  for (const cmd of RUNNER_CANDIDATES) {
    const probe = spawnSync(cmd[0], [...cmd.slice(1), '--version'], { stdio: 'ignore' });
    if (probe.status === 0) return cmd;
  }
  return null;
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  const runner = resolveRunner();
  if (!runner) {
    const tried = RUNNER_CANDIDATES.map((c) => c.join(' ')).join('", "');
    console.error(
      `[run-semgrep] semgrep not found (tried "${tried}"). ` +
        'Install with: pip install semgrep==1.97.0 — or rely on CI (authoritative).',
    );
    process.exit(2);
  }

  const configFlags = [
    '--config',
    VENDORED_CONFIG,
    ...REGISTRY_CONFIGS.flatMap((c) => ['--config', c]),
  ];

  const cliArgs = [
    ...runner.slice(1),
    'scan',
    ...configFlags,
    ...(args.error ? ['--error'] : []),
    ...(args.sarif ? ['--sarif', '--output', args.sarif] : []),
    '--metrics',
    'off',
    ...args.paths,
  ];

  const res = spawnSync(runner[0], cliArgs, { stdio: 'inherit' });
  if (res.error) {
    console.error(`[run-semgrep] exec failed: ${res.error.message}`);
    process.exit(2);
  }
  process.exit(res.status ?? 2);
}

main();
