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
export const APT_CACHE_DIR_ENV = 'APT_CACHE_DIR';
const APT_CACHE_DIR_PATTERN = /^\/[\w./-]+$/;
const SUCCESS = 0;
const FAILURE = 1;
const LINUX = 'linux';
const FIRST_ARGUMENT_INDEX = 2;

type Run = (
  command: string,
  args: string[],
  options: object,
) => Pick<SpawnSyncReturns<string>, 'status'>;

export function aptConfig(cacheDir?: string): string {
  if (cacheDir === undefined) return APT_CONFIG;
  if (!APT_CACHE_DIR_PATTERN.test(cacheDir)) {
    throw new Error(`${APT_CACHE_DIR_ENV} must be an absolute path without spaces or quotes`);
  }
  return [
    APT_CONFIG,
    `Dir::Cache::Archives "${cacheDir}/archives";`,
    `Dir::State::Lists "${cacheDir}/lists";`,
    'APT::Keep-Downloaded-Packages "true";',
  ].join('\n');
}

interface AptOptions {
  run?: Run;
  platform?: string;
  ci?: string | undefined;
  cacheDir?: string | undefined;
}

const cacheDirFromEnv = (): string | undefined => process.env[APT_CACHE_DIR_ENV] || undefined;

export function configureApt({
  run = spawnSync as Run,
  platform = process.platform as string,
  ci = process.env.CI as string | undefined,
  cacheDir = cacheDirFromEnv(),
}: AptOptions = {}): boolean {
  if (platform !== LINUX || !ci) return false;
  const result = run('sudo', ['tee', APT_CONFIG_PATH], {
    input: `${aptConfig(cacheDir)}\n`,
    stdio: ['pipe', 'ignore', 'inherit'],
  });
  return result.status === SUCCESS;
}

export function releaseAptCache({
  run = spawnSync as Run,
  platform = process.platform as string,
  ci = process.env.CI as string | undefined,
  cacheDir = cacheDirFromEnv(),
  uid = process.getuid?.(),
  gid = process.getgid?.(),
}: AptOptions & { uid?: number | undefined; gid?: number | undefined } = {}): boolean {
  if (platform !== LINUX || !ci || cacheDir === undefined) return false;
  if (uid === undefined || gid === undefined) return false;
  const result = run('sudo', ['chown', '-R', `${uid}:${gid}`, cacheDir], { stdio: 'inherit' });
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
  const status = installWithRetry(browsers);
  releaseAptCache();
  process.exit(status);
}
