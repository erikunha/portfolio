import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: 'https://erikunha.dev',
      lastModified: process.env.CONTENT_UPDATED_AT
        ? new Date(process.env.CONTENT_UPDATED_AT)
        : new Date('2026-05-22'),
      changeFrequency: 'monthly',
      priority: 1,
    },
  ];
}
