import type { Metadata } from 'next';
import { buildPageMetadata } from '@/app/_lib/build-metadata';
import { SITE_LOCALE, SITE_OG_LOCALE } from '@/content/site-locale';

export function dsPageMetadata({
  slug,
  title,
  description,
}: {
  slug: string;
  title: string;
  description: string;
}): Metadata {
  return buildPageMetadata({
    title,
    description,
    canonical: slug === '' ? '/design-system' : `/design-system/${slug}`,
    ogLocale: SITE_OG_LOCALE[SITE_LOCALE.en],
  });
}
