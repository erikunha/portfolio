import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

// behavioral-test-allow: the artifact under test IS the workflow file; the install resilience is a property of its step graph and has no runtime surface in this repository.
const CI = parse(readFileSync(join(process.cwd(), '.github', 'workflows', 'ci.yml'), 'utf8')) as {
  jobs: Record<
    string,
    {
      'timeout-minutes'?: number;
      env?: Record<string, string>;
      steps: {
        id?: string;
        uses?: string;
        if?: string;
        run?: string;
        'continue-on-error'?: boolean | string;
        with?: Record<string, string>;
      }[];
    }
  >;
};

const job = CI.jobs.gitleaks;
const steps = job?.steps ?? [];
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

  it('cannot pass a failed verification', () => {
    expect(verify?.['continue-on-error']).toBeUndefined();
    expect(verify?.run).not.toContain('|| true');
  });

  it('compares the tarball against a sha256 pinned in the job env, never a cached checksums file', () => {
    expect(job?.env?.GITLEAKS_SHA256).toMatch(/^[0-9a-f]{64}$/);
    expect(verify?.run).toContain('GITLEAKS_SHA256');
    for (const step of steps) {
      expect(step.run ?? '').not.toContain('checksums.txt');
    }
  });

  it('uses one release directory for the cache path, the download and the verify', () => {
    expect(cache?.with?.path).toMatch(/^\$\{\{ runner\.temp \}\}\/gitleaks-release$/);
    for (const step of [download, verify]) {
      expect(step?.run).toMatch(/dir="\$\{RUNNER_TEMP:-\$\{TMPDIR:-\/tmp\}\}\/gitleaks-release"/);
    }
  });

  it('orders the steps cache, download, verify', () => {
    const at = (step: unknown) => steps.indexOf(step as (typeof steps)[number]);
    expect(at(cache)).toBeGreaterThanOrEqual(0);
    expect(at(cache)).toBeLessThan(at(download));
    expect(at(download)).toBeLessThan(at(verify));
  });

  it('keeps the worst-case download inside the job timeout', () => {
    const retryMax = Number(/--retry-max-time (\d+)/.exec(download?.run ?? '')?.[1]);
    const attempt = Number(/--max-time (\d+)/.exec(download?.run ?? '')?.[1]);
    const budget = (job?.['timeout-minutes'] ?? 0) * 60;
    const downloads = (download?.run ?? '')
      .split('\n')
      .filter((line) => line.includes('curl ')).length;
    expect(downloads).toBeGreaterThan(0);
    expect(downloads * (retryMax + attempt)).toBeLessThan(budget);
  });
});
