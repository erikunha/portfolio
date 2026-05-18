import type { Metadata } from 'next';
import localFont from 'next/font/local';
import Script from 'next/script';
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
  preload: false,
});

export const metadata: Metadata = {
  metadataBase: new URL('https://erikunha.dev'),
  title: 'Erik Cunha — Senior Full-Stack Engineer, Frontend',
  description:
    'Senior Full-Stack Engineer, Frontend with 8+ years building regulated, high-traffic systems in fintech (PCI-DSS), healthcare, and global e-commerce. Angular · React · Next.js · Node.js · TypeScript.',
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
    title: 'Erik Cunha — Senior Full-Stack Engineer, Frontend',
    description:
      'Senior Full-Stack Engineer, Frontend · 8+ yrs · Angular · React · Next.js · Node.js · AWS · PCI-DSS',
    siteName: 'erikunha.dev',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Erik Cunha Portfolio' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Erik Cunha — Senior Full-Stack Engineer, Frontend',
    description:
      'Senior Full-Stack Engineer, Frontend · Angular · React · Next.js · Node.js · AWS · TypeScript',
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

// Critical CSS inlined to eliminate render-block on Hero LCP element.
// Drift-protected by __tests__/critical-css-drift.test.ts (selector +
// variable existence checks; NOT rule-body equivalence — see test docblock).
// Spec ref: docs/superpowers/specs/2026-05-18-mobile-lcp-perf-fix-design.md §5
const CRITICAL_CSS = `
/* 1. :root tokens */
:root {
  --bg: #000000;
  --signal: #00ff41;
  --signal-dim: rgba(0, 255, 65, 0.4);
  --signal-dim-2: rgba(0, 255, 65, 0.1);
  --fg: #c8facc;
  --muted: #4ade80;
  --highlight-fg: #000000;
  --border: rgba(0, 255, 65, 0.2);
  --pad: 24px;
  --maxw: 1200px;
  --vrhythm: 64px;
  --font-mono-stack: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  --font-display-stack: ui-sans-serif, system-ui, sans-serif;
  --fs-2xs: 9px;
  --fs-xs: 11px;
  --fs-sm: 12px;
  --fs-base: 14px;
  --fs-md: 16px;
  --fs-lg: 22px;
  --fs-xl: 32px;
  --fs-2xl: 48px;
  --fs-3xl: 78px;
}
@media (max-width: 768px) {
  :root {
    --vrhythm: 18px;
    --pad: 14px;
    --fs-3xl: 56px;
    --fs-2xl: 32px;
  }
}

/* 2. Box-sizing reset + html/body base */
*,
*::before,
*::after {
  box-sizing: border-box;
}
html,
body {
  margin: 0;
  padding: 0;
  background: var(--bg);
  color: var(--fg);
  font-family: var(--font-mono-stack);
  font-size: 16px;
  line-height: 1.55;
  -webkit-font-smoothing: antialiased;
  overflow-x: hidden;
}

/* 3. .page container */
.page {
  display: flex;
  flex-direction: column;
  position: relative;
  z-index: 10;
  max-width: var(--maxw);
  margin: 0 auto;
  padding: 60px var(--pad) 0;
}
@media (max-width: 900px) {
  .page {
    padding: 20px 18px 0;
  }
}
@media (max-width: 768px) {
  .page {
    padding: 14px var(--pad) 0;
  }
}

/* 4. Hero bordered panel */
.hero {
  position: relative;
  border: 1px solid var(--signal-dim);
  min-height: 640px;
  padding: 0;
  overflow: hidden;
  background: transparent;
  transition: transform 80ms ease-out;
  margin-bottom: var(--vrhythm);
}
@media (max-width: 900px) {
  .hero {
    min-height: 520px;
  }
}

/* 5. Hero responsive toggle */
.hero--desktop {
  display: flex;
}
.hero--mobile {
  display: none;
}
@media (max-width: 768px) {
  .hero--desktop {
    display: none;
  }
  .hero--mobile {
    display: block;
  }
}

/* Hero desktop two-column layout */
.hero__left {
  flex: 1;
  position: relative;
  overflow: hidden;
}
.hero__bio {
  flex: 1;
  border-left: 1px dashed var(--signal-dim);
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 32px 24px;
  gap: 10px;
}
@media (max-width: 900px) {
  .hero__bio {
    padding: 24px 18px;
  }
}
.hero__bio .hero__name {
  font-family: var(--font-mono-stack);
  font-weight: 700;
  font-size: var(--fs-xl);
  color: var(--signal);
  margin: 0 0 4px;
  line-height: 1.2;
}
.hero__tagline {
  color: var(--fg);
  font-size: var(--fs-base);
  line-height: 1.55;
  margin-bottom: 8px;
}
.hero__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 12px;
  color: var(--muted);
  font-size: var(--fs-sm);
  letter-spacing: 0.08em;
  margin-bottom: 14px;
}
.hero__meta b {
  color: var(--signal);
  font-weight: 700;
}
.hero__bio .hero__tagline,
.hero__bio .hero__meta {
  margin: 0;
}
.hero__status {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  border: 1px solid var(--signal-dim);
  color: var(--signal);
  font-family: var(--font-mono-stack);
  font-size: var(--fs-xs);
  letter-spacing: 0.12em;
  padding: 6px 10px;
  white-space: nowrap;
  align-self: flex-start;
}
.hero__ctas {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.hero__cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 0 14px;
  border: 1px solid var(--signal-dim);
  font-size: var(--fs-base);
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  transition:
    box-shadow 200ms ease,
    background 200ms ease;
}
.hero__cta--primary {
  background: var(--signal);
  color: var(--bg);
  border-color: var(--signal);
}
.hero__cta--secondary {
  color: var(--signal);
}

/* Mobile hero name */
.hero--mobile .hero__name {
  font-family: var(--font-mono-stack);
  font-weight: 700;
  font-size: var(--fs-lg);
  color: var(--signal);
  border-top: 1px dashed var(--signal-dim-2);
  padding-top: 14px;
  margin-top: 6px;
  margin-bottom: 2px;
}
`;

// React 19 renders script children via textContent (safe; no innerHTML)
const personJsonLd = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'Person',
  name: 'Erik Henrique Alves Cunha',
  alternateName: 'Erik Cunha',
  jobTitle: 'Senior Full-Stack Engineer, Frontend',
  description:
    'Senior Full-Stack Engineer, Frontend with 8+ years building regulated, high-traffic systems in fintech (PCI-DSS), healthcare, and global e-commerce.',
  url: 'https://erikunha.dev',
  email: 'mailto:erikhenriquealvescunha@gmail.com',
  knowsLanguage: ['pt', 'en', 'fr', 'es'],
  sameAs: [
    'https://github.com/erikunha',
    'https://www.linkedin.com/in/erikunha/',
    'https://erikunha.dev',
  ],
});

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${mono.variable} ${display.variable}`} suppressHydrationWarning>
      {/* if you're inspecting this, you're hiring me · erikhenriquealvescunha@gmail.com */}
      <head>
        <style>{CRITICAL_CSS}</style>
        <script type="application/ld+json">{personJsonLd}</script>
      </head>
      {/* body[data-motion] is mutated at runtime by /init.js before paint; keep
          suppressHydrationWarning so React doesn't flag the SSR/CSR attribute delta. */}
      <body suppressHydrationWarning>
        <Script src="/init.js" strategy="beforeInteractive" />
        {children}
      </body>
    </html>
  );
}
