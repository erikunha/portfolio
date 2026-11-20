import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { linuxImage, playwrightVersion } from '../../scripts/ci/ci-full-linux.ts';

interface Step {
  id?: string;
  uses?: string;
  run?: string;
  with?: Record<string, string>;
}

interface Job {
  container?: { image?: string; options?: string };
  steps?: Step[];
}

// behavioral-test-allow: the artifact under test IS ci.yml; the key a browser cache restores from has no runtime surface in this repository.
const workflow = parse(
  readFileSync(join(process.cwd(), '.github', 'workflows', 'ci.yml'), 'utf8'),
) as { jobs: Record<string, Job> };

// behavioral-test-allow: the lockfile is the Playwright pin the job image must match; it has no runtime surface in this repository.
const lockfile = readFileSync(join(process.cwd(), 'pnpm-lock.yaml'), 'utf8');

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
const e2e = workflow.jobs.performance as Job;
const cacheOf = (job: Job): Step => (job.steps ?? []).find(isBrowserCache) as Step;
const installOf = (job: Job): Step => (job.steps ?? []).find(isInstall) as Step;

describe('ci.yml keeps the browser cache small and per browser', () => {
  it('finds every job that installs browsers', () => {
    expect(installingJobs.map(([id]) => id).sort()).toEqual(['performance']);
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

const RUNS_PLAYWRIGHT = 'playwright test';
const SUDO = 'sudo ';
const APT_DIR_ENV = 'APT_CACHE_DIR';
const CONTAINER_JOBS = ['e2e-functional', 'e2e-visual-chromium'];

const runsPlaywright = (job: Job): boolean =>
  (job.steps ?? []).some((step) => step.run?.includes(RUNS_PLAYWRIGHT) === true);

function containerViolations(job: Job, expectedImage: string): string[] {
  const violations: string[] = [];
  if (job.container?.image !== expectedImage) {
    violations.push(`the job image is ${job.container?.image}, not ${expectedImage}`);
  }
  for (const step of job.steps ?? []) {
    const text = `${step.run ?? ''} ${step.with?.path ?? ''}`;
    if (isInstall(step)) violations.push('the job installs browsers the image already holds');
    if (isBrowserCache(step) || text.includes(APT_DIR_ENV)) {
      violations.push('the job caches browsers or apt packages the image already holds');
    }
    if (text.includes(SUDO)) violations.push('a step calls sudo, which the image has no use for');
  }
  return violations;
}

describe('ci.yml runs the browser jobs in the Playwright image', () => {
  const expectedImage = linuxImage(playwrightVersion(lockfile));
  const containerJobs = Object.entries(workflow.jobs).filter(
    ([, job]) => job.container !== undefined,
  );

  it('puts the e2e and visual jobs in the image and no other job', () => {
    expect(containerJobs.map(([id]) => id).sort()).toEqual(CONTAINER_JOBS);
  });

  it.each(containerJobs)(
    '%s runs in the image of the pinned @playwright/test and carries no browser install',
    (_id, job) => {
      expect(containerViolations(job, expectedImage)).toEqual([]);
    },
  );

  it('leaves no job that runs Playwright with neither an image nor an install', () => {
    const bare = Object.entries(workflow.jobs)
      .filter(([, job]) => runsPlaywright(job))
      .filter(([, job]) => job.container === undefined && !(job.steps ?? []).some(isInstall))
      .map(([id]) => id);
    expect(bare).toEqual([]);
  });

  describe('negative controls', () => {
    const good = (): Job => ({
      container: { image: expectedImage },
      steps: [{ run: 'pnpm playwright test' }],
    });

    it('accepts the image of the pinned version', () => {
      expect(containerViolations(good(), expectedImage)).toEqual([]);
    });

    it('flags an image tag of another Playwright version', () => {
      const job = good();
      job.container = { image: linuxImage('0.0.1') };
      expect(containerViolations(job, expectedImage)).toHaveLength(1);
    });

    it('flags a job with no container', () => {
      const job = good();
      delete job.container;
      expect(containerViolations(job, expectedImage)).toHaveLength(1);
    });

    it('flags a browser install, a browser cache and an apt cache left in the job', () => {
      const job = good();
      job.steps = [
        { run: `node scripts/ci/${INSTALL_SCRIPT} chromium` },
        { uses: `${CACHE_ACTION}x`, with: { path: `~/.cache/${BROWSER_DIR}` } },
        { uses: `${CACHE_ACTION}x`, with: { path: `\${{ env.${APT_DIR_ENV} }}` } },
      ];
      expect(containerViolations(job, expectedImage)).toHaveLength(3);
    });

    it('flags a sudo step', () => {
      const job = good();
      job.steps = [{ run: `${SUDO}install -d /x` }];
      expect(containerViolations(job, expectedImage)).toHaveLength(1);
    });
  });
});
