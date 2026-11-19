import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { parse } from 'yaml';
import { installBrowsers } from '../../scripts/ci/install-playwright-browsers.ts';

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

// behavioral-test-allow: the artifact under test IS ci.yml; which keys the apt cache restores from has no runtime surface in this repository.
const workflow = parse(
  readFileSync(join(process.cwd(), '.github', 'workflows', 'ci.yml'), 'utf8'),
) as { jobs: Record<string, Job> };

const INSTALL_SCRIPT = 'install-playwright-browsers.ts';
const CACHE_ACTION = 'actions/cache@';
const APT_DIR_ENV = 'APT_CACHE_DIR';
const IMAGE_VERSION_OUTPUT = 'steps.runner-image.outputs.version';
const expression = (inner: string): string => `\${{ ${inner} }}`;
const IMAGE_VERSION_EXPRESSION = expression(IMAGE_VERSION_OUTPUT);
const PLAYWRIGHT_VERSION_OUTPUT = 'steps.playwright-version.outputs.version';
const OS_PREFIX = `apt-${expression('runner.os')}-`;
const TEST_BUDGET_MINUTES = 10;
const CACHE_DIR = '/var/cache/ci-apt';
const RUNNER_ID = 1001;

const isInstall = (step: Step): boolean => step.run?.includes(INSTALL_SCRIPT) === true;
const isAptCache = (step: Step): boolean =>
  step.uses?.startsWith(CACHE_ACTION) === true && step.with?.path?.includes(APT_DIR_ENV) === true;

