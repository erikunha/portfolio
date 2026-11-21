import { describe, expect, it } from 'vitest';
import {
  type CheckResult,
  collectProbes,
  type DoctorDeps,
  exitCode,
  formatReport,
  type Probes,
  runChecks,
} from '../ci/doctor.ts';

const HEALTHY: Probes = {
  nodeVersion: '22.23.4',
  nvmrc: '22.23.4',
  pnpmVersion: '10.34.9',
  packageManager: 'pnpm@10.34.9',
  gitleaksVersion: '8.30.0',
  nodeModulesInstalled: true,
  lockfileInSync: true,
  playwrightBrowsers: true,
  hooksPath: '.husky/_',
  envLocalPresent: true,
};

function byName(results: CheckResult[], name: string): CheckResult {
  const found = results.find((result) => result.name === name);
  if (!found) throw new Error(`no check named ${name}`);
  return found;
}

describe('runChecks', () => {
  it('passes every check on a healthy machine', () => {
    const results = runChecks(HEALTHY);
    expect(results.every((result) => result.status === 'ok')).toBe(true);
    expect(exitCode(results)).toBe(0);
  });

  it('fails a Node major that differs from .nvmrc and names the fix', () => {
    const result = byName(runChecks({ ...HEALTHY, nodeVersion: '20.11.0' }), 'node');
    expect(result.status).toBe('fail');
    expect(result.fix).toContain('nvm use');
  });

  it('only warns when the major matches and the patch differs', () => {
    const result = byName(runChecks({ ...HEALTHY, nodeVersion: '22.23.5' }), 'node');
    expect(result.status).toBe('warn');
  });

  it('accepts a pnpm major newer than the packageManager pin', () => {
    expect(byName(runChecks({ ...HEALTHY, pnpmVersion: '12.14.0' }), 'pnpm').status).toBe('ok');
  });

  it('fails when pnpm is missing or older than the packageManager major', () => {
    expect(byName(runChecks({ ...HEALTHY, pnpmVersion: null }), 'pnpm').status).toBe('fail');
    const old = byName(runChecks({ ...HEALTHY, pnpmVersion: '9.15.0' }), 'pnpm');
    expect(old.status).toBe('fail');
    expect(old.fix).toContain('corepack');
  });

  it('fails when gitleaks is absent because the pre-commit hook fails closed', () => {
    const result = byName(runChecks({ ...HEALTHY, gitleaksVersion: null }), 'gitleaks');
    expect(result.status).toBe('fail');
    expect(result.fix).toContain('brew install gitleaks');
  });

  it('fails when dependencies are not installed and skips the lockfile check', () => {
    const results = runChecks({ ...HEALTHY, nodeModulesInstalled: false, lockfileInSync: null });
    expect(byName(results, 'dependencies').status).toBe('fail');
    expect(byName(results, 'dependencies').fix).toContain('pnpm install');
  });

  it('fails when node_modules was installed from a different lockfile', () => {
    const result = byName(runChecks({ ...HEALTHY, lockfileInSync: false }), 'dependencies');
    expect(result.status).toBe('fail');
    expect(result.fix).toContain('pnpm install');
  });

  it('fails when Playwright browsers are missing', () => {
    const result = byName(runChecks({ ...HEALTHY, playwrightBrowsers: false }), 'playwright');
    expect(result.status).toBe('fail');
    expect(result.fix).toContain('playwright install');
  });

  it('fails when git hooks are not installed', () => {
    const result = byName(runChecks({ ...HEALTHY, hooksPath: null }), 'hooks');
    expect(result.status).toBe('fail');
    expect(result.fix).toContain('pnpm install');
  });

  it('warns, never fails, when .env.local is absent', () => {
    const results = runChecks({ ...HEALTHY, envLocalPresent: false });
    expect(byName(results, 'env-local').status).toBe('warn');
    expect(exitCode(results)).toBe(0);
  });
});

describe('exitCode and formatReport', () => {
  it('exits non-zero when any check failed and prints one fix line per failure', () => {
    const results = runChecks({ ...HEALTHY, gitleaksVersion: null, hooksPath: null });
    expect(exitCode(results)).toBe(1);
    const report = formatReport(results);
    expect(report.match(/^ {2}fix: /gm)).toHaveLength(2);
    expect(report).toContain('brew install gitleaks');
  });
});

function deps(files: Record<string, string>, overrides: Partial<DoctorDeps> = {}) {
  const reads: string[] = [];
  const exists: string[] = [];
  const value: DoctorDeps = {
    root: '/repo',
    nodeVersion: '22.23.4',
    platform: 'darwin',
    home: '/home/dev',
    env: {},
    exists: (path) => {
      exists.push(path);
      return path in files;
    },
    read: (path) => {
      reads.push(path);
      return files[path] ?? null;
    },
    list: () => ['chromium-1200', 'webkit-2300'],
    run: (command) => (command === 'git' ? '.husky/_' : '1.0.0'),
    ...overrides,
  };
  return { value, reads, exists };
}

describe('collectProbes', () => {
  const FILES = {
    '/repo/.nvmrc': '22.23.4\n',
    '/repo/package.json': JSON.stringify({ packageManager: 'pnpm@10.34.9' }),
    '/repo/pnpm-lock.yaml': 'lock',
    '/repo/node_modules/.pnpm/lock.yaml': 'lock',
    '/repo/.env.local': 'SECRET=1',
  };

  it('never reads .env files, .npmrc or lib/env.ts, and only tests .env.local for existence', () => {
    const { value, reads, exists } = deps(FILES);
    const probes = collectProbes(value);
    expect(probes.envLocalPresent).toBe(true);
    expect(exists).toContain('/repo/.env.local');
    for (const path of reads) {
      expect(path).not.toMatch(/\.env|\.npmrc|lib\/env\.ts/);
    }
  });

  it('detects a lockfile that differs from the installed one', () => {
    const { value } = deps({ ...FILES, '/repo/node_modules/.pnpm/lock.yaml': 'older' });
    expect(collectProbes(value).lockfileInSync).toBe(false);
  });

  it('reports an unknown lockfile state when node_modules has no lock copy', () => {
    const without: Record<string, string> = { ...FILES };
    delete without['/repo/node_modules/.pnpm/lock.yaml'];
    expect(collectProbes(deps(without).value).lockfileInSync).toBeNull();
  });

  it('finds Playwright browsers in the platform cache and reports none when empty', () => {
    expect(collectProbes(deps(FILES).value).playwrightBrowsers).toBe(true);
    expect(collectProbes(deps(FILES, { list: () => [] }).value).playwrightBrowsers).toBe(false);
  });

  it('treats a missing binary as null', () => {
    const { value } = deps(FILES, { run: () => null });
    const probes = collectProbes(value);
    expect(probes.gitleaksVersion).toBeNull();
    expect(probes.pnpmVersion).toBeNull();
    expect(probes.hooksPath).toBeNull();
  });
});
