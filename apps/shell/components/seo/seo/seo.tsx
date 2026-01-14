import { NextSeo, NextSeoProps } from 'next-seo';

export interface SEOProps extends Partial<NextSeoProps> {
  title?: string;
  description?: string;
  url?: string;
  image?: string;
}

export const DEFAULT_SEO = {
  title: 'Erik Henrique Alves Cunha - Frontend Engineer',
  description:
    'Portfolio of Erik Henrique Alves Cunha, a frontend engineer specializing in React, Next.js, and TypeScript. Building scalable, performant web applications.',
  url: 'https://erikunha.dev',
  image: 'https://erikunha.dev/og-image.jpg',
  siteName: 'Erik Henrique Portfolio',
};

export function SEO({ title, description, url, image, ...rest }: SEOProps) {
  const seoTitle = title || DEFAULT_SEO.title;
  const seoDescription = description || DEFAULT_SEO.description;
  const seoUrl = url || DEFAULT_SEO.url;
  const seoImage = image || DEFAULT_SEO.image;

  return (
    <NextSeo
      title={seoTitle}
      description={seoDescription}
      canonical={seoUrl}
      openGraph={{
        type: 'website',
        url: seoUrl,
        title: seoTitle,
        description: seoDescription,
        images: [
          {
            url: seoImage,
            width: 1200,
            height: 630,
            alt: seoTitle,
          },
        ],
        siteName: DEFAULT_SEO.siteName,
      }}
      twitter={{
        handle: '@erikunha',
        site: '@erikunha',
        cardType: 'summary_large_image',
      }}
      additionalMetaTags={[
        {
          name: 'viewport',
          content: 'width=device-width, initial-scale=1',
        },
        {
          name: 'author',
          content: 'Erik Henrique Alves Cunha',
        },
        {
          name: 'keywords',
          content:
            'frontend engineer, react developer, nextjs, typescript, web development, portfolio',
        },
      ]}
      additionalLinkTags={[
        {
          rel: 'icon',
          href: '/favicon.ico',
        },
        {
          rel: 'apple-touch-icon',
          href: '/apple-touch-icon.png',
          sizes: '180x180',
        },
        {
          rel: 'manifest',
          href: '/site.webmanifest',
        },
      ]}
      {...rest}
    />
  );
}
