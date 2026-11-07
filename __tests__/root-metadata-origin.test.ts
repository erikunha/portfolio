import { describe, expect, it, vi } from 'vitest';

const MOCK_SITE = 'https://origin-under-test.example';

vi.mock('next/font/local', () => ({
  default: () => ({ variable: '--font-mock', className: 'mock' }),
}));

vi.mock('@/content/social', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/content/social')>();
  return { ...original, social: { ...original.social, site: MOCK_SITE } };
});

describe('root metadata origin', () => {
  it('derives every origin-bearing field from social.site, so one edit moves them all', async () => {
    const { rootMetadata } = await import('@/components/RootShell');
    const { personSchema } = await import('@/content/seo');
    expect(rootMetadata.metadataBase?.toString()).toBe(`${MOCK_SITE}/`);
    expect(rootMetadata.authors).toEqual([expect.objectContaining({ url: MOCK_SITE })]);
    expect((rootMetadata.openGraph as { url: string }).url).toBe(MOCK_SITE);
    expect(rootMetadata.alternates?.canonical).toBe(MOCK_SITE);
    expect(personSchema.url).toBe(MOCK_SITE);
  });

  it('derives site name and locale from the shared SEO constants', async () => {
    const { rootMetadata } = await import('@/components/RootShell');
    const { SITE_NAME } = await import('@/content/seo');
    const { SITE_OG_LOCALE } = await import('@/content/site-locale');
    const og = rootMetadata.openGraph as { siteName: string; locale: string };
    expect(og.siteName).toBe(SITE_NAME);
    expect(og.locale).toBe(SITE_OG_LOCALE.en);
  });
});
