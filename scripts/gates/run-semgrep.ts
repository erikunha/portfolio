import { spawnSync } from 'node:child_process';
import { isMain } from '../lib/is-main.ts';
import { semgrepBin, VENDORED_CONFIG } from '../lib/semgrep.ts';

const DEFAULT_PATHS = [
  'app',
  'lib',
  'components',
  'scripts',
  'proxy.ts',
  'instrumentation.ts',
  'next.config.ts',
  '.github/workflows',
];
const REGISTRY_CONFIGS = ['p/typescript', 'p/react', 'p/nextjs', 'p/github-actions'];
const SEMGREP_INSTALL_HINT = 'pip install semgrep==1.185.0';
const TAG = '[run-semgrep]';
const EXIT_INFRA = 2;

interface Args {
  sarif: string | null;
  error: boolean;
  paths: string[];
}

function parseArgs(argv: string[]): Args {
  const args: Args = { sarif: null, error: false, paths: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] as string;
    if (arg === '--sarif') {
      const sarif = argv[++i];
      if (!sarif) {
        console.error(`${TAG} --sarif requires a path argument`);
        process.exit(EXIT_INFRA);
      }
      args.sarif = sarif;
    } else if (arg === '--error') args.error = true;
    else args.paths.push(arg);
  }
  if (args.paths.length === 0) args.paths = DEFAULT_PATHS;
  return args;
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const bin = semgrepBin();

  const probe = spawnSync(bin, ['--version'], { stdio: 'ignore' });
  if (probe.status !== 0) {
    console.error(
      `${TAG} semgrep not found (tried "${bin}"). ` +
        `Install with: ${SEMGREP_INSTALL_HINT}, or rely on CI (authoritative).`,
    );
    process.exit(EXIT_INFRA);
  }

  const cliArgs = [
    'scan',
    '--config',
    VENDORED_CONFIG,
    ...REGISTRY_CONFIGS.flatMap((config) => ['--config', config]),
    ...(args.error ? ['--error'] : []),
    ...(args.sarif ? ['--sarif', '--output', args.sarif] : []),
    '--metrics',
    'off',
    ...args.paths,
  ];

  const res = spawnSync(bin, cliArgs, { stdio: 'inherit' });
  if (res.error) {
    console.error(`${TAG} exec failed: ${res.error.message}`);
    process.exit(EXIT_INFRA);
  }
  process.exit(res.status ?? EXIT_INFRA);
}

if (isMain(import.meta.url)) main();
