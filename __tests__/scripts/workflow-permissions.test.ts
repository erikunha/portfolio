import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

// behavioral-test-allow: the artifacts under test ARE the workflow files; the token a job runs with
// is a property of its YAML and has no runtime surface in this repository.
const WORKFLOW_DIR = join(process.cwd(), '.github', 'workflows');
const TOP_LEVEL_READ_ONLY = { contents: 'read' };

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

  it('ci.yml defaults every job to read-only contents', () => {
    const ci = workflows.find(({ file }) => file === 'ci.yml');
    expect(ci?.workflow.permissions).toEqual(TOP_LEVEL_READ_ONLY);
  });
});
