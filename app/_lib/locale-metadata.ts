import type { Metadata } from 'next';
import { buildPageMetadata } from '@/app/_lib/build-metadata';
import {
  localeAlternates,
  localizedPath,
  SITE_HTML_LANG,
  SITE_OG_LOCALE,
  type SiteLocale,
} from '@/content/site-locale';
import { social } from '@/content/social';

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

  return buildPageMetadata({
    title,
    description,
    canonical: url,
    ogLocale: SITE_OG_LOCALE[locale],
    ogType,
    languages: Object.fromEntries(
      Object.entries(alternates.languages).map(([lang, langPath]) => [
        lang,
        `${social.site}${langPath}`,
      ]),
    ),
  });
}

export { localizedPath, SITE_HTML_LANG };
