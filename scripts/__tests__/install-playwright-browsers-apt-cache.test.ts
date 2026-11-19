import { describe, expect, it, vi } from 'vitest';
import {
  APT_CONFIG,
  APT_CONFIG_PATH,
  aptConfig,
  configureApt,
  releaseAptCache,
} from '../ci/install-playwright-browsers.ts';

const CACHE_DIR = '/var/cache/ci-apt';

describe('aptConfig', () => {
  it('keeps the base config when no cache directory is given', () => {
    expect(aptConfig()).toBe(APT_CONFIG);
  });

  it('points the package archives and the package lists at the cache directory', () => {
    const config = aptConfig(CACHE_DIR);
    expect(config).toContain(APT_CONFIG);
    expect(config).toContain(`Dir::Cache::Archives "${CACHE_DIR}/archives";`);
    expect(config).toContain(`Dir::State::Lists "${CACHE_DIR}/lists";`);
    expect(config).toContain('APT::Keep-Downloaded-Packages "true";');
  });

  it.each(['relative/dir', '/dir with space', '/dir";\nDPkg::Pre-Invoke "x', ''])(
    'refuses %j, which would break or inject into the apt config',
    (dir) => {
      expect(() => aptConfig(dir)).toThrow(/APT_CACHE_DIR/);
    },
  );
});

describe('configureApt with a cache directory', () => {
  it('writes the redirect to the apt config on a Linux CI runner', () => {
    const run = vi.fn().mockReturnValue({ status: 0 });
    expect(configureApt({ run, platform: 'linux', ci: 'true', cacheDir: CACHE_DIR })).toBe(true);
    expect(run).toHaveBeenCalledWith(
      'sudo',
      ['tee', APT_CONFIG_PATH],
      expect.objectContaining({ input: `${aptConfig(CACHE_DIR)}\n` }),
    );
  });

  it('writes no redirect when the workflow names no cache directory', () => {
    const run = vi.fn().mockReturnValue({ status: 0 });
    configureApt({ run, platform: 'linux', ci: 'true', cacheDir: undefined });
    expect(run.mock.calls[0]?.[2]).toMatchObject({ input: `${APT_CONFIG}\n` });
  });
});

describe('releaseAptCache', () => {
  it('hands the root-written cache directory back to the runner user so the cache action can read it', () => {
    const run = vi.fn().mockReturnValue({ status: 0 });
    expect(
      releaseAptCache({
        run,
        platform: 'linux',
        ci: 'true',
        cacheDir: CACHE_DIR,
        uid: 1001,
        gid: 118,
      }),
    ).toBe(true);
    expect(run).toHaveBeenCalledWith(
      'sudo',
      ['chown', '-R', '1001:118', CACHE_DIR],
      expect.anything(),
    );
  });

  it('does nothing off a Linux CI runner or without a cache directory', () => {
    const run = vi.fn();
    const base = { run, cacheDir: CACHE_DIR, uid: 1, gid: 1 };
    expect(releaseAptCache({ ...base, platform: 'darwin', ci: 'true' })).toBe(false);
    expect(releaseAptCache({ ...base, platform: 'linux', ci: '' })).toBe(false);
    expect(releaseAptCache({ ...base, platform: 'linux', ci: 'true', cacheDir: undefined })).toBe(
      false,
    );
    expect(run).not.toHaveBeenCalled();
  });
});
