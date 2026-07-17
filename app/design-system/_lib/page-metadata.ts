import type { Metadata } from 'next';
import { OG_IMAGE_PATH, OG_LOCALE, ogImage, SITE_NAME } from '@/content/seo';

export function dsPageMetadata({
  slug,
  title,
  description,
}: {
  slug: string;
  title: string;
  description: string;
}): Metadata {
  const path = slug === '' ? '/design-system' : `/design-system/${slug}`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: 'website',
      locale: OG_LOCALE,
      url: path,
      title,
      description,
      siteName: SITE_NAME,
      images: [ogImage(title)],
    },
    twitter: { card: 'summary_large_image', title, description, images: [OG_IMAGE_PATH] },
  };
}
