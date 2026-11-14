import { afterEach, describe, expect, it, vi } from 'vitest';
import { commitSha } from '@/lib/env-build';

const DEPLOYED_SHA = 'abc1234def5678';
const LOCAL_SHA = 'local';

describe('lib/env-build commitSha', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns the deployed commit sha', () => {
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', DEPLOYED_SHA);
    expect(commitSha()).toBe(DEPLOYED_SHA);
  });

  it.each([
    ['an empty value', ''],
    ['an unset variable', undefined],
  ])('falls back to local for %s', (_label, value) => {
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', value);
    expect(commitSha()).toBe(LOCAL_SHA);
  });

  it('reads the variable at call time, not at import time', () => {
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', DEPLOYED_SHA);
    const first = commitSha();
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', 'fedcba9');
    expect([first, commitSha()]).toEqual([DEPLOYED_SHA, 'fedcba9']);
  });
});
