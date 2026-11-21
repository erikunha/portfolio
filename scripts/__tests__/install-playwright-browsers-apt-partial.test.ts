import { describe, expect, it, vi } from 'vitest';
import { APT_CONFIG_PATH, configureApt } from '../ci/install-playwright-browsers.ts';

const CACHE_DIR = '/var/cache/ci-apt';
const PARTIAL_DIRS = [`${CACHE_DIR}/archives/partial`, `${CACHE_DIR}/lists/partial`];

describe('configureApt creates the partial directories apt requires in a redirected cache', () => {
  it('creates both partial directories before it writes the apt config', () => {
    const run = vi.fn().mockReturnValue({ status: 0 });
    expect(configureApt({ run, platform: 'linux', ci: 'true', cacheDir: CACHE_DIR })).toBe(true);
    const calls = run.mock.calls.map(([command, args]) => [command, ...(args as string[])]);
    const mkdirAt = calls.findIndex(
      (call) => call.includes('-d') && PARTIAL_DIRS.every((dir) => call.includes(dir)),
    );
    const configAt = calls.findIndex((call) => call.includes(APT_CONFIG_PATH));
    expect(mkdirAt).toBeGreaterThanOrEqual(0);
    expect(mkdirAt).toBeLessThan(configAt);
  });

  it('reports failure when the partial directories cannot be created', () => {
    const run = vi.fn().mockReturnValue({ status: 1 });
    expect(configureApt({ run, platform: 'linux', ci: 'true', cacheDir: CACHE_DIR })).toBe(false);
  });

  it('creates no directory when no cache directory is passed', () => {
    const run = vi.fn().mockReturnValue({ status: 0 });
    configureApt({ run, platform: 'linux', ci: 'true' });
    expect(run).toHaveBeenCalledTimes(1);
  });
});
