import type { Metadata } from 'next';
import { ogImage, SITE_NAME } from '@/content/seo';

export type PageMetadataInput = {
  title: string;
  description: string;
  canonical: string;
  ogLocale: string;
  ogType?: 'website' | 'profile';
  languages?: Record<string, string>;
};

export function buildPageMetadata({
  title,
  description,
  canonical,
  ogLocale,
  ogType = 'website',
  languages,
}: PageMetadataInput): Metadata {
  return {
    title,
    description,
    alternates: languages ? { canonical, languages } : { canonical },
    openGraph: {
      type: ogType,
      locale: ogLocale,
      url: canonical,
      title,
      description,
      siteName: SITE_NAME,
      images: [ogImage(title)],
    },
    twitter: { card: 'summary_large_image', title, description, images: [ogImage(title)] },
  };
}
