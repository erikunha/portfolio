import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runStages } from '../ci/ci-full-run';
import { STAGES, type Stage } from '../ci/ci-full-stages';
import { parseWorkflow, type Workflow, workflowEnvFor } from '../ci/ci-workflow';

const NODE = process.execPath;
const ROOT = process.cwd();
const ci = parseWorkflow(readFileSync(join(ROOT, '.github/workflows/ci.yml'), 'utf8'));

const WORKFLOW = parseWorkflow(`
name: T
on: push
env:
  TOP_LITERAL: top
  TOP_SHARED: from-workflow
  TOP_EXPRESSION: \${{ github.sha }}
jobs:
  alpha:
    runs-on: x
    env:
      ALPHA_LITERAL: alpha
      TOP_SHARED: from-alpha
      ALPHA_EXPRESSION: \${{ github.event.pull_request.head.sha || github.sha }}
      ALPHA_SECRET: \${{ secrets.GITHUB_TOKEN }}
    steps:
      - run: echo a
  beta:
    runs-on: x
    env:
      BETA_LITERAL: beta
    steps:
      - run: echo b
`);

const dirs: string[] = [];
afterEach(() => {
  vi.unstubAllEnvs();
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function repo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'ci-full-wf-'));
  dirs.push(dir);
  const git = (...args: string[]) =>
    spawnSync(
      'git',
      ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', ...args],
      { cwd: dir, encoding: 'utf8' },
    );
  git('init', '--quiet');
  writeFileSync(join(dir, 'a.ts'), 'export {};\n');
  git('add', '.');
  git('commit', '--quiet', '-m', 'init');
  return dir;
}

const dumpStage = (out: string, jobs: string[], extra: Partial<Stage> = {}): Stage => ({
  id: 'dump',
  title: 'dump',
  jobs,
  mirrors: [],
  steps: [],
  command: () => ({
    file: NODE,
    args: [
      '-e',
      `require('fs').writeFileSync(${JSON.stringify(out)}, JSON.stringify(process.env))`,
    ],
  }),
  ...extra,
});

async function envSeenBy(
  workflow: Workflow,
  jobs: string[],
  extra: Partial<Stage> = {},
): Promise<{ env: Record<string, string | undefined>; log: string[] }> {
  const root = repo();
  const out = join(root, 'env.json');
  const log: string[] = [];
  await runStages({
    stages: [dumpStage(out, jobs, extra)],
    root,
    base: 'HEAD',
    keepGoing: false,
    server: { command: { file: NODE, args: ['-e', ''] }, portEnv: 'PORT' },
    workflow,
    log: (line) => log.push(line),
  });
  return { env: JSON.parse(readFileSync(out, 'utf8')), log };
}

describe('workflowEnvFor', () => {
  it('merges the workflow env with the env of the mirrored jobs, the job winning', () => {
    const { env } = workflowEnvFor(WORKFLOW, ['alpha', 'beta']);
    expect(env).toEqual({
      TOP_LITERAL: 'top',
      TOP_SHARED: 'from-alpha',
      ALPHA_LITERAL: 'alpha',
      BETA_LITERAL: 'beta',
    });
  });

  it('skips every value that is an expression and names it as not reproduced', () => {
    const { env, notReproduced } = workflowEnvFor(WORKFLOW, ['alpha']);
    expect(Object.keys(env)).not.toContain('TOP_EXPRESSION');
    expect(Object.keys(env)).not.toContain('ALPHA_EXPRESSION');
    expect(notReproduced).toEqual([
      'workflow.TOP_EXPRESSION',
      'alpha.ALPHA_EXPRESSION',
      'alpha.ALPHA_SECRET',
    ]);
  });

  it('ignores jobs the stage does not mirror', () => {
    const { env } = workflowEnvFor(WORKFLOW, ['beta']);
    expect(env.ALPHA_LITERAL).toBeUndefined();
  });
});

describe('runStages with the workflow env', () => {
  it('gives a stage the workflow and job literals and never an expression or a secret', async () => {
    const { env, log } = await envSeenBy(WORKFLOW, ['alpha']);
    expect(env).toMatchObject({
      TOP_LITERAL: 'top',
      ALPHA_LITERAL: 'alpha',
      TOP_SHARED: 'from-alpha',
    });
    expect(env.TOP_EXPRESSION).toBeUndefined();
    expect(env.ALPHA_EXPRESSION).toBeUndefined();
    expect(env.ALPHA_SECRET).toBeUndefined();
    const reported = log.join('\n');
    for (const key of ['workflow.TOP_EXPRESSION', 'alpha.ALPHA_EXPRESSION', 'alpha.ALPHA_SECRET']) {
      expect(reported).toContain(key);
    }
  });

  it('sets CI=true whatever the shell exports', async () => {
    vi.stubEnv('CI', 'false');
    const { env } = await envSeenBy(WORKFLOW, []);
    expect(env.CI).toBe('true');
  });

  it('lets a stage remove CI again', async () => {
    const root = repo();
    const file = join(root, 'env.json');
    const dump = `require('fs').writeFileSync(${JSON.stringify(file)}, JSON.stringify(process.env))`;
    const withUnset: Stage = {
      ...dumpStage(file, []),
      command: () => ({ file: NODE, args: ['-e', dump], unset: ['CI'] }),
    };
    await runStages({
      stages: [withUnset],
      root,
      base: 'HEAD',
      keepGoing: false,
      server: { command: { file: NODE, args: ['-e', ''] }, portEnv: 'PORT' },
      workflow: WORKFLOW,
      log: () => undefined,
    });
    expect(JSON.parse(readFileSync(file, 'utf8')).CI).toBeUndefined();
  });
});

describe('the real ci.yml reaches the stages it mirrors', () => {
  const literal = (value: string) => !value.includes('${{');

  it('reaches the verify and test stages with the workflow-level env', async () => {
    const workflowLevel = Object.entries(ci.env).filter(([, value]) => literal(value));
    expect(workflowLevel.length).toBeGreaterThan(0);
    const verify = STAGES.find((stage) => stage.id === 'ci-local');
    expect(verify?.jobs).toContain('test');
    const { env } = await envSeenBy(ci, [...(verify?.jobs ?? [])]);
    for (const [key, value] of workflowLevel) expect(env[key], key).toBe(value);
  });

  it('gives every mirrored stage the literals of its jobs', () => {
    for (const stage of STAGES) {
      const { env } = workflowEnvFor(ci, stage.jobs);
      for (const [key, value] of Object.entries(ci.env)) {
        if (literal(value)) expect(env[key], `${stage.id} ${key}`).toBe(value);
      }
      for (const job of stage.jobs) {
        for (const [key, value] of Object.entries(ci.jobs[job]?.env ?? {})) {
          if (literal(value)) expect(env[key], `${stage.id} ${job} ${key}`).toBe(value);
        }
      }
    }
  });

  it('never passes a value that references secrets', () => {
    for (const stage of STAGES) {
      for (const value of Object.values(workflowEnvFor(ci, stage.jobs).env)) {
        expect(value).not.toContain('${{');
      }
    }
  });
});
