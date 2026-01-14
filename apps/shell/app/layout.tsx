import { Metadata } from 'next';
import { SkipLinks } from '../components/layout/skip-links';
import { WebVitalsTracker } from '../components/providers/web-vitals-tracker';
import { BfcacheHandler } from '../lib/infrastructure/bfcache-handler';
import { RouteAnnouncer } from '../lib/infrastructure/route-announcer';
import { ServiceWorkerRegistration } from '../lib/infrastructure/service-worker-registration/service-worker-registration';
import './global.css';

export async function generateMetadata(): Promise<Metadata> {
  const baseUrl = 'https://erikunha.dev';

  return {
    title: 'Erik Henrique Alves Cunha - Frontend Engineer',
    description:
      'Portfolio of Erik Henrique Alves Cunha, a frontend engineer specializing in React, Next.js, and TypeScript. Building scalable, performant web applications.',
    keywords: [
      'frontend engineer',
      'react developer',
      'nextjs',
      'typescript',
      'web development',
      'portfolio',
    ],
    authors: [{ name: 'Erik Henrique Alves Cunha' }],
    creator: 'Erik Henrique Alves Cunha',
    metadataBase: new URL(baseUrl),
    alternates: {
      canonical: baseUrl,
    },
    openGraph: {
      type: 'website',
      url: baseUrl,
      title: 'Erik Henrique Alves Cunha - Frontend Engineer',
      description:
        'Portfolio of Erik Henrique Alves Cunha, a frontend engineer specializing in React, Next.js, and TypeScript. Building scalable, performant web applications.',
      siteName: 'Erik Henrique Portfolio',
      locale: 'en_US',
      images: [
        {
          url: '/og-image.jpg',
          width: 1200,
          height: 630,
          alt: 'Erik Henrique Alves Cunha - Frontend Engineer',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      site: '@erikunha',
      creator: '@erikunha',
    },
    icons: {
      icon: '/favicon.ico',
      apple: '/apple-touch-icon.png',
    },
    manifest: '/site.webmanifest',
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* DNS prefetch for external resources */}
        <link rel="dns-prefetch" href="https://fonts.googleapis.com" />
        <link rel="dns-prefetch" href="https://fonts.gstatic.com" />

        {/* Preconnect for critical third-party origins */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
      </head>
      <body>
        <SkipLinks />
        {children}
        <RouteAnnouncer />

        <WebVitalsTracker />
        <ServiceWorkerRegistration />
        <BfcacheHandler />
      </body>
    </html>
  );
}
