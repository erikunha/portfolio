import type { MetadataRoute } from 'next';
import { DS_ROUTES } from '@/app/(en)/design-system/_components/ds-nav';
import { localeAlternates } from '@/content/site-locale';
import { social } from '@/content/social';

const LANGUAGE_KEY = { pt: 'pt-BR', en: 'en-US', default: 'x-default' } as const;

function absoluteUrl(path: string): string {
  return `${social.site}${path === '/' ? '' : path}`;
}

function languageLinks(path: string): Record<string, string> {
  const alternates = localeAlternates(path);
  return {
    [LANGUAGE_KEY.pt]: absoluteUrl(alternates.pt),
    [LANGUAGE_KEY.en]: absoluteUrl(alternates.en),
    [LANGUAGE_KEY.default]: absoluteUrl(alternates.en),
  };
}

export default function sitemap(): MetadataRoute.Sitemap {
  const base = social.site;
  return [
    {
      url: base,
      changeFrequency: 'monthly',
      priority: 1,
      alternates: { languages: languageLinks('/') },
    },
    {
      url: `${base}/pt`,
      changeFrequency: 'monthly',
      priority: 1,
      alternates: { languages: languageLinks('/') },
    },
    {
      url: `${base}/cv`,
      changeFrequency: 'monthly',
      priority: 0.9,
      alternates: { languages: languageLinks('/cv') },
    },
    {
      url: `${base}/pt/cv`,
      changeFrequency: 'monthly',
      priority: 0.9,
      alternates: { languages: languageLinks('/cv') },
    },
    {
      url: `${base}/summary`,
      changeFrequency: 'monthly',
      priority: 0.8,
      alternates: { languages: languageLinks('/summary') },
    },
    {
      url: `${base}/pt/summary`,
      changeFrequency: 'monthly',
      priority: 0.8,
      alternates: { languages: languageLinks('/summary') },
    },
    {
      url: `${base}/links`,
      changeFrequency: 'weekly',
      priority: 0.8,
      alternates: {
        languages: {
          [LANGUAGE_KEY.pt]: `${base}/links`,
          [LANGUAGE_KEY.en]: `${base}/links/en`,
          [LANGUAGE_KEY.default]: `${base}/links`,
        },
      },
    },
    {
      url: `${base}/links/en`,
      changeFrequency: 'weekly',
      priority: 0.7,
      alternates: {
        languages: {
          [LANGUAGE_KEY.pt]: `${base}/links`,
          [LANGUAGE_KEY.en]: `${base}/links/en`,
          [LANGUAGE_KEY.default]: `${base}/links`,
        },
      },
    },
    ...DS_ROUTES.map((route) => ({
      url: `${base}${route}`,
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    })),
  ];
}
