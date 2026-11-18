import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { isMain } from '../lib/is-main.ts';

export type Status = 'ok' | 'warn' | 'fail';

export interface CheckResult {
  name: string;
  status: Status;
  detail: string;
  fix: string;
}

export interface Probes {
  nodeVersion: string;
  nvmrc: string | null;
  pnpmVersion: string | null;
  packageManager: string | null;
  gitleaksVersion: string | null;
  nodeModulesInstalled: boolean;
  lockfileInSync: boolean | null;
  playwrightBrowsers: boolean;
  hooksPath: string | null;
  envLocalPresent: boolean;
}

export interface DoctorDeps {
  root: string;
  nodeVersion: string;
  platform: string;
  home: string;
  env: Record<string, string | undefined>;
  exists: (path: string) => boolean;
  read: (path: string) => string | null;
  list: (path: string) => string[];
  run: (command: string, args: string[]) => string | null;
}

const SUCCESS = 0;
const FAILURE = 1;
const VERSION_PART_SEPARATOR = '.';
const HOOKS_DIRECTORY = '.husky';
const PNPM_PREFIX = 'pnpm@';
const REQUIRED_BROWSERS = ['chromium-', 'webkit-'];
const DARWIN = 'darwin';
const WIN32 = 'win32';
const STATUS_LABEL: Record<Status, string> = { ok: 'ok  ', warn: 'warn', fail: 'FAIL' };
const FIX_INDENT = '  fix: ';

function major(version: string): string {
  return version.replace(/^v/, '').split(VERSION_PART_SEPARATOR)[0] ?? '';
}

function normalize(version: string): string {
  return version.trim().replace(/^v/, '');
}

function checkNode({ nodeVersion, nvmrc }: Probes): CheckResult {
  const fix = 'nvm use (or install the version named in .nvmrc), then reinstall dependencies';
  if (nvmrc === null) {
    return { name: 'node', status: 'warn', detail: `Node ${nodeVersion}, no .nvmrc`, fix };
  }
  const wanted = normalize(nvmrc);
  const have = normalize(nodeVersion);
  if (have === wanted) return { name: 'node', status: 'ok', detail: `Node ${have}`, fix };
  const sameMajor = major(have) === major(wanted);
  return {
    name: 'node',
    status: sameMajor ? 'warn' : 'fail',
    detail: `Node ${have}, .nvmrc pins ${wanted}`,
    fix,
  };
}

function checkPnpm({ pnpmVersion, packageManager }: Probes): CheckResult {
  const fix =
    'corepack enable && corepack prepare --activate (package.json packageManager names the pnpm version)';
  if (pnpmVersion === null) {
    return { name: 'pnpm', status: 'fail', detail: 'pnpm is not on PATH', fix };
  }
  const wanted = packageManager?.startsWith(PNPM_PREFIX)
    ? packageManager.slice(PNPM_PREFIX.length)
    : null;
  if (wanted !== null && Number(major(pnpmVersion)) < Number(major(wanted))) {
    return {
      name: 'pnpm',
      status: 'fail',
      detail: `pnpm ${pnpmVersion}, packageManager needs pnpm ${major(wanted)} or newer (pins ${wanted})`,
      fix,
    };
  }
  return { name: 'pnpm', status: 'ok', detail: `pnpm ${pnpmVersion}`, fix };
}

function checkGitleaks({ gitleaksVersion }: Probes): CheckResult {
  const fix = 'brew install gitleaks (the pre-commit hook fails closed without it)';
  if (gitleaksVersion === null) {
    return { name: 'gitleaks', status: 'fail', detail: 'gitleaks is not on PATH', fix };
  }
  return { name: 'gitleaks', status: 'ok', detail: `gitleaks ${gitleaksVersion}`, fix };
}

function checkDependencies({ nodeModulesInstalled, lockfileInSync }: Probes): CheckResult {
  const fix = 'pnpm install';
  if (!nodeModulesInstalled) {
    return { name: 'dependencies', status: 'fail', detail: 'node_modules is missing', fix };
  }
  if (lockfileInSync === false) {
    return {
      name: 'dependencies',
      status: 'fail',
      detail: 'node_modules was installed from a different pnpm-lock.yaml',
      fix,
    };
  }
  return { name: 'dependencies', status: 'ok', detail: 'installed and in sync', fix };
}

function checkPlaywright({ playwrightBrowsers }: Probes): CheckResult {
  const fix = 'pnpm exec playwright install chromium webkit';
  return {
    name: 'playwright',
    status: playwrightBrowsers ? 'ok' : 'fail',
    detail: playwrightBrowsers ? 'chromium and webkit installed' : 'browsers are not installed',
    fix,
  };
}

