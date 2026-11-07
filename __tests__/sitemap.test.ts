import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { social } from '@/content/social';

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
    const home = entries.find((e) => e.url === social.site);
    expect(home).toBeDefined();
    expect(home?.priority).toBe(1);
  });

  it('includes design-system section URLs', async () => {
    const { default: sitemap } = await import('@/app/sitemap');
    const entries = sitemap();
    const dsUrls = entries.filter((e) => e.url.includes('/design-system'));
    expect(dsUrls.length).toBeGreaterThanOrEqual(5);
  });

  it('lists the CV and summary reading views', async () => {
    const { default: sitemap } = await import('@/app/sitemap');
    const urls = sitemap().map((e) => e.url);
    expect(urls).toContain(`${social.site}/cv`);
    expect(urls).toContain(`${social.site}/summary`);
  });

  it('claims no lastModified date that nothing measures', async () => {
    const { default: sitemap } = await import('@/app/sitemap');
    const dated = sitemap().filter((entry) => entry.lastModified !== undefined);
    expect(
      dated.map((entry) => entry.url),
      'hand-written lastmod dates go stale, and search engines ignore lastmod that is not accurate',
    ).toEqual([]);
  });
});
