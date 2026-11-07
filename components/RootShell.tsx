import '@/app/globals.css';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { Suspense } from 'react';
import { GlobalMotion } from '@/components/client/GlobalMotion';
import { NoscriptBar } from '@/components/NoscriptBar';
import { profile, profileMetaDescription, profilePageTitle } from '@/content/profile';
import { personSchema } from '@/content/seo';
import type { SiteLocale } from '@/content/site-locale';
import { serializeJsonLd } from '@/lib/json-ld';

const mono = localFont({
  src: [
    { path: '../public/fonts/jetbrains-mono-400.woff2', weight: '400', style: 'normal' },
    { path: '../public/fonts/jetbrains-mono-700.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-mono-src',
  display: 'swap',
  preload: true,
});

const display = localFont({
  src: [{ path: '../public/fonts/inter-900.woff2', weight: '900', style: 'normal' }],
  variable: '--font-display-src',
  display: 'swap',
  preload: false,
});

export const rootMetadata: Metadata = {
  metadataBase: new URL('https://www.erikunha.dev'),
  title: profilePageTitle,
  description: profileMetaDescription,
  keywords: [
    profile.title,
    'Applied AI',
    'LLM Systems',
    'LLM Evaluation',
    'Agents',
    'Guardrails',
    'Angular',
    'React',
    'Next.js',
    'Node.js',
    'TypeScript',
    'PCI-DSS',
    'Healthcare',
    'E-commerce',
    'AI-native SaaS',
  ],
  authors: [{ name: profile.fullName, url: 'https://www.erikunha.dev' }],
  creator: profile.fullName,
  manifest: '/site.webmanifest',
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
    apple: '/apple-touch-icon.png',
    other: [
      { rel: 'icon', url: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
      { rel: 'icon', url: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://www.erikunha.dev',
    title: profilePageTitle,
    description: profileMetaDescription,
    siteName: 'erikunha.dev',
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: profilePageTitle,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: profilePageTitle,
    description: profileMetaDescription,
    images: ['/og.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
  alternates: {
    canonical: 'https://www.erikunha.dev',
  },
};

const personJsonLd = serializeJsonLd(personSchema);

const initScript = `history.scrollRestoration="manual";window.scrollTo(0,0);(function(){try{var m=localStorage.getItem("erik.motion");var on=m==="on"?true:m==="off"?false:!window.matchMedia("(prefers-reduced-motion:reduce)").matches;document.body.dataset.motion=on?"full":"reduce"}catch(e){}})();`;

export const ROOT_HTML_CLASS_NAME = `${mono.variable} ${display.variable}`;

export function RootShell({
  locale,
  children,
}: Readonly<{ locale: SiteLocale; children: React.ReactNode }>) {
  return (
    <>
      {/* biome-ignore lint/style/noHeadElement: this fragment is the shared body of every root layout, whose html element owns this head */}
      <head>
        <script type="application/ld+json">{personJsonLd}</script>
      </head>
      <body suppressHydrationWarning>
        <NoscriptBar locale={locale} />
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: initScript is a hardcoded build-time constant, no user input */}
        <script dangerouslySetInnerHTML={{ __html: initScript }} />
        <Suspense fallback={null}>
          <GlobalMotion />
        </Suspense>
        {children}
        {process.env.VERCEL === '1' && (
          <>
            <Analytics />
            <SpeedInsights />
          </>
        )}
      </body>
    </>
  );
}
