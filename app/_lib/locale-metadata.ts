import type { Metadata } from 'next';
import { ogImage, SITE_NAME } from '@/content/seo';
import {
  localeAlternates,
  localizedPath,
  SITE_HTML_LANG,
  SITE_OG_LOCALE,
  type SiteLocale,
} from '@/content/site-locale';
import { social } from '@/content/social';

// Per-locale page metadata for the bilingual routes (DECISIONS 2026-08-30):
// each language names itself canonical, the pair is joined by
// alternates.languages plus x-default, and the OG locale follows the page.
export function localizedPageMetadata({
  locale,
  path,
  title,
  description,
  ogType = 'website',
}: {
  locale: SiteLocale;
  path: string;
  title: string;
  description: string;
  ogType?: 'website' | 'profile';
}): Metadata {
  const canonicalPath = localizedPath(locale, path);
  const url = `${social.site}${canonicalPath}`;
  const alternates = localeAlternates(path);

  return {
    title,
    description,
    alternates: {
      canonical: url,
      languages: Object.fromEntries(
        Object.entries(alternates.languages).map(([lang, langPath]) => [
          lang,
          `${social.site}${langPath}`,
        ]),
      ),
    },
    openGraph: {
      type: ogType,
      locale: SITE_OG_LOCALE[locale],
      url,
      title,
      description,
      siteName: SITE_NAME,
      images: [ogImage(title)],
    },
    twitter: { card: 'summary_large_image', title, description, images: [ogImage(title)] },
  };
}

export { localizedPath, SITE_HTML_LANG };
