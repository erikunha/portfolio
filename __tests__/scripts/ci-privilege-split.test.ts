import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

// behavioral-test-allow: the artifact under test IS the workflow file; which job holds which token scope has no runtime surface in this repository.
const CI = parse(readFileSync(join(process.cwd(), '.github', 'workflows', 'ci.yml'), 'utf8')) as {
  jobs: Record<
    string,
    {
      if?: string;
      needs?: string[];
      permissions?: Record<string, string>;
      steps?: { uses?: string; run?: string; 'continue-on-error'?: boolean; name?: string }[];
    }
  >;
};

const PRIVILEGED_SCOPES = ['id-token', 'attestations', 'pull-requests'];
const WRITE = 'write';
const DEPENDABOT_ACTOR = 'dependabot[bot]';

function holdsPrivilegedWrite(permissions: Record<string, string> | undefined): boolean {
  return PRIVILEGED_SCOPES.some((scope) => permissions?.[scope] === WRITE);
}

describe('ci.yml keeps privileged token scopes away from jobs that run pull request code', () => {
  it('gives no job that runs a repository command an OIDC, attestation or pull-request write scope', () => {
    const offenders = Object.entries(CI.jobs)
      .filter(([, job]) => holdsPrivilegedWrite(job.permissions))
      .filter(([, job]) => (job.steps ?? []).some((step) => step.run !== undefined))
      .map(([id]) => id);
    expect(offenders).toEqual([]);
  });

  it('attests the build in its own job that runs on main only and consumes the uploaded artifact', () => {
    const attest = CI.jobs['attest-build'];
    expect(attest?.needs).toContain('build');
    expect(attest?.if).toContain('refs/heads/main');
    expect(attest?.permissions).toMatchObject({ 'id-token': WRITE, attestations: WRITE });
    const uses = (attest?.steps ?? []).map((s) => s.uses ?? '');
    expect(uses.some((u) => u.startsWith('actions/download-artifact'))).toBe(true);
    expect(uses.some((u) => u.startsWith('actions/attest-build-provenance'))).toBe(true);
    expect(CI.jobs.build?.permissions).not.toHaveProperty('id-token');
    expect(CI.jobs.build?.permissions).not.toHaveProperty('attestations');
    expect(
      (CI.jobs.build?.steps ?? []).some((s) =>
        s.uses?.startsWith('actions/attest-build-provenance'),
      ),
    ).toBe(false);
  });

  it('posts the coverage comment from a job that runs no repository code', () => {
    const comment = CI.jobs['coverage-comment'];
    expect(comment?.needs).toContain('test');
    expect(comment?.permissions).toMatchObject({ 'pull-requests': WRITE });
    expect(comment?.if).toContain('pull_request');
    const uses = (comment?.steps ?? []).map((s) => s.uses ?? '');
    expect(uses.some((u) => u.startsWith('actions/download-artifact'))).toBe(true);
    expect(uses.some((u) => u.startsWith('actions/github-script'))).toBe(true);
    expect(CI.jobs.test?.permissions?.['pull-requests']).not.toBe(WRITE);
    expect(
      (CI.jobs.test?.steps ?? []).some((s) => s.uses?.startsWith('actions/github-script')),
    ).toBe(false);
  });
});

describe('ci.yml ai-eval job', () => {
  it('skips Dependabot runs, whose actor cannot read the gateway secret', () => {
    expect(CI.jobs['ai-eval']?.if).toContain(`github.actor != '${DEPENDABOT_ACTOR}'`);
  });
});

describe('ci.yml semgrep job', () => {
  it('is waited on by ci-gate, so the self-test that proves the rules fire can block a merge', () => {
    expect(CI.jobs['ci-gate']?.needs).toContain('semgrep');
  });

  it('blocks on the fixture self-test and keeps only the findings scan report-only', () => {
    const steps = CI.jobs.semgrep?.steps ?? [];
    const selfTest = steps.find((s) => s.run?.includes('check-semgrep-fixture'));
    const scan = steps.find((s) => s.run?.includes('run-semgrep'));
    expect(selfTest?.['continue-on-error']).toBeUndefined();
    expect(scan?.['continue-on-error']).toBe(true);
  });
});
