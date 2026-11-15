import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

// behavioral-test-allow: the artifact under test IS the workflow file; its schedule, token scope and commands have no runtime surface in this repository.
const PATH = join(process.cwd(), '.github', 'workflows', 'lockfile-resolution-probe.yml');
const TEXT = readFileSync(PATH, 'utf8');

type Step = { name?: string; uses?: string; run?: string; env?: Record<string, string> };
type Workflow = {
  on: { schedule?: { cron: string }[]; workflow_dispatch?: unknown } & Record<string, unknown>;
  permissions?: Record<string, string>;
  jobs: Record<string, { permissions?: Record<string, string>; steps: Step[] }>;
};

const workflow = parse(TEXT) as Workflow;
const job = Object.values(workflow.jobs)[0];
const steps = job?.steps ?? [];
const runs = steps.map((s) => s.run ?? '').join('\n');
const SHA_PIN = /@[0-9a-f]{40}$/;
const EXPRESSION_OPEN = ['$', '{{'].join('');
const MATURE_ERROR = 'ERR_PNPM_NO_MATURE_MATCHING_VERSION';

describe('lockfile-resolution-probe workflow', () => {
  it('runs weekly and on demand only', () => {
    expect(Object.keys(workflow.on).sort()).toEqual(['schedule', 'workflow_dispatch']);
    expect(workflow.on.schedule).toHaveLength(1);
    expect(workflow.on.schedule?.[0]?.cron.split(' ')[4]).toMatch(/^[0-6]$/);
  });

  it('resolves without a frozen lockfile and without running install scripts', () => {
    expect(runs).toMatch(/pnpm install[^\n]*--lockfile-only/);
    expect(runs).not.toMatch(/--frozen-lockfile/);
    expect(runs).toMatch(/--ignore-scripts/);
  });

  it('reports on the release-age error by name', () => {
    expect(runs).toContain(MATURE_ERROR);
  });

  it('keeps the top level at contents: read and grants issues: write to the one job', () => {
    expect(workflow.permissions).toEqual({ contents: 'read' });
    expect(job?.permissions).toEqual({ contents: 'read', issues: 'write' });
  });

  it('pins every action to a commit SHA', () => {
    const unpinned = steps.filter(
      (s) => s.uses !== undefined && !SHA_PIN.test(s.uses.split(' ')[0] ?? ''),
    );
    expect(unpinned).toEqual([]);
  });

  it('uses no secret except the repository token and never expands an expression inside a script', () => {
    const refs = [...TEXT.matchAll(/secrets\.([A-Z0-9_]+)/g)].map((m) => m[1]);
    expect(new Set(refs)).toEqual(new Set(['GITHUB_TOKEN']));
    expect(steps.filter((s) => s.run?.includes(EXPRESSION_OPEN))).toEqual([]);
  });

  it('opens one issue and updates it instead of opening a second, and closes it once resolution works', () => {
    expect(runs).toMatch(/gh issue list/);
    expect(runs).toMatch(/gh issue create/);
    expect(runs).toMatch(/gh issue comment/);
    expect(runs).toMatch(/gh issue close/);
  });

  it('uses the same action SHAs as ci.yml for the actions it shares', () => {
    const ci = readFileSync(join(process.cwd(), '.github', 'workflows', 'ci.yml'), 'utf8');
    const ciPins = new Set(
      [...ci.matchAll(/uses:\s*(\S+@[0-9a-f]{40})/g)].map((m) => m[1] as string),
    );
    const own = steps.map((s) => s.uses?.split(' ')[0]).filter((u): u is string => u !== undefined);
    expect(own.length).toBeGreaterThan(0);
    expect(own.filter((u) => !ciPins.has(u))).toEqual([]);
  });
});
