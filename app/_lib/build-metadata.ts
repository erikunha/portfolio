import type { Metadata } from 'next';
import { ogImage, SITE_NAME } from '@/content/seo';
import { localeAlternates, type SiteLocale } from '@/content/site-locale';
import { social } from '@/content/social';

export type HreflangInput = {
  path: string;
  defaultLocale?: SiteLocale;
};

export type PageMetadataInput = {
  title: string;
  description: string;
  canonical: string;
  ogLocale: string;
  ogType?: 'website' | 'profile';
  hreflang?: HreflangInput;
};

export function absoluteUrl(path: string): string {
  return `${social.site}${path}`;
}

export function absoluteLanguages(
  { path, defaultLocale }: HreflangInput,
  toUrl: (languagePath: string) => string = absoluteUrl,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(localeAlternates(path, defaultLocale).languages).map(([lang, langPath]) => [
      lang,
      toUrl(langPath),
    ]),
  );
}

export function buildPageMetadata({
  title,
  description,
  canonical,
  ogLocale,
  ogType = 'website',
  hreflang,
}: PageMetadataInput): Metadata {
  return {
    title,
    description,
    alternates: hreflang ? { canonical, languages: absoluteLanguages(hreflang) } : { canonical },
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
