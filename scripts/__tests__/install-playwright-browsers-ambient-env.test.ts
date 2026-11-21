import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  APT_CACHE_DIR_ENV,
  APT_CONFIG,
  configureApt,
  releaseAptCache,
} from '../ci/install-playwright-browsers.ts';

const WORKFLOW_CACHE_DIR = '/var/cache/ci-apt';

describe('apt helpers ignore the workflow cache directory in the environment', () => {
  beforeEach(() => {
    vi.stubEnv(APT_CACHE_DIR_ENV, WORKFLOW_CACHE_DIR);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('writes only the resilience config when no cache directory is passed', () => {
    const run = vi.fn().mockReturnValue({ status: 0 });
    expect(configureApt({ run, platform: 'linux', ci: 'true' })).toBe(true);
    expect(run).toHaveBeenCalledWith(
      'sudo',
      expect.any(Array),
      expect.objectContaining({ input: `${APT_CONFIG}\n` }),
    );
  });

  it('releases nothing when no cache directory is passed', () => {
    const run = vi.fn().mockReturnValue({ status: 0 });
    expect(releaseAptCache({ run, platform: 'linux', ci: 'true', uid: 1, gid: 1 })).toBe(false);
    expect(run).not.toHaveBeenCalled();
  });
});
