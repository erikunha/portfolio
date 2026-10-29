import type { MetadataRoute } from 'next';
import { DS_ROUTES } from '@/app/design-system/_components/ds-nav';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://www.erikunha.dev';
  const dsDate = new Date('2026-05-23');
  const linksDate = new Date('2026-08-30');

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
    ...DS_ROUTES.map((route) => ({
      url: `${base}${route}`,
      lastModified: dsDate,
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    })),
  ];
}
