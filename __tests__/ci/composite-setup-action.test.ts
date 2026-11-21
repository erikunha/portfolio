import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

// behavioral-test-allow: the artifacts under test ARE the workflow files and the composite action; their step lists have no runtime surface in this repository.
const GITHUB_DIR = join(process.cwd(), '.github');
const ACTION_PATH = join(GITHUB_DIR, 'actions', 'setup', 'action.yml');
const LOCAL_ACTION = './.github/actions/setup';
const SHA_PIN = /^[\w.-]+\/[\w.-]+(?:\/[^@\s]+)?@[0-9a-f]{40}$/;
const RAW_PNPM_INSTALL = /\bpnpm install\b(?![^\n]*--lockfile-only)/;
const RAW_SETUP_ACTIONS = ['pnpm/action-setup@'];

const SHARED_WORKFLOWS = [
  'ci.yml',
  'ask-eval.yml',
  'mutation.yml',
  'codeql.yml',
  'lockfile-resolution-probe.yml',
];

const KEPT_RAW_SETUP: Record<string, { jobs: string[]; reason: string }> = {
  'rollback-rehearsal.yml': {
    jobs: ['rehearse'],
    reason:
      'it reverts the latest commit between checkout and install, so toolchain, cache key and install all read the reverted tree',
  },
};

type Step = {
  name?: string;
  uses?: string;
  run?: string;
  if?: string;
  with?: Record<string, unknown>;
};
type Job = { steps?: Step[] };
type Workflow = { jobs: Record<string, Job> };
type Action = {
  inputs?: Record<string, { default?: string }>;
  runs: { using: string; steps: Step[] };
};

const readYaml = <T>(path: string): T => parse(readFileSync(path, 'utf8')) as T;
const workflow = (file: string) => readYaml<Workflow>(join(GITHUB_DIR, 'workflows', file));
const action = (): Action => readYaml<Action>(ACTION_PATH);

const jobsOf = (file: string) =>
  Object.entries(workflow(file).jobs).map(([id, job]) => ({ id, steps: job.steps ?? [] }));

describe('the shared install setup composite action', () => {
  it('exists as a composite action', () => {
    expect(existsSync(ACTION_PATH)).toBe(true);
    expect(action().runs.using).toBe('composite');
  });

  it('pins every action it uses to a commit SHA', () => {
    const unpinned = action()
      .runs.steps.filter((step) => step.uses !== undefined)
      .map((step) => step.uses ?? '')
      .filter((uses) => !SHA_PIN.test(uses.split(' ')[0] ?? ''));
    expect(unpinned).toEqual([]);
  });

  it('sets up pnpm, then node from .nvmrc, then installs from the frozen lockfile', () => {
    const steps = action().runs.steps;
    const pnpm = steps.findIndex((step) => step.uses?.startsWith('pnpm/action-setup@'));
    const node = steps.findIndex((step) => step.uses?.startsWith('actions/setup-node@'));
    const install = steps.findIndex((step) => step.run === 'pnpm install --frozen-lockfile');
    expect(pnpm).toBeGreaterThanOrEqual(0);
    expect(node).toBeGreaterThan(pnpm);
    expect(install).toBeGreaterThan(node);
    expect(steps[node]?.with?.['node-version-file']).toBe('.nvmrc');
  });

  it('caches the pnpm store and installs by default, so a bare call matches the old inline steps', () => {
    const inputs = action().inputs ?? {};
    expect(inputs.cache?.default).toBe('true');
    expect(inputs.install?.default).toBe('true');
  });
});

describe('workflows that install through the shared setup action', () => {
  it.each(SHARED_WORKFLOWS)(
    '%s never runs pnpm install or the pnpm setup action itself',
    (file) => {
      const offenders = jobsOf(file).flatMap(({ id, steps }) =>
        steps
          .filter(
            (step) =>
              RAW_PNPM_INSTALL.test(step.run ?? '') ||
              RAW_SETUP_ACTIONS.some((prefix) => step.uses?.startsWith(prefix)),
          )
          .map((step) => `${id}: ${step.name ?? step.run ?? step.uses}`),
      );
      expect(offenders).toEqual([]);
    },
  );

  it.each(SHARED_WORKFLOWS)(
    '%s configures the pnpm cache only through the local action',
    (file) => {
      const offenders = jobsOf(file).flatMap(({ id, steps }) =>
        steps
          .filter(
            (step) =>
              step.uses?.startsWith('actions/setup-node@') && step.with?.cache !== undefined,
          )
          .map(() => id),
      );
      expect(offenders).toEqual([]);
    },
  );

  it('keeps the local action after checkout in every job that calls it', () => {
    const early = SHARED_WORKFLOWS.flatMap((file) =>
      jobsOf(file)
        .filter(({ steps }) => steps.some((step) => step.uses === LOCAL_ACTION))
        .filter(({ steps }) => {
          const checkout = steps.findIndex((step) => step.uses?.startsWith('actions/checkout@'));
          const local = steps.findIndex((step) => step.uses === LOCAL_ACTION);
          return checkout < 0 || checkout > local;
        })
        .map(({ id }) => `${file}:${id}`),
    );
    expect(early).toEqual([]);
  });

  it('calls the local action at least once (anti-vacuous)', () => {
    const calls = SHARED_WORKFLOWS.flatMap((file) =>
      jobsOf(file).flatMap(({ steps }) => steps.filter((step) => step.uses === LOCAL_ACTION)),
    );
    expect(calls.length).toBeGreaterThan(0);
  });

  it.each(Object.entries(KEPT_RAW_SETUP))(
    '%s keeps its own setup only in the jobs listed with a reason',
    (file, { jobs, reason }) => {
      expect(reason.length).toBeGreaterThan(0);
      const raw = jobsOf(file)
        .filter(({ steps }) =>
          steps.some(
            (step) =>
              RAW_PNPM_INSTALL.test(step.run ?? '') ||
              RAW_SETUP_ACTIONS.some((prefix) => step.uses?.startsWith(prefix)),
          ),
        )
        .map(({ id }) => id);
      expect(raw).toEqual(jobs);
    },
  );
});
