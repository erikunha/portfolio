import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

interface Step {
  id?: string;
  uses?: string;
  run?: string;
  with?: Record<string, string>;
}

interface Job {
  steps?: Step[];
}

// behavioral-test-allow: the artifact under test IS ci.yml; the key a browser cache restores from has no runtime surface in this repository.
const workflow = parse(
  readFileSync(join(process.cwd(), '.github', 'workflows', 'ci.yml'), 'utf8'),
) as { jobs: Record<string, Job> };

const INSTALL_SCRIPT = 'install-playwright-browsers.ts';
const INSTALL_ARGUMENT = /install-playwright-browsers\.ts\s+(.+?)\s*$/;
const CACHE_ACTION = 'actions/cache@';
const BROWSER_DIR = 'ms-playwright';
const PLAYWRIGHT_VERSION_STEP = 'playwright-version';
const PLAYWRIGHT_VERSION_OUTPUT = `steps.${PLAYWRIGHT_VERSION_STEP}.outputs.version`;
const IMAGE_VERSION_OUTPUT = 'steps.runner-image.outputs.version';
const LOCKFILE_HASH = 'hashFiles(';
const KEY_PREFIX = 'playwright-';

const isInstall = (step: Step): boolean => step.run?.includes(INSTALL_SCRIPT) === true;
const isBrowserCache = (step: Step): boolean =>
  step.uses?.startsWith(CACHE_ACTION) === true && step.with?.path?.includes(BROWSER_DIR) === true;

function browserCacheViolations(job: Job): string[] {
  const steps = job.steps ?? [];
  const cacheAt = steps.findIndex(isBrowserCache);
  if (cacheAt < 0) return ['the job has no browser cache step'];
  const cache = steps[cacheAt] as Step;
  const key = cache.with?.key ?? '';
  const violations: string[] = [];
  if (!steps.slice(0, cacheAt).some((step) => step.id === PLAYWRIGHT_VERSION_STEP)) {
    violations.push('the Playwright version is not known before the browser cache is restored');
  }
  if (!key.includes(PLAYWRIGHT_VERSION_OUTPUT)) {
    violations.push('the browser cache key does not include the Playwright version');
  }
  if (key.includes(LOCKFILE_HASH)) {
    violations.push(
      'the browser cache key carries the lockfile hash, so any dependency bump saves a new entry',
    );
  }
  if (key.includes(IMAGE_VERSION_OUTPUT)) {
    violations.push(
      'the browser cache key carries the runner image version, so each image saves its own copy',
    );
  }
  if (cache.with?.['restore-keys'] !== undefined) {
    violations.push(
      'the browser cache has a restore key, so a stale revision rides along into the new entry',
    );
  }
  const install = steps.find(isInstall);
  const argument = install?.run?.match(INSTALL_ARGUMENT)?.[1] ?? '';
  if (argument.length === 0 || /\s/.test(argument.replace(/\$\{\{.*?\}\}/g, ''))) {
    violations.push('the install step does not name exactly one browser');
  } else if (!key.includes(argument)) {
    violations.push('the browser cache key does not name the browser the install step installs');
  }
  return violations;
}

const installingJobs = Object.entries(workflow.jobs).filter(([, job]) =>
  (job.steps ?? []).some(isInstall),
);

const clone = (job: Job): Job => structuredClone(job);
const e2e = workflow.jobs['e2e-functional'] as Job;
const cacheOf = (job: Job): Step => (job.steps ?? []).find(isBrowserCache) as Step;
const installOf = (job: Job): Step => (job.steps ?? []).find(isInstall) as Step;

describe('ci.yml keeps the browser cache small and per browser', () => {
  it('finds every job that installs browsers', () => {
    expect(installingJobs.map(([id]) => id).sort()).toEqual([
      'e2e-functional',
      'e2e-visual-chromium',
      'performance',
    ]);
  });

  it.each(installingJobs)(
    '%s keys its browser cache on the Playwright version and the one browser it installs',
    (_id, job) => {
      expect(browserCacheViolations(job)).toEqual([]);
    },
  );

  describe('negative controls', () => {
    it('flags a key that carries the lockfile hash', () => {
      const job = clone(e2e);
      const cache = cacheOf(job);
      cache.with = {
        ...cache.with,
        key: `${cache.with?.key}-\${{ ${LOCKFILE_HASH}'pnpm-lock.yaml') }}`,
      };
      expect(browserCacheViolations(job)).toHaveLength(1);
      expect(browserCacheViolations(job)[0]).toContain('lockfile hash');
    });

    it('flags a key that carries the runner image version', () => {
      const job = clone(e2e);
      const cache = cacheOf(job);
      cache.with = { ...cache.with, key: `${cache.with?.key}-\${{ ${IMAGE_VERSION_OUTPUT} }}` };
      expect(browserCacheViolations(job)).toHaveLength(1);
      expect(browserCacheViolations(job)[0]).toContain('runner image version');
    });

    it('flags a key without the Playwright version', () => {
      const job = clone(e2e);
      const cache = cacheOf(job);
      cache.with = { ...cache.with, key: KEY_PREFIX };
      expect(browserCacheViolations(job)).toContain(
        'the browser cache key does not include the Playwright version',
      );
    });

    it('flags a restore key', () => {
      const job = clone(e2e);
      const cache = cacheOf(job);
      cache.with = { ...cache.with, 'restore-keys': KEY_PREFIX };
      expect(browserCacheViolations(job)).toHaveLength(1);
      expect(browserCacheViolations(job)[0]).toContain('restore key');
    });

    it('flags a version step that runs after the cache', () => {
      const job = clone(e2e);
      const steps = job.steps ?? [];
      const version = steps.find((step) => step.id === PLAYWRIGHT_VERSION_STEP) as Step;
      job.steps = [...steps.filter((step) => step !== version), version];
      expect(browserCacheViolations(job)).toContain(
        'the Playwright version is not known before the browser cache is restored',
      );
    });

    it('flags an install step that lists two browsers', () => {
      const job = clone(e2e);
      installOf(job).run = `node scripts/ci/${INSTALL_SCRIPT} chromium webkit`;
      expect(browserCacheViolations(job)).toContain(
        'the install step does not name exactly one browser',
      );
    });

    it('flags a cache key for a different browser than the install step installs', () => {
      const job = clone(e2e);
      installOf(job).run = `node scripts/ci/${INSTALL_SCRIPT} firefox`;
      expect(browserCacheViolations(job)).toContain(
        'the browser cache key does not name the browser the install step installs',
      );
    });
  });
});
