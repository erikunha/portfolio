import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

// behavioral-test-allow: the artifacts under test ARE the workflow files; the token a job runs with
// is a property of its YAML and has no runtime surface in this repository.
const WORKFLOW_DIR = join(process.cwd(), '.github', 'workflows');

type Workflow = {
  permissions?: Record<string, string> | string;
  jobs: Record<string, { permissions?: Record<string, string> | string }>;
};

const workflows = readdirSync(WORKFLOW_DIR)
  .filter((file) => file.endsWith('.yml'))
  .map((file) => ({
    file,
    workflow: parse(readFileSync(join(WORKFLOW_DIR, file), 'utf8')) as Workflow,
  }));

describe('workflow token permissions', () => {
  it.each(workflows)(
    '$file never leaves a job on the repository default token (default is write)',
    ({ workflow }) => {
      const uncovered = Object.entries(workflow.jobs)
        .filter(([, job]) => workflow.permissions === undefined && job.permissions === undefined)
        .map(([name]) => name);
      expect(uncovered).toEqual([]);
    },
  );

  it.each(workflows)('$file never grants write-all', ({ workflow }) => {
    const grants = [
      workflow.permissions,
      ...Object.values(workflow.jobs).map((job) => job.permissions),
    ];
    expect(grants.filter((grant) => grant === 'write-all')).toEqual([]);
  });

  it.each(workflows)('$file declares a top-level permissions block', ({ workflow }) => {
    expect(
      workflow.permissions,
      'OpenSSF Scorecard Token-Permissions: a workflow without a top-level permissions block runs every job on the repository default token scope, which can be write. Add `permissions: contents: read` (or `{}`) and grant extra scopes per job.',
    ).toBeDefined();
  });

  it.each(workflows)('$file top-level grant is no broader than contents: read', ({ workflow }) => {
    const grant = workflow.permissions;
    const broader =
      typeof grant === 'string' ||
      Object.entries(grant ?? {}).filter(
        ([scope, level]) => !(scope === 'contents' && level === 'read') && level !== 'none',
      ).length > 0;
    expect(
      broader,
      'OpenSSF Scorecard Token-Permissions: write or extra scopes at the top level reach every job in the workflow. Keep the top level at `contents: read` and move each additional scope to the single job that needs it.',
    ).toBe(false);
  });
});
