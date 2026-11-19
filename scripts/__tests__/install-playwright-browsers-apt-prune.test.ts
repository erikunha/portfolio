import { describe, expect, it, vi } from 'vitest';
import {
  APT_AUTOCLEAN_ARGS,
  installBrowsers,
  pruneAptCache,
} from '../ci/install-playwright-browsers.ts';

const CACHE_DIR = '/var/cache/ci-apt';
const RUNNER_UID = 1001;
const RUNNER_GID = 118;
const FAILED_STATUS = 100;
const LINUX_CI = { platform: 'linux', ci: 'true', cacheDir: CACHE_DIR } as const;
const OWNERS = { uid: RUNNER_UID, gid: RUNNER_GID } as const;

const label = (call: unknown[]): string => `${call[0]} ${(call[1] as string[]).join(' ')}`;

describe('pruneAptCache', () => {
  it('runs apt-get autoclean as root, against the redirected cache the apt config names', () => {
    const run = vi.fn().mockReturnValue({ status: 0 });
    expect(pruneAptCache({ run, ...LINUX_CI })).toBe(true);
    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith('sudo', APT_AUTOCLEAN_ARGS, expect.anything());
    expect(APT_AUTOCLEAN_ARGS).toEqual(['apt-get', 'autoclean']);
  });

  it('reports a failed autoclean without throwing', () => {
    const run = vi.fn().mockReturnValue({ status: FAILED_STATUS });
    expect(pruneAptCache({ run, ...LINUX_CI })).toBe(false);
  });

  it('does nothing off a Linux CI runner or without a cache directory', () => {
    const run = vi.fn();
    expect(pruneAptCache({ run, ...LINUX_CI, platform: 'darwin' })).toBe(false);
    expect(pruneAptCache({ run, ...LINUX_CI, ci: '' })).toBe(false);
    expect(pruneAptCache({ run, ...LINUX_CI, cacheDir: undefined })).toBe(false);
    expect(run).not.toHaveBeenCalled();
  });
});

describe('installBrowsers', () => {
  it('prunes the cache after the install and before the chown that lets the cache action read it', () => {
    const run = vi.fn().mockReturnValue({ status: 0 });
    expect(installBrowsers(['webkit'], { run, ...LINUX_CI, ...OWNERS })).toBe(0);
    expect(run.mock.calls.map(label)).toEqual([
      `sudo install -d ${CACHE_DIR}/archives/partial ${CACHE_DIR}/lists/partial`,
      'sudo tee /etc/apt/apt.conf.d/99ci-mirror-resilience',
      'pnpm playwright install --with-deps webkit',
      'sudo apt-get autoclean',
      `sudo chown -R ${RUNNER_UID}:${RUNNER_GID} ${CACHE_DIR}`,
    ]);
  });

  it('skips the prune when the install failed, still hands the cache back and returns the failure', () => {
    const run = vi.fn().mockReturnValue({ status: FAILED_STATUS });
    const log = vi.fn();
    expect(installBrowsers(['webkit'], { run, log, ...LINUX_CI, ...OWNERS })).toBe(1);
    const labels = run.mock.calls.map(label);
    expect(labels.some((entry) => entry.includes('autoclean'))).toBe(false);
    expect(labels.at(-1)).toContain('chown');
  });

  it('keeps the chown when the prune fails', () => {
    const run = vi.fn().mockImplementation((_command: string, args: string[]) => ({
      status: args.includes('autoclean') ? FAILED_STATUS : 0,
    }));
    expect(installBrowsers(['chromium'], { run, ...LINUX_CI, ...OWNERS })).toBe(0);
    expect(run.mock.calls.map(label).at(-1)).toContain('chown');
  });

  it('runs no apt command off a Linux CI runner', () => {
    const run = vi.fn().mockReturnValue({ status: 0 });
    installBrowsers(['chromium'], { run, platform: 'darwin', ci: 'true', cacheDir: CACHE_DIR });
    expect(run.mock.calls.map(label)).toEqual(['pnpm playwright install --with-deps chromium']);
  });
});
