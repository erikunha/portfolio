import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const root = join(__dirname, '..');

type Step = { name?: string; uses?: string; run?: string; env?: Record<string, string> };
type Job = {
  needs?: string[];
  permissions?: Record<string, string>;
  steps: Step[];
  if?: string;
};
type Workflow = {
  on: Record<string, { types?: string[] } | null>;
  permissions?: Record<string, string>;
  concurrency?: { group: string; 'cancel-in-progress': boolean };
  jobs: Record<string, Job>;
};

function load(name: string): Workflow {
  // behavioral-test-allow: the workflow file is the artifact under test; its triggers, permissions and steps have no other runtime surface.
  return parse(readFileSync(join(root, '.github/workflows', name), 'utf8')) as Workflow;
}

const prGate = load('pr-gate.yml');
const ci = load('ci.yml');
const gateJob = prGate.jobs['pr-gate'];
const EXPRESSION_OPEN = ['$', '{{'].join('');
const expression = (body: string) => `${EXPRESSION_OPEN} ${body} }}`;
const SHA_PIN = /@[0-9a-f]{40}(?:\s|$)/;

describe('pr-gate workflow', () => {
  it('re-runs when a PR changes and when a review is posted, edited or dismissed', () => {
    expect(Object.keys(prGate.on).sort()).toEqual(['pull_request', 'pull_request_review']);
    expect([...(prGate.on.pull_request?.types ?? [])].sort()).toEqual([
      'opened',
      'reopened',
      'synchronize',
    ]);
    expect([...(prGate.on.pull_request_review?.types ?? [])].sort()).toEqual([
      'dismissed',
      'edited',
      'submitted',
    ]);
  });

  it('holds read-only permissions and nothing wider', () => {
    expect(prGate.permissions).toEqual({ contents: 'read', 'pull-requests': 'read' });
    expect(gateJob?.permissions).toBeUndefined();
  });

  it('serialises per PR and cancels a superseded run, so the last event decides the check', () => {
    expect(prGate.concurrency?.group).toBe(
      `pr-gate-${expression('github.event.pull_request.number')}`,
    );
    expect(prGate.concurrency?.['cancel-in-progress']).toBe(true);
  });

  it('defines a job named pr-gate, the check context the ruleset lists, with no condition that skips it', () => {
    expect(gateJob).toBeDefined();
    expect(gateJob?.if).toBeUndefined();
  });

  it('runs the PR gate script for the event PR with the token and number passed through env', () => {
    const step = gateJob?.steps.find((s) => s.run?.includes('check-pr-comments'));
    expect(step).toBeDefined();
    expect(step?.env?.GH_TOKEN).toBe(expression('secrets.GITHUB_TOKEN'));
    expect(step?.env?.PR_NUMBER).toBe(expression('github.event.pull_request.number'));
    expect(step?.run).toContain('"$PR_NUMBER"');
  });

  it('puts no context expression inside a run script', () => {
    const offenders = (gateJob?.steps ?? []).filter((s) => s.run?.includes(EXPRESSION_OPEN));
    expect(offenders).toEqual([]);
  });

  it('pins every action to a commit SHA', () => {
    const unpinned = (gateJob?.steps ?? [])
      .filter((s) => s.uses !== undefined)
      .filter((s) => !SHA_PIN.test(`${s.uses}\n`));
    expect(unpinned).toEqual([]);
  });
});

describe('ci workflow no longer carries the PR gate', () => {
  const quality = ci.jobs['quality-fast'];

  it('quality-fast runs no pr:gate step and holds no pull-requests permission', () => {
    const gateSteps = (quality?.steps ?? []).filter(
      (s) => /check-pr-comments|pr:gate/.test(s.run ?? '') || /merge gate/i.test(s.name ?? ''),
    );
    expect(gateSteps).toEqual([]);
    expect(quality?.permissions).toEqual({ contents: 'read' });
  });

  it('ci-gate does not wait on a job from another workflow', () => {
    const needs = ci.jobs['ci-gate']?.needs ?? [];
    expect(needs.every((job) => ci.jobs[job] !== undefined)).toBe(true);
    expect(needs).not.toContain('pr-gate');
  });
});
