#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const INSTALL_ATTEMPTS = 3;
export const INSTALL_ATTEMPT_TIMEOUT_MS = 3 * 60 * 1000;
const SUCCESS = 0;
const FAILURE = 1;

export function installWithRetry(browsers, { spawn = spawnSync, log = console.error } = {}) {
  const args = ['playwright', 'install', '--with-deps', ...browsers];
  for (let attempt = 1; attempt <= INSTALL_ATTEMPTS; attempt++) {
    const result = spawn('pnpm', args, { stdio: 'inherit', timeout: INSTALL_ATTEMPT_TIMEOUT_MS });
    if (result.status === SUCCESS) return SUCCESS;
    const reason = result.error?.code === 'ETIMEDOUT' ? 'timed out' : `exited ${result.status}`;
    log(`[install-playwright-browsers] attempt ${attempt}/${INSTALL_ATTEMPTS} ${reason}`);
  }
  return FAILURE;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const browsers = process.argv.slice(2);
  if (browsers.length === 0) {
    console.error('usage: install-playwright-browsers.mjs <browser...>');
    process.exit(FAILURE);
  }
  process.exit(installWithRetry(browsers));
}
