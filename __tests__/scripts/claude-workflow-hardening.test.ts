import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

// behavioral-test-allow: the artifacts under test ARE the workflow files; the checkout layout and the concurrency group have no runtime surface in this repository.
const read = (name: string) =>
  readFileSync(join(process.cwd(), '.github', 'workflows', name), 'utf8');

type Step = {
  uses?: string;
  name?: string;
  run?: string;
  with?: Record<string, unknown>;
};
type Workflow = {
  concurrency: { group: string; 'cancel-in-progress': boolean };
  jobs: Record<string, { if?: string; steps: Step[] }>;
};

const collapse = (expr: string) =>
  expr
    .split(/('(?:[^']|'')*')/)
    .map((part, i) => (i % 2 === 1 ? part : part.replace(/\s+/g, ' ')))
    .join('')
    .trim();

const doc = parse(read('claude.yml')) as Workflow;
const reviewDoc = parse(read('claude-review.yml')) as Workflow;
const job = doc.jobs.claude as Workflow['jobs'][string];
const steps = job.steps;
const actionAt = steps.findIndex((s) => s.uses?.startsWith('anthropics/claude-code-action'));
const checkouts = steps.filter((s) => s.uses?.startsWith('actions/checkout'));
const stripStep = steps.find((s) => s.name?.includes('Strip instruction-shaped'));
const reviewStrip = reviewDoc.jobs.review?.steps.find((s) =>
  s.name?.includes('Strip instruction-shaped'),
);

const nameSet = (block: string) => [...block.matchAll(/-name '([^']+)'/g)].map((m) => m[1]).sort();
const findBlocks = (run: string) =>
  run.split(/(?=find pr-head)/).filter((b) => b.startsWith('find pr-head'));

describe('claude.yml concurrency group mirrors the job condition', () => {
  it('admits exactly what the job admits and routes the rest to a per-run group', () => {
    const jobIf = collapse(String(job.if));
    const expected = `\${{ (${jobIf}) && format('claude-{0}', github.event.issue.number || github.event.pull_request.number) || format('claude-noop-{0}', github.run_id) }}`;
    expect(collapse(doc.concurrency.group)).toBe(expected);
  });

  it('never cancels a running answer', () => {
    expect(doc.concurrency['cancel-in-progress']).toBe(false);
  });
});

describe('claude.yml keeps pull-request content out of the instruction channel', () => {
  it('checks the default branch out at the root and the PR head into pr-head', () => {
    expect(checkouts).toHaveLength(2);
    const [root, head] = checkouts;
    expect(root?.with?.path).toBeUndefined();
    expect(String(root?.with?.ref)).toBe(
      // biome-ignore lint/suspicious/noTemplateCurlyInString: a GitHub Actions expression the workflow file spells literally, not a JS template.
      '${{ github.event.repository.default_branch }}',
    );
    expect(head?.with?.path).toBe('pr-head');
    expect(String(head?.with?.ref)).toContain('refs/pull/');
    expect(String(head?.with?.ref)).toContain('/head');
  });

  it('strips instruction-shaped files from pr-head before the action runs', () => {
    const stripAt = stripStep ? steps.indexOf(stripStep) : -1;
    expect(stripAt).toBeGreaterThanOrEqual(0);
    expect(stripAt).toBeLessThan(actionAt);
  });

  it('strips and verifies with the same names the review workflow uses', () => {
    const run = String(stripStep?.run);
    const reviewRun = String(reviewStrip?.run);
    const [remove, verify] = findBlocks(run).filter((b) => b.includes('-name'));
    const [reviewRemove] = findBlocks(reviewRun).filter((b) => b.includes('-name'));
    expect(nameSet(remove ?? '')).toEqual(nameSet(reviewRemove ?? ''));
    expect(nameSet(verify ?? '')).toEqual(nameSet(remove ?? ''));
    expect(run).toContain('exit 1');
  });

  it('deletes symlinks from pr-head before the name match', () => {
    const run = String(stripStep?.run);
    const link = run.indexOf('find pr-head -type l -delete');
    expect(link).toBeGreaterThanOrEqual(0);
    expect(link).toBeLessThan(run.indexOf("-name 'CLAUDE.md'"));
  });

  it('mounts pr-head, never the workspace root, as the extra directory', () => {
    const args = String(steps[actionAt]?.with?.claude_args);
    expect(args).toContain('--add-dir pr-head');
  });
});
