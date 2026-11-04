import type { MetadataRoute } from 'next';
import { DS_ROUTES } from '@/app/design-system/_components/ds-nav';
import { localeAlternates } from '@/content/site-locale';
import { social } from '@/content/social';

const LANGUAGE_KEY = { pt: 'pt-BR', en: 'en-US', default: 'x-default' } as const;

function languageLinks(path: string): Record<string, string> {
  const alternates = localeAlternates(path);
  return {
    [LANGUAGE_KEY.pt]: `${social.site}${alternates.languages[LANGUAGE_KEY.pt]}`,
    [LANGUAGE_KEY.en]: `${social.site}${alternates.languages[LANGUAGE_KEY.en]}`,
    [LANGUAGE_KEY.default]: `${social.site}${alternates.languages[LANGUAGE_KEY.default]}`,
  };
}

export default function sitemap(): MetadataRoute.Sitemap {
  const base = social.site;
  const dsDate = new Date('2026-05-23');
  const linksDate = new Date('2026-08-30');
  const readingDate = new Date('2026-10-28');
  const i18nDate = new Date('2026-11-04');
  const homeModified = process.env.CONTENT_UPDATED_AT
    ? new Date(process.env.CONTENT_UPDATED_AT)
    : new Date('2026-05-22');

  return [
    {
      url: base,
      lastModified: homeModified,
      changeFrequency: 'monthly',
      priority: 1,
      alternates: { languages: languageLinks('/') },
    },
    {
      url: `${base}/pt`,
      lastModified: i18nDate,
      changeFrequency: 'monthly',
      priority: 1,
      alternates: { languages: languageLinks('/') },
    },
    {
      url: `${base}/cv`,
      lastModified: readingDate,
      changeFrequency: 'monthly',
      priority: 0.9,
      alternates: { languages: languageLinks('/cv') },
    },
    {
      url: `${base}/pt/cv`,
      lastModified: i18nDate,
      changeFrequency: 'monthly',
      priority: 0.9,
      alternates: { languages: languageLinks('/cv') },
    },
    {
      url: `${base}/summary`,
      lastModified: readingDate,
      changeFrequency: 'monthly',
      priority: 0.8,
      alternates: { languages: languageLinks('/summary') },
    },
    {
      url: `${base}/pt/summary`,
      lastModified: i18nDate,
      changeFrequency: 'monthly',
      priority: 0.8,
      alternates: { languages: languageLinks('/summary') },
    },
    {
      url: `${base}/links`,
      lastModified: linksDate,
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
      lastModified: linksDate,
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
      lastModified: dsDate,
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    })),
  ];
}
