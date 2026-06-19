#!/usr/bin/env node
// Semgrep invocation wrapper. CI is authoritative; local use is optional.
// Semgrep is pinned to ==1.97.0 (see .github/workflows/ci.yml `semgrep` job
// and the ADR in DECISIONS.md). Vendored rules in .semgrep/ are content-pinned;
// registry packs (p/typescript, p/react, p/nextjs) fetch registry-latest (drift documented in the ADR).
import { spawnSync } from 'node:child_process';

// Candidate invocations, probed in order. An explicit SEMGREP_BIN override is
// honored exactly (no fallback — a wrong override should fail loudly, not get
// silently swapped). Otherwise we try the bare console script first, then the
// `python -m semgrep` module form: pip installs semgrep into the active
// interpreter's site-packages even when its console-script bin dir is NOT on
// PATH (the classic hosted-runner case that broke the CI `semgrep` job), and
// the module form resolves through the interpreter, bypassing PATH entirely.
const SEMGREP_BIN = process.env.SEMGREP_BIN;
const RUNNER_CANDIDATES = SEMGREP_BIN
  ? [[SEMGREP_BIN]]
  : [['semgrep'], ['python3', '-m', 'semgrep'], ['python', '-m', 'semgrep']];
const DEFAULT_PATHS = ['app', 'lib', 'components', 'scripts'];

// The Semgrep CLI has no registry-pack version-pinning syntax, so these fetch
// registry-LATEST (mutable; rules may drift between runs). Drift is accepted per
// the ADR; the security-critical rules are vendored + content-pinned in .semgrep/.
const REGISTRY_CONFIGS = ['p/typescript', 'p/react', 'p/nextjs'];
const VENDORED_CONFIG = '.semgrep'; // directory of content-pinned rule files

function parseArgs(argv) {
  const args = { sarif: null, error: false, paths: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--sarif') {
      args.sarif = argv[++i];
      // Reject undefined (flag was last) AND '' (empty path): both would later
      // be falsy at the `args.sarif ?` guard and silently drop the SARIF flags.
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

// Probe each candidate with `--version`; return the first that exits 0 (e.g.
// ['semgrep'] or ['python3', '-m', 'semgrep']). null means none resolved.
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
  // semgrep exits 1 on findings under --error, 0 when clean — pass it through.
  process.exit(res.status ?? 2);
}

main();
