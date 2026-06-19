#!/usr/bin/env node
// Semgrep invocation wrapper. CI is authoritative; local use is optional.
// Semgrep is pinned to ==1.97.0 (see .github/workflows/ci.yml `semgrep` job
// and the ADR in DECISIONS.md). Vendored rules in .semgrep/ are content-pinned;
// registry packs (p/typescript, p/react, p/nextjs) are tag-pinned (drift documented in the ADR).
import { spawnSync } from 'node:child_process';

const SEMGREP_BIN = process.env.SEMGREP_BIN ?? 'semgrep';
const DEFAULT_PATHS = ['app', 'lib', 'components', 'scripts'];

// Registry packs are TAG-pinned (mutable). Vendored .semgrep/ rules are CONTENT-pinned.
const REGISTRY_CONFIGS = ['p/typescript', 'p/react', 'p/nextjs'];
const VENDORED_CONFIG = '.semgrep'; // directory of content-pinned rule files

function parseArgs(argv) {
  const args = { sarif: null, error: false, paths: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--sarif') args.sarif = argv[++i];
    else if (a === '--error') args.error = true;
    else args.paths.push(a);
  }
  if (args.paths.length === 0) args.paths = DEFAULT_PATHS;
  return args;
}

function semgrepAvailable() {
  const probe = spawnSync(SEMGREP_BIN, ['--version'], { stdio: 'ignore' });
  return probe.status === 0;
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!semgrepAvailable()) {
    console.error(
      `[run-semgrep] semgrep binary not found (tried "${SEMGREP_BIN}"). ` +
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
    'scan',
    ...configFlags,
    ...(args.error ? ['--error'] : []),
    ...(args.sarif ? ['--sarif', '--output', args.sarif] : []),
    '--metrics',
    'off',
    ...args.paths,
  ];

  const res = spawnSync(SEMGREP_BIN, cliArgs, { stdio: 'inherit', encoding: 'utf8' });
  if (res.error) {
    console.error(`[run-semgrep] exec failed: ${res.error.message}`);
    process.exit(2);
  }
  // semgrep exits 1 on findings under --error, 0 when clean — pass it through.
  process.exit(res.status ?? 2);
}

main();