function checkHooks({ hooksPath }: Probes): CheckResult {
  const fix = 'pnpm install (the prepare script installs the husky hooks)';
  const installed = hooksPath?.startsWith(HOOKS_DIRECTORY) === true;
  return {
    name: 'hooks',
    status: installed ? 'ok' : 'fail',
    detail: installed ? `core.hooksPath is ${hooksPath}` : 'git hooks are not installed',
    fix,
  };
}

function checkEnvLocal({ envLocalPresent }: Probes): CheckResult {
  return {
    name: 'env-local',
    status: envLocalPresent ? 'ok' : 'warn',
    detail: envLocalPresent ? '.env.local exists' : '.env.local is absent',
    fix: 'cp .env.example .env.local (optional: static content renders without keys)',
  };
}

export function runChecks(probes: Probes): CheckResult[] {
  return [
    checkNode(probes),
    checkPnpm(probes),
    checkGitleaks(probes),
    checkDependencies(probes),
    checkPlaywright(probes),
    checkHooks(probes),
    checkEnvLocal(probes),
  ];
}

export function exitCode(results: CheckResult[]): number {
  return results.some((result) => result.status === 'fail') ? FAILURE : SUCCESS;
}

export function formatReport(results: CheckResult[]): string {
  const lines: string[] = [];
  for (const result of results) {
    lines.push(`${STATUS_LABEL[result.status]} ${result.name}: ${result.detail}`);
    if (result.status === 'fail') lines.push(`${FIX_INDENT}${result.fix}`);
  }
  return lines.join('\n');
}

function playwrightCacheRoot({ env, platform, home }: DoctorDeps): string {
  const override = env.PLAYWRIGHT_BROWSERS_PATH;
  if (override) return override;
  if (platform === DARWIN) return join(home, 'Library', 'Caches', 'ms-playwright');
  if (platform === WIN32) return join(env.LOCALAPPDATA ?? home, 'ms-playwright');
  return join(home, '.cache', 'ms-playwright');
}

function trimmedFirstLine(output: string | null): string | null {
  return output === null ? null : (output.trim().split('\n')[0] ?? null);
}

function parsePackageManager(manifest: string | null): string | null {
  if (manifest === null) return null;
  try {
    const parsed = JSON.parse(manifest) as { packageManager?: string };
    return parsed.packageManager ?? null;
  } catch {
    return null;
  }
}

export function collectProbes(deps: DoctorDeps): Probes {
  const at = (...parts: string[]) => join(deps.root, ...parts);
  const installedLock = deps.read(at('node_modules', '.pnpm', 'lock.yaml'));
  const lock = deps.read(at('pnpm-lock.yaml'));
  const cached = deps.list(playwrightCacheRoot(deps));
  return {
    nodeVersion: deps.nodeVersion,
    nvmrc: deps.read(at('.nvmrc')),
    pnpmVersion: trimmedFirstLine(deps.run('pnpm', ['--version'])),
    packageManager: parsePackageManager(deps.read(at('package.json'))),
    gitleaksVersion: trimmedFirstLine(deps.run('gitleaks', ['version'])),
    nodeModulesInstalled: deps.exists(at('node_modules')),
    lockfileInSync: installedLock === null || lock === null ? null : installedLock === lock,
    playwrightBrowsers: REQUIRED_BROWSERS.every((prefix) =>
      cached.some((entry) => entry.startsWith(prefix)),
    ),
    hooksPath: trimmedFirstLine(deps.run('git', ['config', 'core.hooksPath'])),
    envLocalPresent: deps.exists(at('.env.local')),
  };
}

function realDeps(): DoctorDeps {
  return {
    root: process.cwd(),
    nodeVersion: process.versions.node,
    platform: process.platform,
    home: homedir(),
    env: process.env,
    exists: existsSync,
    read: (path) => {
      try {
        return readFileSync(path, 'utf8');
      } catch {
        return null;
      }
    },
    list: (path) => {
      try {
        return readdirSync(path);
      } catch {
        return [];
      }
    },
    run: (command, args) => {
      const result = spawnSync(command, args, { encoding: 'utf8' });
      return result.status === SUCCESS ? result.stdout : null;
    },
  };
}

if (isMain(import.meta.url)) {
  const results = runChecks(collectProbes(realDeps()));
  console.log(formatReport(results));
  process.exit(exitCode(results));
}
