import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

// behavioral-test-allow: the artifact under test IS the workflow file; its token scope, triggers and pinned actions have no runtime surface in this repository.
const WORKFLOW_PATH = join(process.cwd(), '.github', 'workflows', 'weekly-metrics.yml');
const WORKFLOW_TEXT = readFileSync(WORKFLOW_PATH, 'utf8');

type Step = {
  name?: string;
  id?: string;
  if?: string;
  'continue-on-error'?: boolean;
  uses?: string;
  run?: string;
  env?: Record<string, string>;
};
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

  it('has no trailing comment on the cron line, so the schedule reads as one value', () => {
    expect(WORKFLOW_TEXT).toMatch(/- cron: "0 7 \* \* 1"\n/);
    const schedule = workflow.on.schedule as { cron: string }[];
    expect(schedule).toEqual([{ cron: '0 7 * * 1' }]);
  });

  it('fails closed on the previous history: the download may be skipped only when no earlier run exists', () => {
    const download = steps.find((s) => s.uses?.startsWith('actions/download-artifact'));
    expect(download).toBeDefined();
    expect(download?.['continue-on-error']).toBeUndefined();
    expect(download?.if).toBe("steps.previous.outputs.run_id != ''");
    expect(download).toMatchObject({ with: { name: 'metrics-weekly' } });
  });

  it('checks the downloaded history file exists whenever an earlier run was found', () => {
    const verify = steps.find((s) => s.name === 'Verify the previous history');
    expect(verify?.if).toBe("steps.previous.outputs.run_id != ''");
    expect(verify?.['continue-on-error']).toBeUndefined();
    expect(verify?.run).toMatch(/test -s metrics\/weekly\.json/);
  });

  it('sets continue-on-error on no step, so no failure is swallowed', () => {
    expect(steps.filter((s) => s['continue-on-error'] !== undefined)).toEqual([]);
  });

  it('runs find, download, verify, collect, bands, upload and issues in that order', () => {
    const position = (match: (s: Step) => boolean) => steps.findIndex(match);
    const order = [
      position((s) => s.id === 'previous'),
      position((s) => s.uses?.startsWith('actions/download-artifact') === true),
      position((s) => s.name === 'Verify the previous history'),
      position((s) => s.run?.includes('scripts/metrics/collect.mjs') === true),
      position((s) => s.run?.includes('scripts/metrics/bands.mjs') === true),
      position((s) => s.uses?.startsWith('actions/upload-artifact') === true),
      position((s) => s.run?.includes('scripts/metrics/issues.mjs') === true),
    ];
    expect(order.every((index) => index >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('looks up the previous run by the successful runs of this workflow only', () => {
    const find = steps.find((s) => s.id === 'previous');
    expect(find?.run).toMatch(/--workflow weekly-metrics\.yml/);
    expect(find?.run).toMatch(/--status success/);
  });
});
