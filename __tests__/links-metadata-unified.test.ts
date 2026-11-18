import { describe, expect, it } from 'vitest';
import { buildPageMetadata } from '@/app/_lib/build-metadata';
import { linksPageMetadata } from '@/app/_lib/links-metadata';
import sitemap from '@/app/sitemap';
import { LINKS_PATH } from '@/content/links.constants';
import { ogImage } from '@/content/seo';
import { localeAlternates, SITE_HTML_LANG, SITE_LOCALE, SITE_LOCALES } from '@/content/site-locale';
import { social } from '@/content/social';

const X_DEFAULT = 'x-default';

const absolute = (path: string) => `${social.site}${path}`;

const EXPECTED_LANGUAGES = {
  [SITE_HTML_LANG.pt]: absolute(LINKS_PATH.pt),
  [SITE_HTML_LANG.en]: absolute(LINKS_PATH.en),
  [X_DEFAULT]: absolute(LINKS_PATH.pt),
};

describe.each(SITE_LOCALES)('links metadata (%s)', (locale) => {
  const metadata = linksPageMetadata(locale);

  it('canonical and og:url are absolute and name the page itself', () => {
    expect(metadata.alternates?.canonical).toBe(absolute(LINKS_PATH[locale]));
    expect(metadata.openGraph?.url).toBe(absolute(LINKS_PATH[locale]));
  });

  it('hreflang is absolute, pairs both locales and keeps x-default on pt', () => {
    expect(metadata.alternates?.languages).toEqual(EXPECTED_LANGUAGES);
  });

  it('twitter image carries alt and size like the open graph image', () => {
    expect(metadata.twitter?.images).toEqual([ogImage(metadata.title as string)]);
    expect(metadata.openGraph?.images).toEqual([ogImage(metadata.title as string)]);
  });

  it('keeps the profile type and the summary card', () => {
    expect(metadata.openGraph).toMatchObject({ type: 'profile' });
    expect(metadata.twitter).toMatchObject({ card: 'summary_large_image' });
  });
});

describe('one hreflang source', () => {
  it('the sitemap serves the same languages object to both links entries', () => {
    const entries = sitemap().filter((entry) =>
      [absolute(LINKS_PATH.pt), absolute(LINKS_PATH.en)].includes(entry.url),
    );
    expect(entries).toHaveLength(2);
    for (const entry of entries) {
      expect(entry.alternates?.languages).toEqual(EXPECTED_LANGUAGES);
    }
  });

  it('the sitemap and the page metadata agree on every links language', () => {
    const entry = sitemap().find((item) => item.url === absolute(LINKS_PATH.en));
    expect(entry?.alternates?.languages).toEqual(
      linksPageMetadata(SITE_LOCALE.en).alternates?.languages,
    );
  });

  it('localeAlternates resolves the links pair and honours the x-default locale', () => {
    expect(localeAlternates('/links', SITE_LOCALE.pt)).toEqual({
      en: LINKS_PATH.en,
      pt: LINKS_PATH.pt,
      languages: {
        [SITE_HTML_LANG.pt]: LINKS_PATH.pt,
        [SITE_HTML_LANG.en]: LINKS_PATH.en,
        [X_DEFAULT]: LINKS_PATH.pt,
      },
    });
    expect(localeAlternates('/links').languages[X_DEFAULT]).toBe(LINKS_PATH.en);
  });

  it('buildPageMetadata takes the x-default locale and emits absolute hreflang', () => {
    const base = { title: 'T', description: 'D', canonical: absolute('/cv'), ogLocale: 'en_US' };
    const english = buildPageMetadata({ ...base, hreflang: { path: '/cv' } });
    const portuguese = buildPageMetadata({
      ...base,
      hreflang: { path: '/cv', defaultLocale: SITE_LOCALE.pt },
    });
    expect(english.alternates?.languages).toMatchObject({ [X_DEFAULT]: absolute('/cv') });
    expect(portuguese.alternates?.languages).toMatchObject({ [X_DEFAULT]: absolute('/pt/cv') });
    expect(buildPageMetadata(base).alternates).toEqual({ canonical: absolute('/cv') });
  });
});
