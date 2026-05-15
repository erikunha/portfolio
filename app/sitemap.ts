import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: 'https://erikunha.com.br',
      lastModified: process.env.CONTENT_UPDATED_AT
        ? new Date(process.env.CONTENT_UPDATED_AT)
        : new Date('2025-05-01'),
      changeFrequency: 'monthly',
      priority: 1,
    },
  ];
}
