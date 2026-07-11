import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('sitemap()', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns an array of sitemap entries', async () => {
    const { default: sitemap } = await import('@/app/sitemap');
    const entries = sitemap();
    expect(Array.isArray(entries)).toBe(true);
    expect(entries.length).toBeGreaterThan(0);
  });

  it('includes the home URL entry', async () => {
    const { default: sitemap } = await import('@/app/sitemap');
    const entries = sitemap();
    const home = entries.find((e) => e.url === 'https://erikunha.dev');
    expect(home).toBeDefined();
    expect(home?.priority).toBe(1);
  });

  it('includes design-system section URLs', async () => {
    const { default: sitemap } = await import('@/app/sitemap');
    const entries = sitemap();
    const dsUrls = entries.filter((e) => e.url.includes('/design-system'));
    expect(dsUrls.length).toBeGreaterThanOrEqual(5);
  });

  it('uses CONTENT_UPDATED_AT env var for home page lastModified when set', async () => {
    vi.stubEnv('CONTENT_UPDATED_AT', '2026-03-15');
    const { default: sitemap } = await import('@/app/sitemap');
    const entries = sitemap();
    const home = entries.find((e) => e.url === 'https://erikunha.dev');
    expect(home?.lastModified).toEqual(new Date('2026-03-15'));
  });

  it('falls back to a default date when CONTENT_UPDATED_AT is not set', async () => {
    vi.stubEnv('CONTENT_UPDATED_AT', '');
    const { default: sitemap } = await import('@/app/sitemap');
    const entries = sitemap();
    const home = entries.find((e) => e.url === 'https://erikunha.dev');
    expect(home?.lastModified).toEqual(new Date('2026-05-22'));
  });
});
