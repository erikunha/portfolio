import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

// behavioral-test-allow: the artifact under test IS the workflow file; the install resilience is a property of its step graph and has no runtime surface in this repository.
const CI = parse(readFileSync(join(process.cwd(), '.github', 'workflows', 'ci.yml'), 'utf8')) as {
  jobs: Record<
    string,
    {
      steps: {
        id?: string;
        uses?: string;
        if?: string;
        run?: string;
        with?: Record<string, string>;
      }[];
    }
  >;
};

const steps = CI.jobs.gitleaks?.steps ?? [];
const cache = steps.find((s) => s.uses?.startsWith('actions/cache@'));
const download = steps.find((s) => s.run?.includes('curl'));
const verify = steps.find((s) => s.run?.includes('sha256sum'));

describe('gitleaks install survives a release-host outage', () => {
  it('caches the release files under a key that changes with the version and platform', () => {
    expect(cache, 'no actions/cache step in the gitleaks job').toBeDefined();
    expect(cache?.with?.key).toContain('GITLEAKS_VERSION');
    expect(cache?.with?.key).toContain('linux_x64');
  });

  it('downloads only on a cache miss, with a backoff that covers minutes', () => {
    expect(cache?.id).toBeTruthy();
    expect(download?.if).toContain(`steps.${cache?.id}.outputs.cache-hit != 'true'`);
    expect(download?.run).toContain('--retry-all-errors');
    expect(download?.run).toContain('--retry-max-time');
    expect(download?.run).not.toContain('--retry-delay');
  });

  it('verifies the checksum on every run, cached or fresh', () => {
    expect(verify, 'no sha256sum step').toBeDefined();
    expect(verify).not.toBe(download);
    expect(verify?.if ?? '').not.toContain('cache-hit');
    expect(verify?.run).toContain('set -euo pipefail');
  });
});
