import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

// behavioral-test-allow: the artifact under test IS the workflow file; a job's needs graph has no runtime surface in this repository.
const CI = parse(readFileSync(join(process.cwd(), '.github', 'workflows', 'ci.yml'), 'utf8')) as {
  jobs: Record<
    string,
    { if?: string; needs?: string[]; steps?: { uses?: string; run?: string }[] }
  >;
};

const LABEL = 'ai-eval';

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

describe('the ai-eval job is opt-in', () => {
  it('fires only for a pull request that carries the ai-eval label', () => {
    expect(CI.jobs['ai-eval']?.if).toContain(
      `contains(github.event.pull_request.labels.*.name, '${LABEL}')`,
    );
  });

  it('keeps the AI path filter, so the label alone does not spend credits on a PR that changed nothing AI-relevant', () => {
    expect(CI.jobs['ai-eval']?.if).toContain("needs.detect-changes.outputs.ai == 'true'");
  });

  it('reads the labels from the pull_request event payload, not from an API call that would need a scope', () => {
    const steps = (CI.jobs['ai-eval']?.steps ?? []).map((s) => s.run ?? '');
    expect(steps.some((run) => run.includes('labels'))).toBe(false);
  });

  it('does not block the gate when it is skipped, because a path skip is a passing result there', () => {
    const gate = (CI.jobs['ci-gate']?.steps ?? []).map((s) => s.run ?? '').join('\n');
    expect(gate).toContain('"skipped"');
  });
});
