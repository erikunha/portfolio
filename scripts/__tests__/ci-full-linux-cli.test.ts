import { spawnSync } from 'node:child_process';
import {
  accessSync,
  chmodSync,
  constants,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { LINUX_STAGES, NOT_RUN, STAGES } from '../ci/ci-full-stages';

const CLI_TIMEOUT_MS = 90_000;
const USAGE_EXIT = 2;
const NOT_VERIFIED_EXIT = 3;
const NODE = process.execPath;
const EXECUTABLE_MODE = 0o755;
const FIRST_LINUX = 'linux-e2e-webkit-desktop';
const dirs: string[] = [];

const run = (args: string[], env: NodeJS.ProcessEnv = process.env) =>
  spawnSync(NODE, ['--import', 'tsx', 'scripts/ci/ci-full.ts', ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env,
  });

const executable = (path: string): boolean => {
  try {
    accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
};

function which(name: string): string {
  const found = (process.env.PATH ?? '')
    .split(delimiter)
    .map((dir) => join(dir, name))
    .find(executable);
  if (found === undefined) throw new Error(`${name} is not on PATH`);
  return found;
}

function pathWith(docker: string | undefined): NodeJS.ProcessEnv {
  const dir = mkdtempSync(join(tmpdir(), 'ci-full-path-'));
  dirs.push(dir);
  const bin = join(dir, 'bin');
  mkdirSync(bin);
  symlinkSync(which('git'), join(bin, 'git'));
  if (docker !== undefined) {
    writeFileSync(join(bin, 'docker'), docker);
    chmodSync(join(bin, 'docker'), EXECUTABLE_MODE);
  }
  return { ...process.env, PATH: bin };
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('ci:full --linux command line', { timeout: CLI_TIMEOUT_MS }, () => {
  it('lists no linux stage by default and declares one not-run entry that names the flag', () => {
    const result = run(['--list']);
    expect(result.status).toBe(0);
    expect(result.stdout).not.toContain('linux-e2e-');
    expect(result.stdout).toContain('linux e2e');
    expect(result.stdout).toContain('pass --linux');
    for (const entry of NOT_RUN) expect(result.stdout).toContain(entry.id);
    expect(result.stdout.match(/linux e2e/g)).toHaveLength(1);
  });

  it('lists the five linux stages after every default stage with --linux=gate, and drops the not-run entry', () => {
    const result = run(['--list', '--linux=gate']);
    expect(result.status).toBe(0);
    const lines = result.stdout.split('\n');
    const at = (id: string) => lines.findIndex((line) => line.includes(`${id}  `));
    const last = at(STAGES[STAGES.length - 1]?.id ?? '');
    const linux = LINUX_STAGES.map((stage) => at(stage.id));
    expect(last).toBeGreaterThan(-1);
    expect(linux.every((position, index) => position > (linux[index - 1] ?? last))).toBe(true);
    expect(result.stdout).toContain('tests/e2e/drawer-dialog');
    expect(result.stdout).not.toContain('pass --linux');
  });

  it('reads a bare --linux as changed and shows where the changed specs are added', () => {
    const result = run(['--list', '--linux']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('specs-changed-since-the-merge-base');
    expect(result.stdout).toContain('tests/e2e/drawer-dialog');
  });

  it('lists the whole matrix project with --linux=all', () => {
    const result = run(['--list', '--linux=all']);
    expect(result.status).toBe(0);
    expect(result.stdout).not.toContain('drawer-dialog');
    expect(result.stdout).toContain('--output=/results tests/e2e/');
  });

  it('lists the three projects only the all scope adds, and no other scope lists them', () => {
    const extra = ['linux-e2e-chromium-mobile', 'linux-e2e-chromium-components'];
    const all = run(['--list', '--linux=all']).stdout;
    for (const id of [...extra, 'linux-e2e-chromium-mobile-components']) {
      expect(
        all.split('\n').some((line) => line.includes(`${id}  `)),
        id,
      ).toBe(true);
    }
    for (const scope of ['--linux=gate', '--linux']) {
      const listed = run(['--list', scope]).stdout;
      for (const id of extra) expect(listed, `${scope} ${id}`).not.toMatch(new RegExp(`${id}  `));
    }
  });

  it('reaches an all-only stage with --linux=all and exits 2 for it under another scope', () => {
    const reached = run(
      ['--base', 'HEAD', '--linux=all', '--only', 'linux-e2e-chromium-mobile'],
      pathWith(undefined),
    );
    expect(reached.status).toBe(NOT_VERIFIED_EXIT);
    expect(reached.stdout).toContain('docker is not installed');
    for (const scope of ['--linux=gate', '--linux']) {
      for (const flag of ['--from', '--only']) {
        const refused = run([scope, flag, 'linux-e2e-chromium-mobile']);
        expect(refused.status, `${scope} ${flag}`).toBe(USAGE_EXIT);
        expect(refused.stderr).toContain('linux-e2e-chromium-mobile needs --linux=all');
      }
    }
  });

  it('exits 2 on a scope that does not exist and names the scopes', () => {
    const result = run(['--linux=everything']);
    expect(result.status).toBe(USAGE_EXIT);
    expect(result.stderr).toContain('unknown linux scope everything');
    expect(result.stderr).toContain('gate, changed, all');
  });

  it('exits 2 for a linux stage asked for without --linux', () => {
    for (const flag of ['--from', '--only']) {
      const result = run([flag, FIRST_LINUX]);
      expect(result.status, flag).toBe(USAGE_EXIT);
      expect(result.stderr).toContain('needs --linux');
    }
  });

  it('explains the flag on --help', () => {
    const result = run(['--help']);
    expect(result.stdout).toContain('--linux');
    expect(result.stdout).toContain('--only');
    expect(result.stdout).toContain('gate');
  });

  it('exits 3, not 0 or 1, when docker is not installed, and runs no other stage', () => {
    const result = run(
      ['--base', 'HEAD', '--linux=gate', '--only', FIRST_LINUX],
      pathWith(undefined),
    );
    expect(result.status).toBe(NOT_VERIFIED_EXIT);
    expect(result.stdout).toContain('docker is not installed');
    expect(result.stdout).toContain('0 passed, 0 failed');
  });

  it('exits 3 when the docker daemon is down', () => {
    const result = run(
      ['--base', 'HEAD', '--linux=gate', '--only', FIRST_LINUX],
      pathWith('#!/bin/sh\nexit 1\n'),
    );
    expect(result.status).toBe(NOT_VERIFIED_EXIT);
    expect(result.stdout).toContain('the Docker daemon is not running');
  });

  it('streams the pull progress to stderr while the pull runs', () => {
    const script =
      '#!/bin/sh\ncase "$1" in info) exit 0;; pull) echo "layer abc: Pulling fs layer"; exit 1;; *) exit 1;; esac\n';
    const result = run(['--base', 'HEAD', '--linux=gate', '--only', FIRST_LINUX], pathWith(script));
    expect(result.status).toBe(NOT_VERIFIED_EXIT);
    expect(result.stderr).toContain('layer abc: Pulling fs layer');
    expect(result.stdout).not.toContain('Pulling fs layer');
  });

  it('exits 3 when the image cannot be pulled', () => {
    const script = '#!/bin/sh\ncase "$1" in info) exit 0;; *) exit 1;; esac\n';
    const result = run(['--base', 'HEAD', '--linux=gate', '--only', FIRST_LINUX], pathWith(script));
    expect(result.status).toBe(NOT_VERIFIED_EXIT);
    expect(result.stdout).toMatch(
      /docker pull mcr\.microsoft\.com\/playwright:v\d+\.\d+\.\d+-noble failed/,
    );
  });
});
