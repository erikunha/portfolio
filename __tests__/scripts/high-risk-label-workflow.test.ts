import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

// behavioral-test-allow: the artifact under test IS the workflow file; its triggers, token scope and pinned actions have no runtime surface in this repository.
const WORKFLOW_PATH = join(process.cwd(), '.github', 'workflows', 'high-risk-label.yml');
const WORKFLOW_TEXT = readFileSync(WORKFLOW_PATH, 'utf8');

type Step = {
  name?: string;
  id?: string;
  if?: string;
  uses?: string;
  run?: string;
  env?: Record<string, string>;
  with?: Record<string, unknown>;
};
type Job = { permissions?: Record<string, string>; steps: Step[] };
type Workflow = {
  on: { pull_request?: { types?: string[] } } & Record<string, unknown>;
  permissions?: Record<string, string>;
  jobs: Record<string, Job>;
};

const workflow = parse(WORKFLOW_TEXT) as Workflow;
const job = Object.values(workflow.jobs)[0];
const steps = job?.steps ?? [];
const SHA_PIN = /@[0-9a-f]{40}$/;
const WRITE_LEVEL = 'write';
const EXPRESSION_OPEN = ['$', '{{'].join('');
const expression = (body: string) => [EXPRESSION_OPEN, ' ', body, ' }}'].join('');

describe('high-risk-label workflow', () => {
  it('runs only on pull_request opened, synchronize and reopened', () => {
    expect(Object.keys(workflow.on)).toEqual(['pull_request']);
    expect(workflow.on.pull_request?.types).toEqual(['opened', 'synchronize', 'reopened']);
  });

  it('has exactly one job', () => {
    expect(Object.keys(workflow.jobs)).toHaveLength(1);
  });

  it('keeps the top level at contents: read and grants write to the labelling job only', () => {
    expect(workflow.permissions).toEqual({ contents: 'read' });
    expect(job?.permissions).toEqual({ contents: 'read', 'pull-requests': WRITE_LEVEL });
  });

  it('never grants write on contents, so the job cannot push or deploy', () => {
    const grants = Object.entries(job?.permissions ?? {});
    expect(
      grants.filter(([scope, level]) => scope !== 'pull-requests' && level === WRITE_LEVEL),
    ).toEqual([]);
  });

  it('pins every action to a commit SHA', () => {
    const unpinned = steps.filter(
      (s) => s.uses !== undefined && !SHA_PIN.test(s.uses.split(' ')[0] ?? ''),
    );
    expect(unpinned).toEqual([]);
  });

  it('uses no secret except the repository token', () => {
    const refs = [...WORKFLOW_TEXT.matchAll(/secrets\.([A-Z0-9_]+)/g)].map((m) => m[1]);
    expect(new Set(refs)).toEqual(new Set(['GITHUB_TOKEN']));
  });

  it('never expands a context expression inside a run script', () => {
    expect(steps.filter((s) => s.run?.includes(EXPRESSION_OPEN))).toEqual([]);
  });

  it('runs no git push, deploy or package install', () => {
    const runs = steps.map((s) => s.run ?? '').join('\n');
    expect(runs).not.toMatch(/git\s+push|vercel|pnpm\s+(install|i)\b|npm\s+(install|ci)\b/);
  });

  it('checks out without leaving credentials in the git config', () => {
    const checkout = steps.find((s) => s.uses?.startsWith('actions/checkout'));
    expect(checkout).toMatchObject({ with: { 'persist-credentials': false } });
  });

  it('skips fork pull requests and Dependabot runs, whose token cannot write, with a notice', () => {
    const gate = steps.find((s) => s.id === 'gate');
    expect(gate?.run).toMatch(/::notice::/);
    expect(gate?.env).toMatchObject({
      HEAD_REPO: expression('github.event.pull_request.head.repo.full_name'),
      BASE_REPO: expression('github.repository'),
      ACTOR: expression('github.actor'),
    });
    expect(gate?.run).toMatch(/dependabot\[bot\]/);
    const gated = steps.filter((s) => s.id !== 'gate');
    expect(gated.length).toBeGreaterThan(0);
    for (const step of gated) {
      expect(step.if, step.name).toBe("steps.gate.outputs.skip != 'true'");
    }
  });

  it('serialises runs per pull request and cancels the superseded one', () => {
    const doc = parse(WORKFLOW_TEXT) as {
      concurrency?: { group?: string; 'cancel-in-progress'?: boolean };
    };
    expect(doc.concurrency?.group).toMatch(/pull_request\.number/);
    expect(doc.concurrency?.['cancel-in-progress']).toBe(true);
  });

  it('labels with the high-risk label and passes every untrusted value through env', () => {
    const sync = steps.find((s) => s.id === 'sync');
    expect(sync?.env).toMatchObject({
      LABEL: 'high-risk',
      PR_NUMBER: expression('github.event.pull_request.number'),
      GH_TOKEN: expression('secrets.GITHUB_TOKEN'),
    });
    expect(sync?.run).toMatch(/scripts\/high-risk-paths\.ts/);
    expect(sync?.run).toMatch(/gh label create/);
    expect(sync?.run).toMatch(/--method POST/);
    expect(sync?.run).toMatch(/--method DELETE/);
  });

  it('adds the label when a high-risk file is present and removes it when none is', () => {
    const run = steps.find((s) => s.id === 'sync')?.run ?? '';
    expect(run.indexOf('--method POST')).toBeGreaterThan(-1);
    expect(run.indexOf('--method DELETE')).toBeGreaterThan(run.indexOf('--method POST'));
  });

  it('includes the previous name of a renamed file, so moving a surface out is still flagged', () => {
    const run = steps.find((s) => s.id === 'sync')?.run ?? '';
    expect(run).toMatch(/previous_filename/);
  });

  it('runs a script that exists', () => {
    expect(existsSync(join(process.cwd(), 'scripts', 'high-risk-paths.ts'))).toBe(true);
  });
});
