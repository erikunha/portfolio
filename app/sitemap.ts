import type { MetadataRoute } from 'next';
import { absoluteLanguages, absoluteUrl, type HreflangInput } from '@/app/_lib/build-metadata';
import { LINKS_HREFLANG } from '@/app/_lib/links-metadata';
import { DS_ROUTES } from '@/app/(en)/design-system/_components/ds-nav';
import { social } from '@/content/social';

function sitemapUrl(path: string): string {
  return path === '/' ? social.site : absoluteUrl(path);
}

function languageLinks(input: HreflangInput): Record<string, string> {
  return absoluteLanguages(input, sitemapUrl);
}

export default function sitemap(): MetadataRoute.Sitemap {
  const base = social.site;
  const linksLanguages = languageLinks(LINKS_HREFLANG);
  return [
    {
      url: base,
      changeFrequency: 'monthly',
      priority: 1,
      alternates: { languages: languageLinks({ path: '/' }) },
    },
    {
      url: `${base}/pt`,
      changeFrequency: 'monthly',
      priority: 1,
      alternates: { languages: languageLinks({ path: '/' }) },
    },
    {
      url: `${base}/cv`,
      changeFrequency: 'monthly',
      priority: 0.9,
      alternates: { languages: languageLinks({ path: '/cv' }) },
    },
    {
      url: `${base}/pt/cv`,
      changeFrequency: 'monthly',
      priority: 0.9,
      alternates: { languages: languageLinks({ path: '/cv' }) },
    },
    {
      url: `${base}/summary`,
      changeFrequency: 'monthly',
      priority: 0.8,
      alternates: { languages: languageLinks({ path: '/summary' }) },
    },
    {
      url: `${base}/pt/summary`,
      changeFrequency: 'monthly',
      priority: 0.8,
      alternates: { languages: languageLinks({ path: '/summary' }) },
    },
    {
      url: `${base}/links`,
      changeFrequency: 'weekly',
      priority: 0.8,
      alternates: { languages: linksLanguages },
    },
    {
      url: `${base}/links/en`,
      changeFrequency: 'weekly',
      priority: 0.7,
      alternates: { languages: linksLanguages },
    },
    ...DS_ROUTES.map((route) => ({
      url: `${base}${route}`,
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    })),
  ];
}
