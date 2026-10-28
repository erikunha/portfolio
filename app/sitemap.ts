import type { MetadataRoute } from 'next';
import { READING_PATHS } from '@/content/reading-views';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://www.erikunha.dev';
  const dsDate = new Date('2026-05-23');
  const linksDate = new Date('2026-08-30');
  const readingDate = new Date('2026-10-28');

  return [
    {
      url: base,
      lastModified: process.env.CONTENT_UPDATED_AT
        ? new Date(process.env.CONTENT_UPDATED_AT)
        : new Date('2026-05-22'),
      changeFrequency: 'monthly',
      priority: 1,
    },
    {
      url: `${base}${READING_PATHS.cv}`,
      lastModified: readingDate,
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${base}${READING_PATHS.summary}`,
      lastModified: readingDate,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${base}/links`,
      lastModified: linksDate,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${base}/links/en`,
      lastModified: linksDate,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${base}/design-system`,
      lastModified: dsDate,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${base}/design-system/tokens`,
      lastModified: dsDate,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${base}/design-system/components`,
      lastModified: dsDate,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${base}/design-system/enforcement`,
      lastModified: dsDate,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${base}/design-system/changelog`,
      lastModified: dsDate,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
  ];
}
