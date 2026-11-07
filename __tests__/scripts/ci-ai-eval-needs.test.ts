import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

// behavioral-test-allow: the artifact under test IS the workflow file; a job's needs graph has no runtime surface in this repository.
const CI = parse(readFileSync(join(process.cwd(), '.github', 'workflows', 'ci.yml'), 'utf8')) as {
  jobs: Record<string, { needs?: string[]; steps?: { uses?: string; run?: string }[] }>;
};

describe('ai-eval job dependencies', () => {
  it('waits only for change detection and the fast jobs it gates on, not for build or browser jobs', () => {
    expect([...(CI.jobs['ai-eval']?.needs ?? [])].sort()).toEqual([
      'detect-changes',
      'quality-fast',
      'test',
      'typecheck',
    ]);
  });

  it('consumes no artifact produced by a job it does not wait for', () => {
    const downloads = (CI.jobs['ai-eval']?.steps ?? []).filter((s) =>
      s.uses?.startsWith('actions/download-artifact'),
    );
    expect(downloads).toEqual([]);
  });
});
