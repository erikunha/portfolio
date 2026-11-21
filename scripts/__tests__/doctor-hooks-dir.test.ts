import { execFileSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  collectProbes,
  type DoctorDeps,
  exitCode,
  formatReport,
  type Probes,
  realDeps,
  runChecks,
} from '../ci/doctor.ts';

const HOOKS_PATH = '.husky/_';
const FIX = 'run pnpm exec husky (or pnpm install) in this checkout';

const HEALTHY: Probes = {
  nodeVersion: '22.23.4',
  nvmrc: '22.23.4',
  pnpmVersion: '10.34.9',
  packageManager: 'pnpm@10.34.9',
  gitleaksVersion: '8.30.0',
  nodeModulesInstalled: true,
  lockfileInSync: true,
  playwrightBrowsers: true,
  hooksPath: HOOKS_PATH,
  hooksDirReady: true,
  envLocalPresent: true,
};

function hooksCheck(probes: Probes) {
  const found = runChecks(probes).find((result) => result.name === 'hooks');
  if (!found) throw new Error('no hooks check');
  return found;
}

describe('hooks check on the effective hooks directory', () => {
  it('fails, naming the fix, when core.hooksPath is set but the directory is not usable', () => {
    const result = hooksCheck({ ...HEALTHY, hooksDirReady: false });
    expect(result.status).toBe('fail');
    expect(result.fix).toBe(FIX);
    expect(exitCode(runChecks({ ...HEALTHY, hooksDirReady: false }))).toBe(1);
    expect(formatReport(runChecks({ ...HEALTHY, hooksDirReady: false }))).toContain(FIX);
  });

  it('passes when the effective hooks directory holds an executable pre-commit', () => {
    expect(hooksCheck(HEALTHY).status).toBe('ok');
  });
});

describe('collectProbes hooksDirReady', () => {
  function deps(hooksDir: string | null, executable: boolean): DoctorDeps {
    return {
      root: '/repo',
      nodeVersion: '22.23.4',
      platform: 'darwin',
      home: '/home',
      env: {},
      exists: () => true,
      read: () => null,
      list: () => [],
      run: (command, args) => {
        if (command === 'git' && args[0] === 'rev-parse') return hooksDir;
        if (command === 'git') return HOOKS_PATH;
        if (command === 'test') return executable ? '' : null;
        return '1.0.0';
      },
    };
  }

  it('is false when git reports a directory without an executable pre-commit', () => {
    expect(collectProbes(deps(HOOKS_PATH, false)).hooksDirReady).toBe(false);
  });

  it('is true when the pre-commit in the reported directory is executable', () => {
    expect(collectProbes(deps(HOOKS_PATH, true)).hooksDirReady).toBe(true);
  });

  it('is false when git cannot report a hooks directory', () => {
    expect(collectProbes(deps(null, true)).hooksDirReady).toBe(false);
  });
});

describe('a real checkout whose core.hooksPath points at a generated directory', () => {
  const created: string[] = [];

  afterEach(() => {
    for (const path of created.splice(0)) rmSync(path, { recursive: true, force: true });
  });

  function checkout(): string {
    const root = mkdtempSync(join(tmpdir(), 'doctor-hooks-'));
    created.push(root);
    execFileSync('git', ['init', '--quiet'], { cwd: root });
    execFileSync('git', ['config', 'core.hooksPath', HOOKS_PATH], { cwd: root });
    return root;
  }

  it('fails until the generated hooks directory has an executable pre-commit', () => {
    const root = checkout();
    expect(collectProbes(realDeps(root)).hooksDirReady).toBe(false);
    const hooks = join(root, HOOKS_PATH);
    mkdirSync(hooks, { recursive: true });
    const preCommit = join(hooks, 'pre-commit');
    writeFileSync(preCommit, '#!/bin/sh\n');
    expect(collectProbes(realDeps(root)).hooksDirReady).toBe(false);
    chmodSync(preCommit, 0o755);
    expect(collectProbes(realDeps(root)).hooksDirReady).toBe(true);
  });
});
