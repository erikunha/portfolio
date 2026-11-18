import type { Metadata } from 'next';
import { buildPageMetadata } from '@/app/_lib/build-metadata';
import { linksContent } from '@/content/links';
import { LINKS_PATH } from '@/content/links.constants';
import { SITE_LOCALE, SITE_OG_LOCALE, type SiteLocale } from '@/content/site-locale';
import { social } from '@/content/social';

export const LINKS_HREFLANG = {
  path: LINKS_PATH[SITE_LOCALE.pt],
  defaultLocale: SITE_LOCALE.pt,
} as const;

export function linksPageMetadata(locale: SiteLocale): Metadata {
  const { meta } = linksContent;

  return buildPageMetadata({
    title: meta.title[locale],
    description: meta.description[locale],
    canonical: `${social.site}${LINKS_PATH[locale]}`,
    ogLocale: SITE_OG_LOCALE[locale],
    ogType: 'profile',
    hreflang: LINKS_HREFLANG,
  });
}
