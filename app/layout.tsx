import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { headers } from 'next/headers';
import './globals.css';

// Self-hosted per CLAUDE.md — no Google CDN link shipped to the browser
const mono = localFont({
  src: [
    { path: '../public/fonts/jetbrains-mono-400.woff2', weight: '400', style: 'normal' },
    { path: '../public/fonts/jetbrains-mono-500.woff2', weight: '500', style: 'normal' },
    { path: '../public/fonts/jetbrains-mono-700.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-mono',
  display: 'swap',
  preload: true,
});

const display = localFont({
  src: [{ path: '../public/fonts/inter-900.woff2', weight: '900', style: 'normal' }],
  variable: '--font-display',
  display: 'swap',
  preload: true,
});

export const metadata: Metadata = {
  metadataBase: new URL('https://erikunha.dev'),
  title: 'Erik Cunha — Senior Full-Stack Engineer',
  description:
    'Senior Full-Stack Engineer (Frontend-heavy) with 8+ years building regulated, high-traffic systems in fintech (PCI-DSS), healthcare, and global e-commerce. Angular · React · Next.js · Node.js · TypeScript.',
  keywords: [
    'Full-Stack Engineer',
    'Frontend Engineer',
    'Angular',
    'React',
    'Next.js',
    'Node.js',
    'AWS',
    'TypeScript',
    'Staff Engineer',
    'Principal Engineer',
    'PCI-DSS',
    'Healthcare',
    'E-commerce',
  ],
  authors: [{ name: 'Erik Henrique Alves Cunha', url: 'https://erikunha.dev' }],
  creator: 'Erik Henrique Alves Cunha',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://erikunha.dev',
    title: 'Erik Cunha — Senior Full-Stack Engineer',
    description:
      'Senior Full-Stack Engineer (Frontend-heavy) · 8+ yrs · Angular · React · Next.js · Node.js · AWS · PCI-DSS',
    siteName: 'erikunha.dev',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Erik Cunha Portfolio' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Erik Cunha — Senior Full-Stack Engineer',
    description:
      'Senior Full-Stack Engineer · Angular · React · Next.js · Node.js · AWS · TypeScript',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
  alternates: {
    canonical: 'https://erikunha.dev',
  },
};

// React 19 renders script children via textContent (safe; no innerHTML)
const personJsonLd = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'Person',
  name: 'Erik Henrique Alves Cunha',
  alternateName: 'Erik Cunha',
  jobTitle: 'Senior Full-Stack Engineer',
  description:
    'Senior Full-Stack Engineer (Frontend-heavy) with 8+ years building regulated, high-traffic systems in fintech (PCI-DSS), healthcare, and global e-commerce.',
  url: 'https://erikunha.dev',
  email: 'mailto:erikhenriquealvescunha@gmail.com',
  knowsLanguage: ['pt', 'en', 'fr', 'es'],
  sameAs: [
    'https://github.com/erikunha',
    'https://www.linkedin.com/in/erikunha/',
    'https://erikunha.dev',
  ],
});

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  return (
    <html lang="en" className={`${mono.variable} ${display.variable}`} suppressHydrationWarning>
      {/* if you're inspecting this, you're hiring me · erikhenriquealvescunha@gmail.com */}
      <head>
        {/* Disable browser scroll restoration so the page always loads at the top */}
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: 'history.scrollRestoration="manual";window.scrollTo(0,0)',
          }}
        />
        <script type="application/ld+json">{personJsonLd}</script>
      </head>
      <body suppressHydrationWarning>
        {/*
          Runs synchronously before any React JS or CSS paint.
          Sets body[data-motion] so CSS selectors are correct from the first frame,
          eliminating the CRT animation flash for users with stored preferences.
        */}
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html:
              '(function(){try{var m=localStorage.getItem("erik.motion");var on=m==="on"?true:m==="off"?false:!window.matchMedia("(prefers-reduced-motion:reduce)").matches;document.body.dataset.motion=on?"full":"reduce";}catch(e){}})();',
          }}
        />
        {children}
      </body>
    </html>
  );
}
