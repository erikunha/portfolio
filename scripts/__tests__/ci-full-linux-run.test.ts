import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  allowedEnv,
  childEnv,
  killAllChildren,
  parseArgs,
  pendingContainerNames,
  runStages,
  type StageResult,
  sweepPendingContainers,
} from '../ci/ci-full-run';
import type { Stage } from '../ci/ci-full-stages';

const NODE = process.execPath;
const TEST_TIMEOUT_MS = 60_000;
const EXECUTABLE_MODE = 0o755;
const POLL_MS = 25;
const REGISTER_WAIT_MS = 10_000;
const SHORT_STAGE_TIMEOUT_MS = 400;
const STAGE_IDS = ['ci-local', 'build', 'linux-e2e-chromium'];
const dirs: string[] = [];
const originalPath = process.env.PATH;

function scratch(): string {
  const dir = mkdtempSync(join(tmpdir(), 'ci-full-linux-run-'));
  dirs.push(dir);
  return dir;
}

function fakeDocker(log: string, psOutput = ''): string {
  const bin = join(scratch(), 'bin');
  mkdirSync(bin);
  const script = `#!/bin/sh\necho "$@" >> ${JSON.stringify(log)}\nif [ "$1" = ps ]; then printf '%s' ${JSON.stringify(psOutput)}; fi\nexit 0\n`;
  writeFileSync(join(bin, 'docker'), script);
  chmodSync(join(bin, 'docker'), EXECUTABLE_MODE);
  return bin;
}

const containerStage = (id: string, code: string): Stage => ({
  id,
  title: id,
  jobs: [],
  mirrors: [],
  steps: [],
  command: () => ({
    file: NODE,
    args: ['-e', code],
    container: { name: `ci-full-1-${id}`, label: 'ci-full.run=1' },
  }),
});

const OPTIONS = { keepGoing: false, log: () => undefined };
const verdicts = (results: StageResult[]) => results.map((result) => result.verdict);

