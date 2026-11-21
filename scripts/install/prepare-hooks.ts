import { spawnSync } from 'node:child_process';
import { isMain } from '../lib/is-main.ts';

const SUCCESS = 0;
const FAILURE = 1;
const SKIP_ENV_FLAGS = ['CI', 'VERCEL'];
const PRODUCTION = 'production';

type Env = Record<string, string | undefined>;

interface PrepareHooksOptions {
  env?: Env;
  install?: () => number;
}

export function shouldInstallHooks(env: Env): boolean {
  return env.NODE_ENV !== PRODUCTION && !SKIP_ENV_FLAGS.some((name) => Boolean(env[name]));
}

function installHusky(): number {
  return spawnSync('husky', [], { stdio: 'inherit', shell: true }).status ?? FAILURE;
}

export function prepareHooks({
  env = process.env,
  install = installHusky,
}: PrepareHooksOptions = {}): number {
  if (!shouldInstallHooks(env)) return SUCCESS;
  return install() === SUCCESS ? SUCCESS : FAILURE;
}

if (isMain(import.meta.url)) {
  process.exit(prepareHooks());
}
