#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

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

export function configureApt({
  run = spawnSync,
  platform = process.platform,
  ci = process.env.CI,
} = {}) {
  if (platform !== LINUX || !ci) return false;
  const result = run('sudo', ['tee', APT_CONFIG_PATH], {
    input: `${APT_CONFIG}\n`,
    stdio: ['pipe', 'ignore', 'inherit'],
  });
  return result.status === SUCCESS;
}

export function installWithRetry(browsers, { run = spawnSync, log = console.error } = {}) {
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

if (
  typeof process.argv[1] === 'string' &&
  import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href
) {
  const browsers = process.argv.slice(2);
  if (browsers.length === 0) {
    console.error('usage: install-playwright-browsers.mjs <browser...>');
    process.exit(FAILURE);
  }
  configureApt();
  process.exit(installWithRetry(browsers));
}
