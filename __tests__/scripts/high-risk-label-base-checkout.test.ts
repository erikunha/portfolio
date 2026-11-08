import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

// behavioral-test-allow: the artifact under test IS the workflow file; which ref a job checks out has no runtime surface in this repository.
const workflow = parse(
  readFileSync(join(process.cwd(), '.github', 'workflows', 'high-risk-label.yml'), 'utf8'),
) as {
  jobs: Record<
    string,
    {
      steps: {
        id?: string;
        uses?: string;
        env?: Record<string, string>;
        with?: Record<string, unknown>;
      }[];
    }
  >;
};

const steps = Object.values(workflow.jobs)[0]?.steps ?? [];
const EXPRESSION_OPEN = ['$', '{{'].join('');

describe('high-risk-label workflow runs trusted code with its token', () => {
  it('checks out the base commit, so a pull request cannot rewrite the script that holds the token', () => {
    const checkout = steps.find((s) => s.uses?.startsWith('actions/checkout'));
    expect(checkout?.with?.ref).toBe(`${EXPRESSION_OPEN} github.event.pull_request.base.sha }}`);
  });

  it('never checks out the pull request head or merge ref', () => {
    const refs = steps
      .filter((s) => s.uses?.startsWith('actions/checkout'))
      .map((s) => String(s.with?.ref ?? ''));
    expect(refs.filter((ref) => /head|merge|refs\/pull/.test(ref))).toEqual([]);
  });
});
