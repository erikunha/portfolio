import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

// behavioral-test-allow: the artifact under test IS the workflow file; its token scope, triggers and pinned actions have no runtime surface in this repository.
const WORKFLOW_PATH = join(process.cwd(), '.github', 'workflows', 'weekly-metrics.yml');
const WORKFLOW_TEXT = readFileSync(WORKFLOW_PATH, 'utf8');

type Step = { uses?: string; run?: string; env?: Record<string, string> };
type Workflow = {
  on: Record<string, unknown>;
  permissions?: Record<string, string>;
  jobs: Record<string, { permissions?: Record<string, string>; steps: Step[] }>;
};

const workflow = parse(WORKFLOW_TEXT) as Workflow;
const job = Object.values(workflow.jobs)[0];
const steps = job?.steps ?? [];
const SHA_PIN = /@[0-9a-f]{40}$/;

describe('weekly-metrics workflow', () => {
  it('runs on a schedule and by hand, never on a push or a pull request', () => {
    expect(Object.keys(workflow.on).sort()).toEqual(['schedule', 'workflow_dispatch']);
  });

  it('starts from no token and grants the job read access plus issue writes only', () => {
    expect(workflow.permissions).toEqual({});
    expect(job?.permissions).toEqual({
      contents: 'read',
      actions: 'read',
      deployments: 'read',
      'pull-requests': 'read',
      issues: 'write',
    });
  });

  it('pins every action to a commit SHA', () => {
    const unpinned = steps.filter(
      (s) => s.uses !== undefined && !SHA_PIN.test(s.uses.split(' ')[0] ?? ''),
    );
    expect(unpinned).toEqual([]);
  });

  it('uses no secret except the repository token, so detection cannot reach a model or a deploy key', () => {
    const refs = [...WORKFLOW_TEXT.matchAll(/secrets\.([A-Z0-9_]+)/g)].map((m) => m[1]);
    expect(new Set(refs)).toEqual(new Set(['GITHUB_TOKEN']));
    expect(refs.length).toBeGreaterThan(0);
  });

  it('never expands a context expression inside a run script', () => {
    const inline = steps.filter((s) => s.run?.includes('${{'));
    expect(inline).toEqual([]);
  });

  it('checks out without leaving credentials in the git config', () => {
    const checkout = steps.find((s) => s.uses?.startsWith('actions/checkout'));
    expect(checkout).toMatchObject({ with: { 'persist-credentials': false } });
  });

  it('runs scripts that exist and reads the band config that is committed', () => {
    const scripts = steps
      .flatMap((s) => [...(s.run ?? '').matchAll(/scripts\/metrics\/[\w.-]+\.mjs/g)])
      .map((m) => m[0]);
    expect(scripts.length).toBe(3);
    for (const script of scripts) expect(existsSync(join(process.cwd(), script))).toBe(true);
    expect(existsSync(join(process.cwd(), 'metrics', 'bands.json'))).toBe(true);
  });

  it('keeps the history artifact for the longest retention and fails when it is missing', () => {
    const upload = steps.find((s) => s.uses?.startsWith('actions/upload-artifact'));
    expect(upload).toMatchObject({
      with: { name: 'metrics-weekly', 'retention-days': 90, 'if-no-files-found': 'error' },
    });
  });
});
