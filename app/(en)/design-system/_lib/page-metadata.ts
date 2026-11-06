import type { Metadata } from 'next';
import { buildPageMetadata } from '@/app/_lib/build-metadata';
import { OG_LOCALE } from '@/content/seo';

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
    ogLocale: OG_LOCALE,
  });
}
