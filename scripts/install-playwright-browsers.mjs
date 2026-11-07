#!/usr/bin/env node
import { spawn as nodeSpawn } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const INSTALL_ATTEMPTS = 3;
export const INSTALL_ATTEMPT_TIMEOUT_MS = 4 * 60 * 1000;
const SUCCESS = 0;
const FAILURE = 1;
const KILL_SIGNAL = 'SIGKILL';

export function runAttempt(args, { spawn = nodeSpawn, kill = process.kill } = {}) {
  return new Promise((resolve) => {
    const child = spawn('pnpm', args, { stdio: 'inherit', detached: true });
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      kill(-child.pid, KILL_SIGNAL);
    }, INSTALL_ATTEMPT_TIMEOUT_MS);
    child.on('exit', (status) => {
      clearTimeout(timer);
      resolve({ status, timedOut });
    });
  });
}

export async function installWithRetry(
  browsers,
  { attempt = runAttempt, log = console.error } = {},
) {
  const args = ['playwright', 'install', '--with-deps', ...browsers];
  for (let n = 1; n <= INSTALL_ATTEMPTS; n++) {
    const result = await attempt(args);
    if (result.status === SUCCESS && !result.timedOut) return SUCCESS;
    const reason = result.timedOut ? 'timed out' : `exited ${result.status}`;
    log(`[install-playwright-browsers] attempt ${n}/${INSTALL_ATTEMPTS} ${reason}`);
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
  process.exit(await installWithRetry(browsers));
}
