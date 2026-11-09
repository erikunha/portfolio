import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const BUILD_DATE = '2026-03-04';
const COLD_START_INSTANT = new Date('2031-09-10T12:00:00.000Z');
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe('HIRING_PROFILE.last_updated', () => {
  it('is the date baked at build time, not the date the server instance started', async () => {
    vi.stubEnv('BUILD_DATE', BUILD_DATE);
    vi.useFakeTimers({ now: COLD_START_INSTANT });
    const { HIRING_PROFILE } = await import('@/lib/hiring-profile');
    expect(HIRING_PROFILE.last_updated).toBe(BUILD_DATE);
  });

  it('refuses to load when no build date was baked, instead of stamping the start date', async () => {
    vi.stubEnv('BUILD_DATE', '');
    await expect(import('@/lib/hiring-profile')).rejects.toThrow();
  });
});

describe('next.config', () => {
  it('bakes the build date into the bundle through the env map', async () => {
    const { default: nextConfig } = await import('../next.config');
    expect(nextConfig.env?.BUILD_DATE).toMatch(ISO_DATE);
  });
});
