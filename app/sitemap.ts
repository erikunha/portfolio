import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://www.erikunha.dev';
  const dsDate = new Date('2026-05-23');

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
