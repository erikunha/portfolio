import type { Metadata } from 'next';
import { linksContent } from '@/content/links';
import { LINKS_PATH } from '@/content/links.constants';
import { OG_IMAGE_PATH, ogImage, SITE_NAME } from '@/content/seo';
import { SITE_LOCALE, SITE_OG_LOCALE, type SiteLocale } from '@/content/site-locale';

export function linksPageMetadata(locale: SiteLocale): Metadata {
  const { meta } = linksContent;
  const title = meta.title[locale];
  const description = meta.description[locale];
  const path = LINKS_PATH[locale];

  return {
    title,
    description,
    alternates: {
      canonical: path,
      languages: {
        'pt-BR': LINKS_PATH[SITE_LOCALE.pt],
        'en-US': LINKS_PATH[SITE_LOCALE.en],
        'x-default': LINKS_PATH[SITE_LOCALE.pt],
      },
    },
    openGraph: {
      type: 'profile',
      locale: SITE_OG_LOCALE[locale],
      url: path,
      title,
      description,
      siteName: SITE_NAME,
      images: [ogImage(title)],
    },
    twitter: { card: 'summary_large_image', title, description, images: [OG_IMAGE_PATH] },
  };
}