const restoreKeysOf = (step: Step): string[] =>
  (step.with?.['restore-keys'] ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

function restoreViolations(job: Job): string[] {
  const cache = (job.steps ?? []).find(isAptCache);
  if (cache === undefined) return ['no apt cache step'];
  const key = cache.with?.key ?? '';
  const restoreKeys = restoreKeysOf(cache);
  const violations: string[] = [];
  if (restoreKeys.length === 0) violations.push('the apt cache has no restore key');
  if (!key.endsWith(IMAGE_VERSION_EXPRESSION)) {
    violations.push('the runner image version is not the last segment of the apt cache key');
  }
  for (const restoreKey of restoreKeys) {
    if (restoreKey.includes(IMAGE_VERSION_OUTPUT)) {
      violations.push(`the restore key ${restoreKey} carries the runner image version`);
    }
    if (!key.startsWith(restoreKey)) {
      violations.push(`the restore key ${restoreKey} is not a prefix of the key`);
    }
    if (restoreKey === OS_PREFIX) {
      violations.push('the restore key drops the browser, so it would mix package sets');
    }
  }
  if (!restoreKeys.some((restoreKey) => restoreKey.includes(PLAYWRIGHT_VERSION_OUTPUT))) {
    violations.push('no restore key keeps the Playwright version');
  }
  return violations;
}

function stepTimeoutViolations(job: Job): string[] {
  const install = (job.steps ?? []).find(isInstall);
  const budget = (job['timeout-minutes'] ?? 0) - TEST_BUDGET_MINUTES;
  const stepTimeout = install?.['timeout-minutes'];
  return stepTimeout === undefined || stepTimeout > budget
    ? ['the install step has no timeout that leaves the tests their budget']
    : [];
}

const installingJobs = Object.entries(workflow.jobs).filter(([, job]) =>
  (job.steps ?? []).some(isInstall),
);

const clone = (job: Job): Job => structuredClone(job);
const e2e = workflow.jobs['e2e-functional'] as Job;

describe('ci.yml restores the apt cache across runner images', () => {
  it('finds every job that installs browsers', () => {
    expect(installingJobs.map(([id]) => id).sort()).toEqual([
      'e2e-functional',
      'e2e-visual-chromium',
      'performance',
    ]);
  });

  it.each(installingJobs)(
    '%s keeps the runner image last in the key and restores from a key without it',
    (_id, job) => {
      expect(restoreViolations(job)).toEqual([]);
    },
  );

  it.each(installingJobs)(
    '%s restores the newest entry of the same Playwright version first, then of the same browser',
    (_id, job) => {
      const cache = (job.steps ?? []).find(isAptCache) as Step;
      const [first, second, ...rest] = restoreKeysOf(cache);
      expect(rest).toEqual([]);
      expect(first).toContain(PLAYWRIGHT_VERSION_OUTPUT);
      expect(second).toBeDefined();
      expect(second).not.toContain(PLAYWRIGHT_VERSION_OUTPUT);
      expect((second ?? '').length).toBeGreaterThan(OS_PREFIX.length);
    },
  );

  it.each(installingJobs)(
    '%s prunes stale packages after the install and before the cache is handed back',
    (_id, job) => {
      const install = (job.steps ?? []).find(isInstall) as Step;
      expect(install.run).toMatch(/node scripts\/ci\/install-playwright-browsers\.ts \S+/);
      const run = vi.fn().mockReturnValue({ status: 0 });
      installBrowsers(['chromium'], {
        run,
        platform: 'linux',
        ci: 'true',
        cacheDir: CACHE_DIR,
        uid: RUNNER_ID,
        gid: RUNNER_ID,
      });
      const commands = run.mock.calls.map((call) => (call[1] as string[]).join(' '));
      const installAt = commands.findIndex((command) => command.includes('playwright install'));
      const pruneAt = commands.findIndex((command) => command.includes('autoclean'));
      const chownAt = commands.findIndex((command) => command.startsWith('chown'));
      expect(installAt).toBeGreaterThanOrEqual(0);
      expect(pruneAt).toBeGreaterThan(installAt);
      expect(chownAt).toBeGreaterThan(pruneAt);
    },
  );

  it.each(installingJobs)(
    '%s bounds the install step and the prune with it, and leaves the tests their budget',
    (_id, job) => {
      expect(stepTimeoutViolations(job)).toEqual([]);
    },
  );

  it.each(installingJobs)('%s runs no step that empties the apt cache', (_id, job) => {
    const emptiers = (job.steps ?? []).filter((step) =>
      /apt-get (clean|autoremove --purge)|rm .*ci-apt/.test(step.run ?? ''),
    );
    expect(emptiers).toEqual([]);
  });

  describe('negative controls', () => {
    it('flags a job with no restore key', () => {
      const job = clone(e2e);
      const cache = (job.steps ?? []).find(isAptCache) as Step;
      cache.with = { ...cache.with, 'restore-keys': '' };
      expect(restoreViolations(job)).toContain('the apt cache has no restore key');
    });

    it('flags a restore key that still carries the runner image version', () => {
      const job = clone(e2e);
      const cache = (job.steps ?? []).find(isAptCache) as Step;
      cache.with = { ...cache.with, 'restore-keys': cache.with?.key ?? '' };
      expect(restoreViolations(job).join('\n')).toContain('carries the runner image version');
    });

    it('flags a restore key that drops the browser', () => {
      const job = clone(e2e);
      const cache = (job.steps ?? []).find(isAptCache) as Step;
      cache.with = { ...cache.with, 'restore-keys': OS_PREFIX };
      expect(restoreViolations(job)).toContain(
        'the restore key drops the browser, so it would mix package sets',
      );
    });

    it('flags a key whose last segment is not the runner image version', () => {
      const job = clone(e2e);
      const cache = (job.steps ?? []).find(isAptCache) as Step;
      cache.with = { ...cache.with, key: `${OS_PREFIX}${expression(PLAYWRIGHT_VERSION_OUTPUT)}` };
      expect(restoreViolations(job)).toContain(
        'the runner image version is not the last segment of the apt cache key',
      );
    });

    it('flags an install step with no timeout, and one that eats the test budget', () => {
      const unbounded = clone(e2e);
      delete (unbounded.steps ?? []).find(isInstall)?.['timeout-minutes'];
      expect(stepTimeoutViolations(unbounded)).toHaveLength(1);
      const greedy = clone(e2e);
      const install = (greedy.steps ?? []).find(isInstall) as Step;
      install['timeout-minutes'] = (greedy['timeout-minutes'] ?? 0) - TEST_BUDGET_MINUTES + 1;
      expect(stepTimeoutViolations(greedy)).toHaveLength(1);
    });
  });
});
