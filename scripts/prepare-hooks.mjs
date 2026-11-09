#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const SUCCESS = 0;
const FAILURE = 1;
const SKIP_ENV_FLAGS = ['CI', 'VERCEL'];
const PRODUCTION = 'production';

export function shouldInstallHooks(env) {
  return env.NODE_ENV !== PRODUCTION && !SKIP_ENV_FLAGS.some((name) => Boolean(env[name]));
}

export function prepareHooks({ env = process.env, install = installHusky } = {}) {
  if (!shouldInstallHooks(env)) return SUCCESS;
  return install() === SUCCESS ? SUCCESS : FAILURE;
}

function installHusky() {
  return spawnSync('husky', [], { stdio: 'inherit', shell: true }).status ?? FAILURE;
}

if (
  typeof process.argv[1] === 'string' &&
  import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href
) {
  process.exit(prepareHooks());
}
