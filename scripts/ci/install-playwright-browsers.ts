import { type SpawnSyncReturns, spawnSync } from 'node:child_process';
import { isMain } from '../lib/is-main.ts';

export const INSTALL_ATTEMPTS = 3;
export const APT_CONFIG_PATH = '/etc/apt/apt.conf.d/99ci-mirror-resilience';
export const APT_CONFIG = [
  'DPkg::Lock::Timeout "600";',
  'Acquire::Retries "5";',
  'Acquire::http::Timeout "30";',
  'Acquire::https::Timeout "30";',
].join('\n');
const SUCCESS = 0;
const FAILURE = 1;
const LINUX = 'linux';
const FIRST_ARGUMENT_INDEX = 2;

type Run = (
  command: string,
  args: string[],
  options: object,
) => Pick<SpawnSyncReturns<string>, 'status'>;

export function configureApt({
  run = spawnSync as Run,
  platform = process.platform as string,
  ci = process.env.CI as string | undefined,
}: {
  run?: Run;
  platform?: string;
  ci?: string | undefined;
} = {}): boolean {
  if (platform !== LINUX || !ci) return false;
  const result = run('sudo', ['tee', APT_CONFIG_PATH], {
    input: `${APT_CONFIG}\n`,
    stdio: ['pipe', 'ignore', 'inherit'],
  });
  return result.status === SUCCESS;
}

export function installWithRetry(
  browsers: string[],
  {
    run = spawnSync as Run,
    log = console.error,
  }: { run?: Run; log?: (message: string) => void } = {},
): number {
  const args = ['playwright', 'install', '--with-deps', ...browsers];
  for (let attempt = 1; attempt <= INSTALL_ATTEMPTS; attempt++) {
    const result = run('pnpm', args, { stdio: 'inherit' });
    if (result.status === SUCCESS) return SUCCESS;
    log(
      `[install-playwright-browsers] attempt ${attempt}/${INSTALL_ATTEMPTS} exited ${result.status}`,
    );
  }
  return FAILURE;
}

if (isMain(import.meta.url)) {
  const browsers = process.argv.slice(FIRST_ARGUMENT_INDEX);
  if (browsers.length === 0) {
    console.error('usage: install-playwright-browsers.ts <browser...>');
    process.exit(FAILURE);
  }
  configureApt();
  process.exit(installWithRetry(browsers));
}
