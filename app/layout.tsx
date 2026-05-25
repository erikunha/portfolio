import './globals.css';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import type { Metadata } from 'next';
import localFont from 'next/font/local';
import Script from 'next/script';
import { personSchema } from '@/content/seo';

// Self-hosted — no Google CDN link shipped to the browser
const mono = localFont({
  src: [
    { path: '../public/fonts/jetbrains-mono-400.woff2', weight: '400', style: 'normal' },
    { path: '../public/fonts/jetbrains-mono-500.woff2', weight: '500', style: 'normal' },
    { path: '../public/fonts/jetbrains-mono-700.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-mono',
  display: 'optional',
  preload: true,
});

const display = localFont({
  src: [{ path: '../public/fonts/inter-900.woff2', weight: '900', style: 'normal' }],
  variable: '--font-display',
  display: 'swap',
  preload: false,
});

export const metadata: Metadata = {
  metadataBase: new URL('https://erikunha.dev'),
  title: 'Erik Cunha — Staff Full-Stack Engineer · Applied AI',
  description:
    'Full-Stack Engineer, 8+ yrs. LLM, RAG, multi-agent in production. €1B+ ARR, 8M+ MAU. Targeting Staff/Principal at AI-forward companies. Brazil, remote.',
  keywords: [
    'Staff Engineer',
    'Principal Engineer',
    'Full-Stack Engineer',
    'Applied AI',
    'LLM Engineering',
    'RAG',
    'Multi-Agent Systems',
    'Angular',
    'React',
    'Next.js',
    'Node.js',
    'TypeScript',
    'PCI-DSS',
    'Healthcare',
    'E-commerce',
    'iGaming',
  ],
  authors: [{ name: 'Erik Henrique Alves Cunha', url: 'https://erikunha.dev' }],
  creator: 'Erik Henrique Alves Cunha',
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
    url: 'https://erikunha.dev',
    title: 'Erik Cunha — Staff Full-Stack Engineer · Applied AI',
    description:
      'Staff Full-Stack Engineer · Applied AI · 8+ yrs · LLM · RAG · Angular · React · Next.js · Node.js',
    siteName: 'erikunha.dev',
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: 'Erik Cunha — Staff Full-Stack Engineer · Applied AI',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Erik Cunha — Staff Full-Stack Engineer · Applied AI',
    description:
      'Staff Full-Stack Engineer · Applied AI · Angular · React · Next.js · Node.js · TypeScript',
    images: ['/og.png'],
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
const personJsonLd = JSON.stringify(personSchema);

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${mono.variable} ${display.variable}`} suppressHydrationWarning>
      {/* if you're inspecting this, you're hiring me · erikhenriquealvescunha@gmail.com */}
      <head>
        <script type="application/ld+json">{personJsonLd}</script>
      </head>
      {/* body[data-motion] is mutated at runtime by /init.js before paint; keep
          suppressHydrationWarning so React doesn't flag the SSR/CSR attribute delta. */}
      <body suppressHydrationWarning>
        <Script src="/init.js" strategy="beforeInteractive" />
        {children}
        {/* Vercel RUM scripts only mount on Vercel deploys. process.env.VERCEL is
            "1" in any Vercel environment (prod/preview) and unset in local builds
            and CI. Mounting them outside Vercel logs SDK errors to the browser
            console (no token/origin), which trips Lighthouse's errors-in-console
            audit. Gating here makes the audit pass in local + CI; on prod/preview
            the SDK initializes normally with the Vercel-injected token.

            Caveat: process.env.VERCEL is read at BUILD time, not runtime. If a
            build artifact is produced outside Vercel and later deployed to a
            Vercel runtime (a "prebuilt" deploy flow), the gate stays false and
            the RUM scripts won't mount even though the app IS running on Vercel.
            This project always builds inside Vercel (every deploy is a fresh
            `next build` in the Vercel runtime), so the build-time gate is correct.
            If a future change splits build + deploy, flip this to a runtime check. */}
        {process.env.VERCEL === '1' && (
          <>
            <Analytics />
            <SpeedInsights />
          </>
        )}
      </body>
    </html>
  );
}
