import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

// behavioral-test-allow: the artifact under test IS the workflow file; its triggers, token scope and step order have no runtime surface in this repository.
const WORKFLOW_PATH = join(process.cwd(), '.github', 'workflows', 'rollback-rehearsal.yml');
const WORKFLOW_TEXT = readFileSync(WORKFLOW_PATH, 'utf8');
// behavioral-test-allow: ci.yml is read only to prove the rehearsal builds with the env the real build uses.
const CI_TEXT = readFileSync(join(process.cwd(), '.github', 'workflows', 'ci.yml'), 'utf8');

type Step = {
  name?: string;
  uses?: string;
  run?: string;
  env?: Record<string, string>;
  with?: Record<string, unknown>;
};
type Job = {
  needs?: string | string[];
  if?: string;
  permissions?: Record<string, string>;
  steps: Step[];
};
type Workflow = {
  on: Record<string, unknown>;
  permissions?: Record<string, string>;
  jobs: Record<string, Job>;
};

const workflow = parse(WORKFLOW_TEXT) as Workflow;
const rehearse = workflow.jobs.rehearse;
const report = workflow.jobs.report;
const rehearseSteps = rehearse?.steps ?? [];
const allSteps = Object.values(workflow.jobs).flatMap((job) => job.steps);
const SHA_PIN = /@[0-9a-f]{40}$/;
const FORBIDDEN_COMMANDS = [/git\s+push/, /vercel/i, /--force/];
const ORDERED_STEP_PATTERNS = [
  /git revert/,
  /pnpm install --frozen-lockfile/,
  /pnpm typecheck/,
  /pnpm test\b/,
  /pnpm build/,
];

const indexOfRun = (pattern: RegExp) => rehearseSteps.findIndex((s) => pattern.test(s.run ?? ''));

describe('rollback-rehearsal workflow', () => {
  it('runs on a schedule and by hand only, never on a push or a pull request', () => {
    expect(Object.keys(workflow.on).sort()).toEqual(['schedule', 'workflow_dispatch']);
  });

  it('sets the top-level token to contents: read and nothing broader', () => {
    expect(workflow.permissions).toEqual({ contents: 'read' });
  });

  it('gives the rehearsal job read access only and the report job issue writes only', () => {
    expect(rehearse?.permissions).toEqual({ contents: 'read' });
    expect(report?.permissions).toEqual({ issues: 'write' });
    const writers = Object.entries(workflow.jobs)
      .filter(([, job]) => Object.values(job.permissions ?? {}).includes('write'))
      .map(([name]) => name);
    expect(writers).toEqual(['report']);
  });

  it('pins every action to a commit SHA', () => {
    const unpinned = allSteps.filter(
      (s) => s.uses !== undefined && !SHA_PIN.test(s.uses.split(' ')[0] ?? ''),
    );
    expect(unpinned).toEqual([]);
  });

  it('pins each action to the SHA ci.yml already uses', () => {
    const used = allSteps.flatMap((s) => (s.uses ? [s.uses.split(' ')[0] ?? ''] : []));
    expect(used.length).toBeGreaterThan(0);
    for (const action of used) expect(CI_TEXT).toContain(action);
  });

  it('writes nothing to the remote and never touches the deployment platform', () => {
    const commands = allSteps.map((s) => `${s.run ?? ''}\n${JSON.stringify(s.env ?? {})}`);
    for (const forbidden of FORBIDDEN_COMMANDS) {
      expect(commands.filter((command) => forbidden.test(command))).toEqual([]);
    }
    expect(WORKFLOW_TEXT).not.toMatch(/secrets\.VERCEL|VERCEL_TOKEN/i);
  });

  it('runs the rehearsal with no secret, no API token and no network write', () => {
    const rehearsal = rehearseSteps.map(
      (s) => `${s.run ?? ''}\n${JSON.stringify(s.env ?? {})}\n${JSON.stringify(s.with ?? {})}`,
    );
    for (const forbidden of [
      /secrets\./,
      /GH_TOKEN|GITHUB_TOKEN/,
      /\bgh\s+(api|pr|release|issue)\b/,
      /\bcurl\b/,
    ]) {
      expect(
        rehearsal.filter((step) => forbidden.test(step)),
        'the rehearse job must stay unable to reach anything outside the runner',
      ).toEqual([]);
    }
  });

  it('checks out main with full history and no stored credentials', () => {
    const checkout = rehearseSteps.find((s) => s.uses?.startsWith('actions/checkout'));
    expect(checkout?.with).toMatchObject({
      ref: 'main',
      'fetch-depth': 0,
      'persist-credentials': false,
    });
  });

  it('reverts, installs, typechecks, tests and builds in that order', () => {
    const order = ORDERED_STEP_PATTERNS.map(indexOfRun);
    expect(order.every((index) => index >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('reverts the latest commit on main, with the first parent for a merge commit', () => {
    const revert = rehearseSteps[indexOfRun(/git revert/)]?.run ?? '';
    expect(revert).toMatch(/git revert -m 1 --no-edit HEAD/);
    expect(revert).toMatch(/git revert --no-edit HEAD/);
  });

  it('builds with the same fixed env as the CI build', () => {
    const build = rehearseSteps[indexOfRun(/pnpm build/)];
    expect(build?.env).toMatchObject({
      DEPLOY_SALT: 'ci-build-salt',
      E2E_LINKS_FEED_FIXTURE: 'tests/e2e/fixtures/links-feed.json',
    });
    expect(CI_TEXT).toContain('DEPLOY_SALT: ci-build-salt');
    expect(CI_TEXT).toContain('E2E_LINKS_FEED_FIXTURE: tests/e2e/fixtures/links-feed.json');
  });

  it('opens or updates one issue when the rehearsal fails, and only then', () => {
    expect(report?.needs).toBe('rehearse');
    expect(report?.if).toBe('failure()');
    const script = report?.steps.map((s) => s.run ?? '').join('\n') ?? '';
    expect(script).toMatch(/gh issue list/);
    expect(script).toMatch(/gh issue comment/);
    expect(script).toMatch(/gh issue create/);
  });

  it('never expands a context expression inside a run script', () => {
    expect(allSteps.filter((s) => s.run?.includes('${{'))).toEqual([]);
  });

  it('has a timeout on every job', () => {
    expect(WORKFLOW_TEXT.match(/timeout-minutes:\s*\d+/g)?.length).toBe(
      Object.keys(workflow.jobs).length,
    );
  });
});
