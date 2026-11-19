import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

interface Step {
  id?: string;
  name?: string;
  uses?: string;
  run?: string;
  with?: Record<string, string>;
  'timeout-minutes'?: number;
}

interface Job {
  'timeout-minutes'?: number;
  steps?: Step[];
}

// behavioral-test-allow: the artifact under test IS ci.yml; which steps a job runs before the browser install has no runtime surface in this repository.
const workflow = parse(
  readFileSync(join(process.cwd(), '.github', 'workflows', 'ci.yml'), 'utf8'),
) as { env?: Record<string, string>; jobs: Record<string, Job> };

const INSTALL_SCRIPT = 'install-playwright-browsers.ts';
const CACHE_ACTION = 'actions/cache@';
const APT_DIR_ENV = 'APT_CACHE_DIR';
const IMAGE_VERSION_OUTPUT = 'steps.runner-image.outputs.version';
const PLAYWRIGHT_VERSION_OUTPUT = 'steps.playwright-version.outputs.version';
const TEST_BUDGET_MINUTES = 10;

const isInstall = (step: Step): boolean => step.run?.includes(INSTALL_SCRIPT) === true;
const isAptCache = (step: Step): boolean =>
  step.uses?.startsWith(CACHE_ACTION) === true && step.with?.path?.includes(APT_DIR_ENV) === true;

function aptCacheViolations(job: Job): string[] {
  const steps = job.steps ?? [];
  const installAt = steps.findIndex(isInstall);
  const cacheAt = steps.findIndex(isAptCache);
  if (cacheAt < 0 || cacheAt > installAt) {
    return ['the apt package cache is not restored before the browser install'];
  }
  const before = steps.slice(0, cacheAt);
  const key = steps[cacheAt]?.with?.key ?? '';
  const install = steps[installAt];
  const violations: string[] = [];
  if (!before.some((s) => s.run?.includes(APT_DIR_ENV) === true)) {
    violations.push('the apt cache directory is not created before the restore');
  }
  if (!key.includes(IMAGE_VERSION_OUTPUT)) {
    violations.push('the apt cache key does not include the runner image version');
  }
  if (!key.includes(PLAYWRIGHT_VERSION_OUTPUT)) {
    violations.push('the apt cache key does not include the Playwright version');
  }
  if (
    !before.some((s) => s.id === 'runner-image') ||
    !before.some((s) => s.id === 'playwright-version')
  ) {
    violations.push('the version steps the key reads do not run before the restore');
  }
  const budget = (job['timeout-minutes'] ?? 0) - TEST_BUDGET_MINUTES;
  const stepTimeout = install?.['timeout-minutes'];
  if (stepTimeout === undefined || stepTimeout > budget) {
    violations.push('the install step has no timeout that leaves the tests their budget');
  }
  return violations;
}

const installingJobs = Object.entries(workflow.jobs).filter(([, job]) =>
  (job.steps ?? []).some(isInstall),
);

const clone = (job: Job): Job => structuredClone(job);
const e2e = workflow.jobs['e2e-functional'] as Job;

describe('ci.yml keeps a throttled apt mirror out of the Playwright install', () => {
  it('finds every job that installs browsers', () => {
    expect(installingJobs.map(([id]) => id).sort()).toEqual([
      'e2e-functional',
      'e2e-visual-chromium',
      'performance',
    ]);
  });

  it('names the apt cache directory once, as an absolute path, at workflow level', () => {
    expect(workflow.env?.[APT_DIR_ENV]).toMatch(/^\/[\w./-]+$/);
  });

  it.each(installingJobs)(
    '%s restores the apt packages and lists before the install, keyed on the runner image and Playwright versions, with a bounded install step',
    (_id, job) => {
      expect(aptCacheViolations(job)).toEqual([]);
    },
  );

  describe('negative controls', () => {
    it('flags a job with no apt cache restore', () => {
      const job = clone(e2e);
      job.steps = (job.steps ?? []).filter((s) => !isAptCache(s));
      expect(aptCacheViolations(job)).toHaveLength(1);
    });

    it('flags a restore that runs after the install', () => {
      const job = clone(e2e);
      const steps = job.steps ?? [];
      const cache = steps.find(isAptCache) as Step;
      job.steps = [...steps.filter((s) => !isAptCache(s)), cache];
      expect(aptCacheViolations(job)).toHaveLength(1);
    });

    it('flags a key without the runner image version', () => {
      const job = clone(e2e);
      const cache = (job.steps ?? []).find(isAptCache) as Step;
      cache.with = { ...cache.with, key: `apt-${PLAYWRIGHT_VERSION_OUTPUT}` };
      expect(aptCacheViolations(job)).toContain(
        'the apt cache key does not include the runner image version',
      );
    });

    it('flags a key without the Playwright version', () => {
      const job = clone(e2e);
      const cache = (job.steps ?? []).find(isAptCache) as Step;
      cache.with = { ...cache.with, key: `apt-${IMAGE_VERSION_OUTPUT}` };
      expect(aptCacheViolations(job)).toContain(
        'the apt cache key does not include the Playwright version',
      );
    });

    it('flags an install step with no timeout, and one that eats the test budget', () => {
      const unbounded = clone(e2e);
      const install = (unbounded.steps ?? []).find(isInstall) as Step;
      delete install['timeout-minutes'];
      expect(aptCacheViolations(unbounded)).toContain(
        'the install step has no timeout that leaves the tests their budget',
      );
      const greedy = clone(e2e);
      const greedyInstall = (greedy.steps ?? []).find(isInstall) as Step;
      greedyInstall['timeout-minutes'] = (greedy['timeout-minutes'] ?? 0) - TEST_BUDGET_MINUTES + 1;
      expect(aptCacheViolations(greedy)).toHaveLength(1);
    });

    it('flags a restore into a directory nothing created', () => {
      const job = clone(e2e);
      job.steps = (job.steps ?? []).filter((s) => !s.run?.includes(APT_DIR_ENV));
      expect(aptCacheViolations(job)).toContain(
        'the apt cache directory is not created before the restore',
      );
    });
  });
});