afterEach(() => {
  process.env.PATH = originalPath;
  killAllChildren();
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('docker environment', () => {
  it('lets the DOCKER_ names through so the client reaches its daemon and context', () => {
    const env = allowedEnv({
      DOCKER_HOST: 'unix:///var/run/docker.sock',
      DOCKER_CONFIG: '/home/u/.docker',
      DOCKER_CONTEXT: 'colima',
      DOCKERISH: 'x',
      MY_DOCKER_TOKEN: 'secret',
      GITHUB_TOKEN: 'secret',
    });
    expect(Object.keys(env).sort()).toEqual(['DOCKER_CONFIG', 'DOCKER_CONTEXT', 'DOCKER_HOST']);
  });

  it('carries them to the child process', () => {
    const env = childEnv({ env: {} }, { DOCKER_HOST: 'tcp://127.0.0.1:2375', OPENAI_API_KEY: 'k' });
    expect(env.DOCKER_HOST).toBe('tcp://127.0.0.1:2375');
    expect(env.OPENAI_API_KEY).toBeUndefined();
  });
});

describe('arguments for the linux stages', () => {
  it('reads --linux as changed and --linux=<scope> as that scope, off by default', () => {
    expect(parseArgs([], STAGE_IDS).linux).toBeUndefined();
    expect(parseArgs(['--linux'], STAGE_IDS).linux).toBe('changed');
    expect(parseArgs(['--linux=gate'], STAGE_IDS).linux).toBe('gate');
    expect(parseArgs(['--linux=changed'], STAGE_IDS).linux).toBe('changed');
    expect(parseArgs(['--linux=all'], STAGE_IDS).linux).toBe('all');
  });

  it('refuses a scope it does not know and an empty one', () => {
    expect(() => parseArgs(['--linux=nope'], STAGE_IDS)).toThrow(/unknown linux scope nope.*gate/);
    expect(() => parseArgs(['--linux='], STAGE_IDS)).toThrow('unknown linux scope');
  });

  it('reads --only as a list of stages and refuses one that is no stage', () => {
    expect(parseArgs(['--only', 'build,linux-e2e-chromium'], STAGE_IDS).only).toEqual([
      'build',
      'linux-e2e-chromium',
    ]);
    expect(() => parseArgs(['--only', 'build,nope'], STAGE_IDS)).toThrow(/nope.*ci-local/);
    expect(() => parseArgs(['--only'], STAGE_IDS)).toThrow('--only needs a value');
  });

  it('keeps every other default as before', () => {
    expect(parseArgs([], STAGE_IDS)).toMatchObject({
      base: 'origin/main',
      keepGoing: false,
      list: false,
    });
  });
});

describe('runStages with --only', { timeout: TEST_TIMEOUT_MS }, () => {
  it('runs the selected stages and reports the others as not selected', async () => {
    const root = scratch();
    const marks = join(root, 'marks');
    const mark = (id: string): Stage => ({
      id,
      title: id,
      jobs: [],
      mirrors: [],
      steps: [],
      command: () => ({
        file: NODE,
        args: ['-e', `require('fs').appendFileSync(${JSON.stringify(marks)}, '${id}\\n')`],
      }),
    });
    const results = await runStages({
      ...OPTIONS,
      root,
      base: 'HEAD',
      only: ['b'],
      stages: [mark('a'), mark('b'), mark('c')],
      server: { command: { file: NODE, args: [] }, portEnv: 'PORT' },
    });
    expect(verdicts(results)).toEqual(['not-run', 'passed', 'not-run']);
    expect(results[0]?.note).toBe('not selected by --only');
    expect(readFileSync(marks, 'utf8')).toBe('b\n');
  });
});

describe('container cleanup', { timeout: TEST_TIMEOUT_MS }, () => {
  const server = { command: { file: NODE, args: [] }, portEnv: 'PORT' };

  it('removes the stage container by name after a pass and after a failure', async () => {
    const log = join(scratch(), 'docker.log');
    process.env.PATH = `${fakeDocker(log)}:${originalPath}`;
    const results = await runStages({
      ...OPTIONS,
      root: scratch(),
      base: 'HEAD',
      keepGoing: true,
      stages: [containerStage('ok', 'process.exit(0)'), containerStage('bad', 'process.exit(1)')],
      server,
    });
    expect(verdicts(results)).toEqual(['passed', 'failed']);
    const calls = readFileSync(log, 'utf8').split('\n').filter(Boolean);
    expect(calls).toContain('rm --force --volumes ci-full-1-ok');
    expect(calls).toContain('rm --force --volumes ci-full-1-bad');
    expect(pendingContainerNames()).toEqual([]);
  });

  it('kills a stage that outlives its limit, then removes its container', async () => {
    const log = join(scratch(), 'docker.log');
    process.env.PATH = `${fakeDocker(log)}:${originalPath}`;
    const results = await runStages({
      ...OPTIONS,
      root: scratch(),
      base: 'HEAD',
      stageTimeoutMs: SHORT_STAGE_TIMEOUT_MS,
      stages: [containerStage('slow', 'setTimeout(() => {}, 60000)')],
      server,
    });
    expect(results[0]?.verdict).toBe('failed');
    expect(results[0]?.note).toContain('timed out');
    expect(readFileSync(log, 'utf8')).toContain('rm --force --volumes ci-full-1-slow');
  });

  it('sweeps by label the containers a killed run left, and leaves none registered', async () => {
    const log = join(scratch(), 'docker.log');
    process.env.PATH = `${fakeDocker(log, 'abc123\n')}:${originalPath}`;
    const root = scratch();
    const run = runStages({
      ...OPTIONS,
      root,
      base: 'HEAD',
      stages: [containerStage('hang', 'setTimeout(() => {}, 60000)')],
      server,
    });
    const deadline = Date.now() + REGISTER_WAIT_MS;
    while (pendingContainerNames().length === 0 && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    }
    expect(pendingContainerNames()).toEqual(['ci-full-1-hang']);
    sweepPendingContainers();
    killAllChildren();
    await run;
    const calls = readFileSync(log, 'utf8').split('\n').filter(Boolean);
    expect(calls).toContain('ps --all --quiet --filter label=ci-full.run=1');
    expect(calls).toContain('rm --force --volumes abc123');
    expect(pendingContainerNames()).toEqual([]);
  });
});
