import './globals.css';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { personSchema } from '@/content/seo';

// Self-hosted — no Google CDN link shipped to the browser
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
  title: 'Erik Cunha — Senior Full-Stack Engineer · Frontend Architecture & AI',
  description:
    'Senior Full-Stack Engineer specializing in Frontend Architecture, Platform & AI Applied Engineering. UI/UX, Accessibility, Web Performance for High-Traffic Apps. React, Next.js, Angular, TypeScript, Node.js, AWS.',
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
    title: 'Erik Cunha — Senior Full-Stack Engineer · Frontend Architecture & AI',
    description:
      'Senior Full-Stack Engineer · Frontend Architecture · Platform & AI Applied Engineering · React · Next.js · Angular · TypeScript · Node.js · AWS',
    siteName: 'erikunha.dev',
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: 'Erik Cunha — Senior Full-Stack Engineer · Frontend Architecture & AI',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Erik Cunha — Senior Full-Stack Engineer · Frontend Architecture & AI',
    description:
      'Frontend Architecture · Platform & AI Applied Engineering · UI/UX · Accessibility · React · Next.js · Angular · TypeScript · Node.js · AWS',
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

// WHY inline script instead of <Script strategy="beforeInteractive">:
// beforeInteractive injects the script into the self.__next_s queue, which runs
// just before React.hydrateRoot(). In Lantern simulation this executes at ~3162ms
// (after all framework JS loads) — well after FCP (~2019ms) and ON the TTI
// critical path. An inline <script> at the START of <body> runs synchronously
// during HTML parsing (~650ms) — earlier than beforeInteractive — and is off the
// hydrateRoot critical path: ~250ms saved (62ms real × 4x CPU) on Lantern's TTI
// estimate (LCP 3516→3385, FCP 2019→1355, 5/5 runs pass the mobile gate).
// It MUST be inside <body>, not <head>: the script writes document.body.dataset,
// and document.body is null while the <head> is still parsing.
// CSP-safe: proxy.ts ships `script-src 'self' 'unsafe-inline'` (no nonce/hash by
// design — see proxy.ts), which covers this inline script. See DECISIONS.md.
const initScript = `history.scrollRestoration="manual";window.scrollTo(0,0);(function(){try{var m=localStorage.getItem("erik.motion");var on=m==="on"?true:m==="off"?false:!window.matchMedia("(prefers-reduced-motion:reduce)").matches;document.body.dataset.motion=on?"full":"reduce"}catch(e){}})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${mono.variable} ${display.variable}`} suppressHydrationWarning>
      {/* if you're inspecting this, you're hiring me · erikhenriquealvescunha@gmail.com */}
      <head>
        <script type="application/ld+json">{personJsonLd}</script>
      </head>
      {/* body[data-motion] is set by the inline bootstrap at the top of <body>
          below, before paint; suppressHydrationWarning so React doesn't flag the
          SSR/CSR attribute delta. */}
      <body suppressHydrationWarning>
        {/* Inside <body> (not <head>) so document.body exists when this runs — a
            <head> script would see document.body === null and silently no-op. React
            may stream an RSC scaffold div before it, but it still executes at parse
            time, before body content paints and before hydration, setting
            body[data-motion] from stored/OS pref so CRT-effect CSS selectors are
            correct on the first visible frame (no reduced-motion flash). Off the
            hydrateRoot critical path — the LCP win. Build-time constant, no XSS. */}
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: initScript is a hardcoded build-time constant, no user input */}
        <script dangerouslySetInnerHTML={{ __html: initScript }} />
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
