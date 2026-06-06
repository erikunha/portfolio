# Mockup Port Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port two static HTML mockups (`Portfolio.html` and `Portfolio.mobile.html`) into the existing Next.js project such that the rendered output is visually and behaviorally indistinguishable from the mockups across desktop and mobile viewports.

**Architecture:** Single route `/`. Server reads UA in `app/page.tsx` (RSC) to seed an `initialIsMobile` hint, passes it to a client `<BreakpointProvider>` whose `useBreakpoint()` hook drives section-level branching after hydration via `matchMedia('(max-width: 768px)')`. One set of 19 section components, shared by both viewports, wrapped by a breakpoint-aware `<Module>` that renders as a plain `<section>` on desktop and an accordion on mobile. Forms and shell visually re-skinned but keep their existing `/api/contact` (Resend) and `/api/ask` (Anthropic) wiring.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript strict, Tailwind v4, Biome, pnpm, JetBrains Mono + Inter via `next/font`.

**Spec reference:** `docs/superpowers/specs/2026-05-14-mockup-port-design.md`

**Mockup source location:** The two mockup files currently live at `~/Downloads/erik-portifolio - mobile/Portfolio.html` and `Portfolio.mobile.html`. **Task 0 copies them into the repo under `prototype/`** so all subsequent tasks can reference them in-tree without depending on the user's home directory.

---

## File structure overview

After this plan completes, the relevant tree looks like this. Each file has one responsibility.

```
prototype/
  Portfolio.html                          ← desktop mockup (reference, never served)
  Portfolio.mobile.html                   ← mobile mockup (reference, never served)
  assets/                                 ← copy of any assets the mockups depend on
  image-slot.js                           ← copy of the mockup's interactive script (reference)

app/
  page.tsx                                ← RSC: reads UA, wraps BreakpointProvider + <Page/>
  layout.tsx                              ← (unchanged shell)
  globals.css                             ← rewritten: tokens, fonts, CRT layer, animations

lib/
  breakpoint.ts                           ← UA detection util (no React)
  use-breakpoint.ts                       ← client provider + hook

components/
  Page.tsx                                ← client: top-level composition order
  shared/
    Hero.tsx                              ← branches mobile vs desktop hero
    ReadmeSection.tsx
    ManPageSection.tsx
    NowSection.tsx
    ProjectsSection.tsx
    GitLogSection.tsx
    NpmStackSection.tsx
    SysHealthSection.tsx
    ShellSection.tsx                      ← wraps <InteractiveShell/>
    LivePerfSection.tsx
    PerfReceiptsSection.tsx
    GuitarSection.tsx
    VisaSection.tsx
    CredentialsSection.tsx
    CommunitySection.tsx
    HottestTakesSection.tsx
    ResponsibilitiesSection.tsx
    UnknownsSection.tsx
    ContactSection.tsx                    ← wraps <ContactForm/>
    Footer.tsx                            ← shutdown sequence
  responsive/
    Module.tsx                            ← breakpoint-aware section wrapper
    StatusBar.tsx                         ← mobile-only top chrome
    Dock.tsx                              ← mobile-only sticky-bottom nav
    MatrixRain.tsx                        ← canvas + RAF loop
    CRTOverlay.tsx                        ← scanlines / grain / flicker layer + reduced-motion gate
  client/
    InteractiveShell.tsx                  ← reskinned, calls /api/ask
    ContactForm.tsx                       ← reskinned, calls /api/contact
```

**Survivors (untouched):** `app/api/ask/route.ts`, `app/api/contact/route.ts`, `app/sitemap.ts`, `app/opengraph-image.tsx`, `lib/*` (existing validation, rate-limit, anthropic), `public/fonts/*`, `public/erik-cunha-cv.pdf`.

---

## Verification protocol (used in every task)

After each task, the engineer **must**:

1. Run `pnpm dev` (if not already running). Wait for "Ready in" line.
2. Open two browser windows side-by-side:
   - Left: `http://localhost:3000` (or use Playwright MCP if available)
   - Right: `file://<repo-root>/prototype/Portfolio.html` for desktop verification, or `Portfolio.mobile.html` for mobile.
3. Resize browser to **1440×900** for desktop check, then to **390×844** for mobile check.
4. Visually diff the area touched in this task.
5. If diff is acceptable, commit. If not, fix before committing.

**Quick command for screenshots** (if Playwright is installed):

```bash
pnpm exec playwright screenshot --viewport-size=1440,900 --full-page http://localhost:3000 /tmp/live-desktop.png
pnpm exec playwright screenshot --viewport-size=390,844 --full-page http://localhost:3000 /tmp/live-mobile.png
```

---

## Task 0: Demolition + preserve mockups

**Files:**
- Create: `prototype/Portfolio.html`, `prototype/Portfolio.mobile.html`, `prototype/image-slot.js`, `prototype/assets/`
- Delete: `app/page.tsx`, `components/sections/`, all `components/client/*.client.tsx` except `contact-form.client.tsx` and `matrix-rain.client.tsx` (rewritten later in-place — but easier to delete and recreate cleanly), `components/client/contact-form.client.tsx`, `components/client/matrix-rain.client.tsx`, `content/`, `__tests__/section-reveal-utils.test.ts`

- [ ] **Step 1: Copy mockups into repo**

```bash
mkdir -p prototype
cp "~/Downloads/erik-portifolio - mobile/Portfolio.html" prototype/Portfolio.html
cp "~/Downloads/erik-portifolio - mobile/Portfolio.mobile.html" prototype/Portfolio.mobile.html
cp "~/Downloads/erik-portifolio - mobile/image-slot.js" prototype/image-slot.js
cp -R "~/Downloads/erik-portifolio - mobile/assets" prototype/assets
```

Verify: `ls prototype/` shows the four entries.

- [ ] **Step 2: Delete components/sections directory**

```bash
rm -rf components/sections
```

- [ ] **Step 3: Delete client components scheduled for replacement**

```bash
rm -f components/client/hero-boot.client.tsx
rm -f components/client/matrix-rain.client.tsx
rm -f components/client/mobile-dock.client.tsx
rm -f components/client/mobile-statusbar.client.tsx
rm -f components/client/mobile-totop.client.tsx
rm -f components/client/section-reveal.client.tsx
rm -f components/client/motion-toggle.client.tsx
rm -f components/client/contact-form.client.tsx
```

- [ ] **Step 4: Delete content modules and stale test**

```bash
rm -rf content
rm -f __tests__/section-reveal-utils.test.ts
```

- [ ] **Step 5: Replace `app/page.tsx` with an empty placeholder so the dev server still boots**

Overwrite `app/page.tsx` with:

```tsx
export default function Home() {
  return <main style={{ background: '#000', color: '#00FF41', padding: 32, fontFamily: 'monospace' }}>port in progress</main>;
}
```

- [ ] **Step 6: Verify the dev server still starts**

Run:
```bash
pnpm dev
```

Wait for "Ready in". Visit `http://localhost:3000`. Expect a black page with "port in progress" in green. Stop the dev server (Ctrl-C).

- [ ] **Step 7: Commit**

```bash
git add prototype/ app/page.tsx
git add -u  # picks up the deletions
git commit -m "chore(port): demolish old impl, preserve mockups under prototype/"
```

---

## Task 1: Foundation — tokens, fonts, CRT layer, breakpoint plumbing

**Files:**
- Create: `lib/breakpoint.ts`, `lib/use-breakpoint.ts`, `components/Page.tsx`, `components/responsive/CRTOverlay.tsx`
- Modify: `app/page.tsx`, `app/layout.tsx`, `app/globals.css`

### Step 1.1: Breakpoint detection utility

- [ ] **Step 1: Create `lib/breakpoint.ts`**

```ts
// lib/breakpoint.ts
// UA-based mobile detection. Used only to seed initial SSR markup.
// After hydration, matchMedia('(max-width: 768px)') is the source of truth.

const MOBILE_REGEX = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet/i;

export const MOBILE_BREAKPOINT_PX = 768;

export function detectMobileFromUA(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;
  return MOBILE_REGEX.test(userAgent);
}
```

### Step 1.2: Provider + hook

- [ ] **Step 1: Create `lib/use-breakpoint.ts`**

```tsx
// lib/use-breakpoint.ts
'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { MOBILE_BREAKPOINT_PX } from './breakpoint';

type BreakpointCtx = {
  isMobile: boolean;
};

const Ctx = createContext<BreakpointCtx | null>(null);

export function BreakpointProvider({
  initialIsMobile,
  children,
}: {
  initialIsMobile: boolean;
  children: ReactNode;
}) {
  const [isMobile, setIsMobile] = useState(initialIsMobile);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT_PX}px)`);
    setIsMobile(mq.matches);
    const handler = (event: MediaQueryListEvent) => setIsMobile(event.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return <Ctx.Provider value={{ isMobile }}>{children}</Ctx.Provider>;
}

export function useBreakpoint(): BreakpointCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useBreakpoint must be used inside <BreakpointProvider>');
  return ctx;
}
```

### Step 1.3: Rewrite `app/globals.css` with tokens, fonts wiring, CRT layer

- [ ] **Step 1: Replace `app/globals.css` entirely**

```css
/* app/globals.css */

@import "tailwindcss";

:root {
  --signal: #00FF41;
  --signal-dim: rgba(0, 255, 65, 0.4);
  --signal-faint: rgba(0, 255, 65, 0.12);
  --fg: #C8FACC;
  --muted: #4ADE80;
  --bg: #000;
  --border: rgba(0, 255, 65, 0.2);

  --font-mono: var(--font-jetbrains-mono), ui-monospace, SFMono-Regular, monospace;
  --font-display: var(--font-inter), ui-sans-serif, system-ui, sans-serif;
}

* {
  box-sizing: border-box;
}

html, body {
  margin: 0;
  padding: 0;
  background: var(--bg);
  color: var(--fg);
  font-family: var(--font-mono);
  font-size: 14px;
  line-height: 1.5;
  text-shadow: 0 0 1px var(--signal-dim);  /* phosphor halo */
  overflow-x: hidden;
}

a {
  color: var(--signal);
  text-decoration: none;
}

a:hover, a:focus-visible {
  text-decoration: underline;
}

button {
  font-family: inherit;
  color: inherit;
  background: transparent;
  border: 1px solid var(--border);
  cursor: pointer;
}

/* ─── CRT overlay layers ─────────────────────────────────────────── */

.crt-overlay {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 1;
}

/* grain */
.crt-overlay::before {
  content: '';
  position: absolute;
  inset: 0;
  /* generated noise (tile-able 64x64 PNG, base64). Replace with extracted mockup grain in step 1.3.4. */
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='64' height='64' filter='url(%23n)' opacity='0.5'/></svg>");
  opacity: 0.08;
  z-index: 1;
}

/* scanlines */
.crt-overlay::after {
  content: '';
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    0deg,
    transparent 0px,
    transparent 1px,
    rgba(0, 0, 0, 0.4) 1px,
    rgba(0, 0, 0, 0.4) 2px
  );
  opacity: 0.06;
  z-index: 2;
}

/* RGB sub-pixel mask */
.crt-mask {
  position: fixed;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(
    90deg,
    rgba(255, 0, 0, 0.04),
    rgba(0, 255, 0, 0.04),
    rgba(0, 0, 255, 0.04)
  );
  background-size: 3px 100%;
  mix-blend-mode: multiply;
  z-index: 3;
}

/* flicker */
@keyframes crt-flicker {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.97; }
}

.crt-flicker {
  position: fixed;
  inset: 0;
  pointer-events: none;
  background: rgba(0, 255, 65, 0.02);
  animation: crt-flicker 0.3s infinite;
  z-index: 4;
}

/* scan beam (vertical sweep) */
@keyframes crt-scan-beam {
  0% { transform: translateY(-10%); }
  100% { transform: translateY(110vh); }
}

.crt-scan-beam {
  position: fixed;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(180deg, transparent, var(--signal-dim), transparent);
  pointer-events: none;
  animation: crt-scan-beam 8s linear infinite;
  z-index: 5;
}

/* Reduced motion: kill all animations */
@media (prefers-reduced-motion: reduce) {
  .crt-flicker,
  .crt-scan-beam {
    animation: none;
    opacity: 0;
  }
}

body[data-motion='reduce'] .crt-flicker,
body[data-motion='reduce'] .crt-scan-beam {
  animation: none;
  opacity: 0;
}

/* ─── Layout containers ─────────────────────────────────────────── */

.page {
  position: relative;
  z-index: 10;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px;
}

@media (max-width: 768px) {
  .page {
    padding: 0 12px;
  }
}

h1, h2, h3 {
  font-family: var(--font-mono);
  font-weight: 700;
  color: var(--signal);
  margin: 0 0 8px 0;
}

h1 {
  font-size: 48px;
  font-family: var(--font-display);
  font-weight: 900;
}

@media (max-width: 768px) {
  h1 { font-size: 32px; }
}

pre, code {
  font-family: var(--font-mono);
  white-space: pre;
}
```

- [ ] **Step 2: Optionally extract the actual grain texture from the mockup**

Open `prototype/Portfolio.html` in an editor, search for `background-image` or `data:image/png;base64`. If a grain texture exists there, copy its data URI into the `.crt-overlay::before` rule in place of the SVG placeholder. If the mockup uses a different mechanism, keep the SVG placeholder.

### Step 1.4: Wire `next/font` for JetBrains Mono + Inter

- [ ] **Step 1: Modify `app/layout.tsx`**

Open the existing `app/layout.tsx` and add font imports + class names. Replace the file with:

```tsx
// app/layout.tsx
import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { Inter } from 'next/font/google';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import './globals.css';

const jetbrainsMono = localFont({
  src: [
    { path: '../public/fonts/JetBrainsMono-Regular.woff2', weight: '400', style: 'normal' },
    { path: '../public/fonts/JetBrainsMono-Bold.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  weight: ['900'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Erik Cunha — Staff/Principal Frontend Engineer',
  description: 'Senior frontend engineer building regulated platforms in fintech, healthcare, and global e-commerce.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${jetbrainsMono.variable} ${inter.variable}`}>
      <body>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
```

If `public/fonts/JetBrainsMono-*.woff2` does not exist, check `ls public/fonts/` and substitute the correct filenames into the `src` array.

### Step 1.5: CRTOverlay component

- [ ] **Step 1: Create `components/responsive/CRTOverlay.tsx`**

```tsx
// components/responsive/CRTOverlay.tsx
'use client';

import { useEffect } from 'react';

export function CRTOverlay() {
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => {
      document.body.dataset.motion = mq.matches ? 'reduce' : 'full';
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  return (
    <>
      <div className="crt-overlay" aria-hidden />
      <div className="crt-mask" aria-hidden />
      <div className="crt-flicker" aria-hidden />
      <div className="crt-scan-beam" aria-hidden />
    </>
  );
}
```

### Step 1.6: `components/Page.tsx` skeleton

- [ ] **Step 1: Create `components/Page.tsx`**

```tsx
// components/Page.tsx
'use client';

import { CRTOverlay } from './responsive/CRTOverlay';

export function Page() {
  return (
    <>
      <CRTOverlay />
      <main className="page">
        <div style={{ color: 'var(--signal)', fontFamily: 'var(--font-mono)', padding: 32 }}>
          foundation laid · sections coming
        </div>
      </main>
    </>
  );
}
```

### Step 1.7: Rewrite `app/page.tsx`

- [ ] **Step 1: Overwrite `app/page.tsx`**

```tsx
// app/page.tsx
import { headers } from 'next/headers';
import { detectMobileFromUA } from '@/lib/breakpoint';
import { BreakpointProvider } from '@/lib/use-breakpoint';
import { Page } from '@/components/Page';

export default async function Home() {
  const ua = (await headers()).get('user-agent');
  const initialIsMobile = detectMobileFromUA(ua);
  return (
    <BreakpointProvider initialIsMobile={initialIsMobile}>
      <Page />
    </BreakpointProvider>
  );
}
```

### Step 1.8: Verify

- [ ] **Step 1: Run dev server**

```bash
pnpm dev
```

Visit `http://localhost:3000`. Expect:
- Pure black background.
- Faint scanlines (look closely).
- Faint grain / noise.
- A barely-perceptible vertical scan beam sweeping every 8s.
- Green text reading "foundation laid · sections coming" in JetBrains Mono.

Resize the browser narrow to 390px wide and back. The Page component is the same; only later tasks will branch.

- [ ] **Step 2: Type check**

```bash
pnpm typecheck
```

Expected: 0 errors.

- [ ] **Step 3: Lint**

```bash
pnpm check
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(port): foundation — breakpoint plumbing, CRT layer, tokens, fonts"
```

---

## Task 2: Hero — boot sequence (desktop) and 2-CTA (mobile)

**Files:**
- Create: `components/shared/Hero.tsx`
- Modify: `components/Page.tsx`

**Mockup reference:**
- Desktop: open `prototype/Portfolio.html`, find `<section id="bio" class="hero">`. Copy the boot-sequence text verbatim.
- Mobile: open `prototype/Portfolio.mobile.html`, find `<section class="hero">`. Copy the name + two CTAs.

- [ ] **Step 1: Create `components/shared/Hero.tsx`**

```tsx
// components/shared/Hero.tsx
'use client';

import { useBreakpoint } from '@/lib/use-breakpoint';

export function Hero() {
  const { isMobile } = useBreakpoint();
  if (isMobile) return <MobileHero />;
  return <DesktopHero />;
}

function DesktopHero() {
  return (
    <section id="bio" className="hero hero--desktop">
      <pre className="hero__boot">
{`[SYSTEM BOOT SEQUENCE INITIATED]

Initializing kernel modules... OK
Mounting local filesystems... OK
Starting network services... OK
Loading security protocols... [ENCRYPTED]
Welcome to DEV_OS v2.0.4-stable [user: erik]

erik@portfolio:~$ run bio.exe --verbose

>The Matrix has you..`}
      </pre>
      <h1 className="hero__headline">SYSTEM FAILURE</h1>
    </section>
  );
}

function MobileHero() {
  return (
    <section className="hero hero--mobile">
      <h1 className="hero__name">Erik Henrique Alves Cunha</h1>
      <p className="hero__tagline">
        Senior Frontend Engineer · 8+ yrs building regulated systems · fintech (PCI-DSS), healthcare, global e-commerce
      </p>
      <p className="hero__meta">
        <span>LOC: Malta</span>
        <span>NOR: Betsson (N/PT/FR/IE)</span>
      </p>
      <div className="hero__ctas">
        <a className="hero__cta hero__cta--primary" href="mailto:erikhenriquealvescunha@gmail.com?subject=Let's%20talk">
          EXEC HIRE
        </a>
        <a className="hero__cta hero__cta--secondary" href="https://github.com/erikunha" target="_blank" rel="noreferrer">
          GITHUB ↗
        </a>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Add hero styles to `app/globals.css`**

Append to `app/globals.css`:

```css
/* ─── Hero ─────────────────────────────────────────── */

.hero {
  padding: 32px 0;
  border-bottom: 1px solid var(--border);
}

.hero--desktop .hero__boot {
  color: var(--fg);
  font-size: 14px;
  line-height: 1.6;
  white-space: pre;
  margin-bottom: 24px;
}

.hero__headline {
  font-family: var(--font-display);
  font-weight: 900;
  font-size: 72px;
  line-height: 0.9;
  color: var(--signal);
  letter-spacing: -0.04em;
  margin-top: 16px;
}

@media (max-width: 768px) {
  .hero__headline { font-size: 40px; }
}

.hero--mobile .hero__name {
  font-family: var(--font-mono);
  font-weight: 700;
  font-size: 28px;
  color: var(--signal);
  margin-bottom: 8px;
}

.hero__tagline {
  color: var(--fg);
  margin-bottom: 12px;
}

.hero__meta {
  display: flex;
  gap: 16px;
  color: var(--muted);
  font-size: 12px;
  margin-bottom: 24px;
}

.hero__ctas {
  display: flex;
  gap: 12px;
}

.hero__cta {
  flex: 1;
  text-align: center;
  padding: 14px;
  border: 1px solid var(--border);
  font-weight: 700;
  letter-spacing: 0.04em;
}

.hero__cta--primary {
  background: var(--signal);
  color: var(--bg);
}

.hero__cta--secondary {
  color: var(--signal);
}
```

- [ ] **Step 3: Wire `<Hero/>` into `<Page/>`**

Modify `components/Page.tsx`:

```tsx
// components/Page.tsx
'use client';

import { CRTOverlay } from './responsive/CRTOverlay';
import { Hero } from './shared/Hero';

export function Page() {
  return (
    <>
      <CRTOverlay />
      <main className="page">
        <Hero />
      </main>
    </>
  );
}
```

- [ ] **Step 4: Verify at desktop**

Visit `http://localhost:3000` at 1440 width. Compare against `prototype/Portfolio.html` (1440). The boot sequence block and `SYSTEM FAILURE` headline should match.

- [ ] **Step 5: Verify at mobile**

Resize browser to 390 width. Compare against `prototype/Portfolio.mobile.html`. The hero should swap to the name + tagline + two CTAs layout. `EXEC HIRE` should be a filled green button, `GITHUB ↗` should be outlined.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(hero): port boot-sequence (desktop) and 2-CTA (mobile) heroes"
```

---

## Task 3: Module wrapper

**Files:**
- Create: `components/responsive/Module.tsx`
- Modify: `components/Page.tsx` (add a single test module to verify), `app/globals.css` (module styles)

- [ ] **Step 1: Create `components/responsive/Module.tsx`**

```tsx
// components/responsive/Module.tsx
'use client';

import { useState, type ReactNode } from 'react';
import { useBreakpoint } from '@/lib/use-breakpoint';

export type ModuleProps = {
  id: string;
  header: string;
  defaultOpen?: boolean;
  children: ReactNode;
};

export function Module({ id, header, defaultOpen = true, children }: ModuleProps) {
  const { isMobile } = useBreakpoint();

  if (!isMobile) {
    return (
      <section id={id} className="module module--desktop">
        <h2 className="module__header">{header}</h2>
        <div className="module__body">{children}</div>
      </section>
    );
  }

  return <MobileModule id={id} header={header} defaultOpen={defaultOpen}>{children}</MobileModule>;
}

function MobileModule({ id, header, defaultOpen, children }: ModuleProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section id={id} className="module module--mobile" data-open={open}>
      <button
        className="module__toggle"
        aria-expanded={open}
        aria-controls={`${id}-body`}
        onClick={() => setOpen((o) => !o)}
        type="button"
      >
        <span>{header}</span>
        <span className="module__chevron" aria-hidden>{open ? '▾' : '▸'}</span>
      </button>
      <div className="module__body" id={`${id}-body`} hidden={!open}>
        {children}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Add module styles**

Append to `app/globals.css`:

```css
/* ─── Module ─────────────────────────────────────────── */

.module {
  border-bottom: 1px solid var(--border);
  padding: 24px 0;
}

.module__header {
  font-size: 14px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--signal);
  margin-bottom: 16px;
  letter-spacing: 0.04em;
}

.module__body {
  color: var(--fg);
}

.module--mobile .module__toggle {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  padding: 0;
  border: none;
  background: none;
  color: var(--signal);
  font-family: var(--font-mono);
  font-size: 14px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  text-align: left;
}

.module--mobile .module__chevron {
  color: var(--signal);
  font-size: 16px;
}

.module--mobile[data-open='false'] .module__body {
  display: none;
}

.module--mobile[data-open='true'] .module__body {
  padding-top: 16px;
}
```

- [ ] **Step 3: Add a placeholder Module to `<Page/>` for verification**

Modify `components/Page.tsx`:

```tsx
// components/Page.tsx
'use client';

import { CRTOverlay } from './responsive/CRTOverlay';
import { Hero } from './shared/Hero';
import { Module } from './responsive/Module';

export function Page() {
  return (
    <>
      <CRTOverlay />
      <main className="page">
        <Hero />
        <Module id="sec-test" header="MODULE WRAPPER TEST">
          <p>If you see this on desktop it's a plain section. On mobile, the header toggles open/closed.</p>
        </Module>
      </main>
    </>
  );
}
```

- [ ] **Step 4: Verify**

- At 1440: a plain section appears under the hero with header `MODULE WRAPPER TEST` and the body text.
- At 390: the header has a `▾` glyph at the right. Click it. Body hides, glyph swaps to `▸`. Click again, body returns.
- Reload at 390 with the URL `http://localhost:3000` and confirm the body is open by default.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(module): breakpoint-aware section wrapper with mobile accordion"
```

---

## Task 4a: Static sections — Batch A (small)

Each of these is a one-file component that wraps `<Module>` around verbatim content from `prototype/Portfolio.html`. **For each:** locate the matching section in the mockup, copy its text content into the JSX. Wrap stat lines, ASCII tables, etc. in `<pre>` where the mockup uses preserved whitespace.

**Sections in this batch:**
1. ReadmeSection (`sec-readme`, header `CAT README.MD`)
2. ManPageSection (`sec-man-page`, header `MAN ERIK(1)`)
3. NowSection (`sec-now`, header `CAT ~/.NOW`)
4. NpmStackSection (`sec-npm-stack`, header `NPM LIST --GLOBAL`)
5. SysHealthSection (`sec-sys-health`, header `SYS_HEALTH_MONITOR`)
6. LivePerfSection (`sec-live-perf`, header `LIVE_PERF.JSON`)
7. VisaSection (`sec-visa`, header `CAT ~/.VISA`)
8. CredentialsSection (`sec-credentials`, header `CAT ~/.CREDENTIALS`)
9. CommunitySection (`sec-community`, header `CAT ~/.COMMUNITY`)

**Files:** create one file per section under `components/shared/`. Modify `components/Page.tsx` to import and render them in order.

### Generic section component shape

Every section in this batch follows this shape. **Use this template, then paste the section-specific content into the children**:

```tsx
// components/shared/SectionNameSection.tsx
'use client';

import { Module } from '../responsive/Module';

export function SectionNameSection() {
  return (
    <Module id="sec-xxx" header="HEADER FROM MOCKUP">
      {/* paste verbatim content from prototype/Portfolio.html section xxx */}
    </Module>
  );
}
```

- [ ] **Step 1: Create `ReadmeSection.tsx`**

Open `prototype/Portfolio.html`. Search for `CAT README.MD`. Copy the entire section content (the line-numbered markdown + the `with-retry.ts` code snippet) into `<pre>` blocks. Suggested structure:

```tsx
// components/shared/ReadmeSection.tsx
'use client';

import { Module } from '../responsive/Module';

export function ReadmeSection() {
  return (
    <Module id="sec-readme" header="CAT README.MD">
      <pre className="readme-md">
{`# Erik Henrique Alves Cunha — Senior Software Engineer
Brazilian 8+ years building frontend systems for regulated, high-traffic platforms in fintech (PCI-DSS), healthcare, and global e-commerce.
## Core Stack
- Angular · React · Next.js · TypeScript · RxJS · NgRx · Redux · Node.js · AWS
- Micro-frontends (MFE) · Nx monorepos ·  Web Core Vitals · Web Components · UX/UI · User Journeys
## Operating Principles
- Performance-first: LCP, TBT, bundle reduction in production budgets.
- A11y & compliance: WCAG 2.1 AA, ARIA, PCI-DSS-grade safeguards.
## Current Status
Open to [Senior / Staff / Principal] roles or high-stakes contracts · remote-first · EU/US/CA · English C1.`}
      </pre>

      <h3 className="code-snippet__title">$ cat src/lib/with-retry.ts <a href="#" className="code-snippet__link">// view full repo →</a></h3>
      <pre className="code-snippet">
{`// retry an RxJS stream with exponential backoff + jitter — used in
// the cashier's deposit polling loop. signals abort on permanent 4xx.
export function withRetry<T>(
  { max = 5, base = 300, isFatal }: RetryOpts,
): MonoTypeOperatorFunction<T> {
  return retry({
    count: max,
    delay: (err, attempt) => {
      if (isFatal?.(err)) throw err;
      const wait = base * 2**attempt + Math.random() * base;
      return timer(wait);
    },
  });
}`}
      </pre>
    </Module>
  );
}
```

- [ ] **Step 2: Create `ManPageSection.tsx`**

Open `prototype/Portfolio.html`, find `MAN ERIK(1)`. The content is a faux-manpage with NAME, SYNOPSIS, DESCRIPTION, OPTIONS, EXAMPLES, KNOWN BUGS, AUTHOR, SEE ALSO sections.

```tsx
// components/shared/ManPageSection.tsx
'use client';

import { Module } from '../responsive/Module';

export function ManPageSection() {
  return (
    <Module id="sec-man-page" header="MAN ERIK(1)">
      <pre className="manpage">
{`ERIK(1)                      User Commands                      ERIK(1)

NAME
       erik — senior software engineer, frontend specialization

SYNOPSIS
       erik [--seniority SENIOR|STAFF|PRINCIPAL]
            [--track IC|LEAD]
            [--domain PAYMENTS|HEALTHCARE|AI-TOOLING|E-COMMERCE]
            [--region WORLDWIDE] [--relocation]
            [--contract|--ft]
            [<target-stack> ...]

DESCRIPTION
       Senior software engineer, 8+ years. Started full-stack,
       evolved into frontend architecture. Shipped production
       systems across payments (PCI-DSS), healthcare, banking,
       e-commerce, and ed-tech — Angular, React/Next.js, and
       Stencil micro-frontends powering €1B+ in revenue.
       Ranges across web, mobile (Ionic), and desktop (Electron).
       Recently built a 12-agent AI engineering platform in
       production. Currently embedded at Betsson (Malta, EU).
       Senior/Staff/Principal track.

OPTIONS
       --seniority   Senior through Principal
       --track       Individual contributor or technical lead
       --domain      Strongest in regulated frontends (payments,
                     healthcare, AI tooling); open to adjacent
       --region      Worldwide; remote-first
       --relocation  Open to relocating for the right role
       --regulated   Specialty: PCI-DSS, healthcare, banking
       --contract    Open to fixed-term or freelance
       --ft          Open to full-time
       --hire        Initiates handshake. See CONTACT.

EXAMPLES
       $ erik --seniority STAFF --domain PAYMENTS --ft
       $ erik --track LEAD --domain AI-TOOLING --ft
       $ erik --seniority PRINCIPAL --region WORLDWIDE --relocation
       $ erik --contract --stack "TypeScript, micro-frontends, AI"

KNOWN BUGS
       - Occasionally rewrites a working component for clarity.
       - Will not stop talking about bundle size.
       - Sometimes ships the test before the feature.

AUTHOR
       Written by Erik Henrique Alves Cunha.
       Report bugs to: erikhenriquealvescunha@gmail.com

SEE ALSO
       cv(1), github(1), linkedin(1), calendar(1)

v8.0                            2026-05-13                            ERIK(1)`}
      </pre>
    </Module>
  );
}
```

- [ ] **Step 3: Create `NowSection.tsx`**

```tsx
// components/shared/NowSection.tsx
'use client';

import { Module } from '../responsive/Module';

export function NowSection() {
  return (
    <Module id="sec-now" header="CAT ~/.NOW">
      <dl className="now-list">
        <dt>Currently</dt>
        <dd>shipping multi-currency settlement · Betsson cashier (PCI-DSS)</dd>
        <dt>Reading</dt>
        <dd>Designing Data-Intensive Applications · re-read</dd>
        <dt>Building</dt>
        <dd>this portfolio. you are looking at it.</dd>
        <dt>Listening</dt>
        <dd>a lot of guitar. compilers by day, six strings by night.</dd>
        <dt>Updated</dt>
        <dd>2026-05-13</dd>
      </dl>
    </Module>
  );
}
```

- [ ] **Step 4: Create `NpmStackSection.tsx`**

```tsx
// components/shared/NpmStackSection.tsx
'use client';

import { Module } from '../responsive/Module';

const STACK = ['ANGULAR', 'REACT', 'NEXT.JS', 'TYPESCRIPT', 'NODE.JS', 'RXJS', 'NGRX', 'DOCKER', 'AWS', 'GH_ACTIONS', 'EXPRESS', 'JEST'];

export function NpmStackSection() {
  return (
    <Module id="sec-npm-stack" header="NPM LIST --GLOBAL">
      <ul className="npm-stack">
        {STACK.map((s) => <li key={s}>{s}</li>)}
      </ul>
    </Module>
  );
}
```

- [ ] **Step 5: Create `SysHealthSection.tsx`**

```tsx
// components/shared/SysHealthSection.tsx
'use client';

import { Module } from '../responsive/Module';

export function SysHealthSection() {
  return (
    <Module id="sec-sys-health" header="SYS_HEALTH_MONITOR">
      <dl className="sys-health">
        <div><dt>EXPERIENCE</dt><dd>8+ YRS</dd></div>
        <div><dt>TX VOLUME / YR</dt><dd>40M+</dd></div>
        <div><dt>A11Y SCORE</dt><dd>~100 / 100</dd></div>
        <div><dt>PERF DELTA</dt><dd>-33% JS / -98% CSS</dd></div>
      </dl>
    </Module>
  );
}
```

- [ ] **Step 6: Create `LivePerfSection.tsx`**

```tsx
// components/shared/LivePerfSection.tsx
'use client';

import { Module } from '../responsive/Module';

export function LivePerfSection() {
  return (
    <Module id="sec-live-perf" header="LIVE_PERF.JSON">
      <dl className="live-perf">
        <div><dt>PERFORMANCE</dt><dd>100/100</dd></div>
        <div><dt>ACCESSIBILITY</dt><dd>100/100</dd></div>
        <div><dt>BEST PRACTICES</dt><dd>98/100</dd></div>
        <div><dt>SEO</dt><dd>100/100</dd></div>
      </dl>
      <p className="live-perf__meta">SOURCE: PageSpeed Insights · cached daily</p>
      <p className="live-perf__meta">LAST_CHECK: 2026-05-14 20:32 UTC</p>
    </Module>
  );
}
```

- [ ] **Step 7: Create `VisaSection.tsx`**

```tsx
// components/shared/VisaSection.tsx
'use client';

import { Module } from '../responsive/Module';

export function VisaSection() {
  return (
    <Module id="sec-visa" header="CAT ~/.VISA">
      <pre className="visa-table">
{`JURISDICTION   STATUS                EVIDENCE
================================================================
EU (MALTA)     WORK_AUTHORIZED       active employer (Betsson)
CA             CO_OP_GRADUATE        CICCC, Vancouver · 2023-2024
BR             CITIZEN               native
WORLDWIDE      OPEN_TO_RELOCATION    considering opportunities

// quadrilingual: PT (native) · EN (C1) · FR (A2) · ES (A2)`}
      </pre>
    </Module>
  );
}
```

- [ ] **Step 8: Create `CredentialsSection.tsx`**

```tsx
// components/shared/CredentialsSection.tsx
'use client';

import { Module } from '../responsive/Module';

export function CredentialsSection() {
  return (
    <Module id="sec-credentials" header="CAT ~/.CREDENTIALS">
      <pre className="credentials">
{`$ cat ~/.credentials

ANGULAR_DEV     CERTIFIED       Alain Chautard (GDE Angular) · 2024
ENGLISH         IELTS_C1        band 6.5 (speaking & listening) · 2023
INTL_DEGREE     WES_VERIFIED    World Education Services · 2022`}
      </pre>
    </Module>
  );
}
```

- [ ] **Step 9: Create `CommunitySection.tsx`**

```tsx
// components/shared/CommunitySection.tsx
'use client';

import { Module } from '../responsive/Module';

export function CommunitySection() {
  return (
    <Module id="sec-community" header="CAT ~/.COMMUNITY">
      <h3 className="community__role">DEVOPSDAYS_CAMPINAS · 2024 · ORGANIZER</h3>
      <p>curated 10+ talks across DevOps, cloud infra, platform engineering, and architecture.</p>
      <p>ran the full speaker cycle: CFP launch → review → selection → program design → day-of → wrap.</p>
      <p>coordinated with speakers, sponsors, and co-organizers end-to-end.</p>
      <p className="community__status">&gt;status: open to CFP submissions for 2026 · open to volunteer / organizer roles.</p>
    </Module>
  );
}
```

- [ ] **Step 10: Add Batch A styles to `app/globals.css`**

```css
/* ─── Batch A sections ─────────────────────────────────────────── */

.readme-md, .manpage, .visa-table, .credentials, .code-snippet {
  font-size: 13px;
  line-height: 1.6;
  color: var(--fg);
  overflow-x: auto;
}

.code-snippet__title {
  margin-top: 16px;
  font-size: 13px;
  color: var(--signal);
}

.code-snippet__link {
  color: var(--muted);
  font-size: 12px;
  margin-left: 8px;
}

.now-list, .sys-health, .live-perf {
  display: grid;
  gap: 8px;
}

.now-list dt, .sys-health dt, .live-perf dt {
  color: var(--muted);
  font-size: 12px;
  text-transform: uppercase;
}

.now-list dd, .sys-health dd, .live-perf dd {
  color: var(--fg);
  margin: 0 0 8px 0;
}

.sys-health, .live-perf {
  grid-template-columns: repeat(2, 1fr);
}

@media (max-width: 768px) {
  .sys-health, .live-perf { grid-template-columns: 1fr; }
}

.live-perf__meta {
  font-size: 11px;
  color: var(--muted);
  margin: 4px 0 0;
}

.npm-stack {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  color: var(--signal);
  font-size: 13px;
}

@media (max-width: 768px) {
  .npm-stack { grid-template-columns: repeat(2, 1fr); }
}

.community__role {
  color: var(--signal);
  font-size: 14px;
  margin-bottom: 12px;
}

.community__status {
  color: var(--muted);
  margin-top: 12px;
}
```

- [ ] **Step 11: Wire all Batch A sections into `<Page/>`**

Modify `components/Page.tsx`:

```tsx
'use client';

import { CRTOverlay } from './responsive/CRTOverlay';
import { Hero } from './shared/Hero';
import { ReadmeSection } from './shared/ReadmeSection';
import { ManPageSection } from './shared/ManPageSection';
import { NowSection } from './shared/NowSection';
import { NpmStackSection } from './shared/NpmStackSection';
import { SysHealthSection } from './shared/SysHealthSection';
import { LivePerfSection } from './shared/LivePerfSection';
import { VisaSection } from './shared/VisaSection';
import { CredentialsSection } from './shared/CredentialsSection';
import { CommunitySection } from './shared/CommunitySection';

export function Page() {
  return (
    <>
      <CRTOverlay />
      <main className="page">
        <Hero />
        <ReadmeSection />
        <ManPageSection />
        <NowSection />
        <NpmStackSection />
        <SysHealthSection />
        <LivePerfSection />
        <VisaSection />
        <CredentialsSection />
        <CommunitySection />
      </main>
    </>
  );
}
```

(The order will be finalized in the final-sweep task. For now Batch A renders early so you can verify them.)

- [ ] **Step 12: Verify**

Open `http://localhost:3000` next to `prototype/Portfolio.html` at 1440. Scroll through each section. Diff content. Repeat at 390 with `Portfolio.mobile.html`.

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "feat(sections): batch A — readme, manpage, now, npm, sys_health, live_perf, visa, credentials, community"
```

---

## Task 4b: Static sections — Batch B (narrative)

**Sections in this batch:**
1. HottestTakesSection (`sec-hottest-takes`)
2. ResponsibilitiesSection (`sec-responsibilities`)
3. UnknownsSection (`sec-unknowns`)
4. GuitarSection (`sec-guitar`)

Same template pattern as Batch A — open `prototype/Portfolio.html`, locate the section by header, copy text verbatim into the JSX.

- [ ] **Step 1: Create `HottestTakesSection.tsx`**

8 numbered takes, each with a category label (ARCHITECTURE, MFE, TESTING, AI, SIGNAL, DX, DS, PROCESS) and a multi-paragraph body. Structure:

```tsx
// components/shared/HottestTakesSection.tsx
'use client';

import { Module } from '../responsive/Module';

type Take = { num: string; category: string; thesis: string; body: string };

const TAKES: Take[] = [
  {
    num: '01.',
    category: 'ARCHITECTURE',
    thesis: 'Angular is the right default for any regulated platform in 2026.',
    body: `React's ecosystem moves faster but is less audit-friendly. NgRx + RxJS give you serializable state by default — that matters when a regulator subpoenas your deposit flow. The "Angular is slow" argument is a 2018 take that survived past its expiration date.`,
  },
  {
    num: '02.',
    category: 'MFE',
    thesis: 'Micro-frontends are a contract problem, not a routing problem.',
    body: `Most teams adopt them for Conway-shaped reasons (we have 4 teams, we want 4 apps) and pay the wrong tax. The hard part is event contracts and shared auth/state — not Module Federation config. If your MFEs can't be deployed independently without a runtime version matrix, you built a distributed monolith.`,
  },
  {
    num: '03.',
    category: 'TESTING',
    thesis: 'The testing pyramid is wrong for B2C frontends.',
    body: `Inverted pyramid — heavy E2E, lean units, near-zero shallow snapshots — wins when UX is the product. Unit tests catch refactors; E2E catches what the customer actually sees. On the cashier, a single Playwright trace replaces 40 brittle component tests and tells me whether revenue is at risk.`,
  },
  {
    num: '04.',
    category: 'AI',
    thesis: 'AI code review is already better than 80% of human reviewers for style and local correctness.',
    body: `The remaining 20% — cross-system reasoning, "why is this here", judging trade-offs against constraints reviewers were never told about — is exactly what senior humans are for. Hiring should optimize for that, not for catching missing semicolons your CI also caught.`,
  },
  {
    num: '05.',
    category: 'SIGNAL',
    thesis: 'Bundle size is a leading indicator of team health, not a tech metric.',
    body: `A team that ignores the 1.4MB main chunk also ignores the dead route, the four versions of lodash, and the on-call rotation. The number itself doesn't cost much; what it predicts about discipline does. -33% JS at Canon Medical was the cheapest culture audit I've ever run.`,
  },
  {
    num: '06.',
    category: 'DX',
    thesis: `RxJS isn't harder than promises. It's harder than the wrong abstraction you reach for instead.`,
    body: `Most "just use async/await" code is a hand-rolled, buggy reimplementation of switchMap + retry + takeUntil. Pay the learning curve once; stop reinventing cancellation, backpressure, and race conditions per-feature for the rest of your career.`,
  },
  {
    num: '07.',
    category: 'DS',
    thesis: 'Framework-agnostic design systems lose unless the contract is shipping, not theory.',
    body: `Web Components only pay off when you have >1 framework consuming them in production. Otherwise you bought distribution overhead to solve a problem you don't have. Stencil at Betsson works because Angular, React, and Ember are all actually downstream — not because someone read a blog post.`,
  },
  {
    num: '08.',
    category: 'PROCESS',
    thesis: 'If your PRs require a meeting to merge, your architecture is unwritten.',
    body: `Architecture lives in the code review template, the ADR folder, and the linter config — not in a Confluence page nobody opens. The 35-page architecture system at Betsson cut onboarding -40% because it replaced "ask Erik" with "ask the doc". The doc doesn't go on PTO.`,
  },
];

export function HottestTakesSection() {
  return (
    <Module id="sec-hottest-takes" header="CAT ~/HOTTEST_TAKES.MD">
      <p className="takes__preamble">$ cat ~/hottest_takes.md // opinions i'll defend in a whiteboard interview</p>
      <ol className="takes" start={1}>
        {TAKES.map((t) => (
          <li key={t.num} className="take">
            <div className="take__header">
              <span className="take__num">{t.num}</span>
              <span className="take__category">{t.category}</span>
              <span className="take__thesis">{t.thesis}</span>
            </div>
            <p className="take__body">{t.body}</p>
          </li>
        ))}
      </ol>
      <p className="takes__footer">&gt;willing to be wrong on any of these. willing to argue first.</p>
    </Module>
  );
}
```

- [ ] **Step 2: Create `ResponsibilitiesSection.tsx`**

```tsx
// components/shared/ResponsibilitiesSection.tsx
'use client';

import { Module } from '../responsive/Module';

export function ResponsibilitiesSection() {
  return (
    <Module id="sec-responsibilities" header="LS -LA ~/RESPONSIBILITIES">
      <pre className="responsibilities">
{`$ ls -la ~/responsibilities  // role boundaries, in unix terms

drwxr-xr-x  erik    core    frontend-architecture
drwxr-xr-x  erik    core    performance-optimization
drwxr-x---  erik    core    security-mindset
drwxrwxrwx  erik    team    mentoring-juniors
-rw-r--r--  erik    team    written-knowledge-system
drwxr-xr-x  erik    team    ai-tooling
-rwx------  erik    self    taste-and-judgment

drwxr-xr-x   i own it, you can read it, you can run against it
drwxrwxrwx   explicitly shared — please write here too
drwxr-x---   owned, run only by trusted group (security, compliance)
-rwx------   not delegable; this is the one i bring to the room`}
      </pre>
    </Module>
  );
}
```

- [ ] **Step 3: Create `UnknownsSection.tsx`**

```tsx
// components/shared/UnknownsSection.tsx
'use client';

import { Module } from '../responsive/Module';

export function UnknownsSection() {
  return (
    <Module id="sec-unknowns" header="CAT ~/.UNKNOWNS">
      <pre className="unknowns">
{`$ cat ~/.unknowns

# things i'm actively learning

- knowing when AI-assisted engineering is a force multiplier vs a debt accelerator
  (built the 12-agent system at betsson. also watched what it produces
  when nobody reads the diffs.)

- writing specs that someone else can ship without me in the room
  (the 35-page knowledge system was a start. specs are harder.
  "what i meant" is not what i wrote.)

- deciding what NOT to ship
  (the feature that doesn't ship is the one that doesn't cause an incident.
  learning to advocate for cuts.)

- opening a 1:1 with something other than "so, how's your week?"
  (the icebreaker question IS the conversation.
  learning to ask better ones.)

- learning to be wrong in public without making it the story
  (engineers who admit mistakes loudly are usually still making it about them.
  fix it, move on, stop performing the apology.)

# things i've chosen not to specialize in (yet)

- mobile native (ios/android beyond ionic)
  (shipped ionic for 5 OSes once. that was enough.)

- ML model training / research
  (applied-AI consumer, not researcher. the agents are the layer i own.)

- chasing the framework wars
  (i've shipped the same architecture pattern in 4 different syntaxes.
  the syntax was never the hard part.)

> open to roles that push me harder on any of the above.`}
      </pre>
    </Module>
  );
}
```

- [ ] **Step 4: Create `GuitarSection.tsx`**

```tsx
// components/shared/GuitarSection.tsx
'use client';

import { Module } from '../responsive/Module';

export function GuitarSection() {
  return (
    <Module id="sec-guitar" header="CAT ~/.GUITAR_RIG">
      <pre className="guitar">
{`$ cat ~/.guitar_rig
# updated 2026-05-13

GUITAR_MAIN       Gretsch G5655TG · Electromatic Center Block Jr · Bigsby
GUITAR_ALT        Martin acoustic
AMP               modeled · no tube in the chain
PEDALBOARD        Line 6 HX Stomp XL · amp + effects modeling

INFLUENCES in order:
  1. John Mayer
  2. Mateus Asato
  3. Jimmy Page
  4. John Frusciante
  5. Iron Maiden's three (Murray · Smith · Gers)

STYLE             feel / expression over noise · clean tones, lots of space
TUNING            standard E · sometimes drop D · never Eb
PRACTICE          jams, tones, live takes · guitarcam
GIGS              weddings · small venues ·  open mics
NEVER_LEARNED     reading staff notation · tabs only
LATEST_OBSESSION  Coldplay's "Yellow" — the simplicity is the hard part`}
      </pre>
    </Module>
  );
}
```

- [ ] **Step 5: Add Batch B styles to `app/globals.css`**

```css
/* ─── Batch B sections ─────────────────────────────────────────── */

.takes__preamble, .takes__footer {
  color: var(--muted);
  font-size: 12px;
  margin: 8px 0;
}

.takes {
  list-style: none;
  padding: 0;
}

.take {
  padding: 16px 0;
  border-top: 1px solid var(--border);
}

.take__header {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: baseline;
  margin-bottom: 8px;
}

.take__num {
  color: var(--muted);
  font-size: 12px;
}

.take__category {
  background: var(--signal);
  color: var(--bg);
  padding: 2px 6px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.take__thesis {
  color: var(--signal);
  font-weight: 700;
}

.take__body {
  color: var(--fg);
  margin: 0;
}

.responsibilities, .unknowns, .guitar {
  font-size: 13px;
  line-height: 1.6;
  color: var(--fg);
  overflow-x: auto;
}
```

- [ ] **Step 6: Wire Batch B into `<Page/>`**

Add to imports and JSX in `components/Page.tsx` (insert in any order for now; the final-sweep step will reorder):

```tsx
import { HottestTakesSection } from './shared/HottestTakesSection';
import { ResponsibilitiesSection } from './shared/ResponsibilitiesSection';
import { UnknownsSection } from './shared/UnknownsSection';
import { GuitarSection } from './shared/GuitarSection';
```

And render them inside `<main>` after the Batch A list.

- [ ] **Step 7: Verify**

Open at 1440 and 390. Compare each section against the mockup.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(sections): batch B — hottest_takes, responsibilities, unknowns, guitar"
```

---

## Task 5: Stat-heavy sections (PROJECTS, GIT_LOG, PERF_RECEIPTS)

**Files:**
- Create: `components/shared/ProjectsSection.tsx`, `components/shared/GitLogSection.tsx`, `components/shared/PerfReceiptsSection.tsx`
- Modify: `app/globals.css`, `components/Page.tsx`

- [ ] **Step 1: Create `ProjectsSection.tsx`**

Six project tiles, each with: a `drwxr-xr-x` header line, project name, description, stats (volume, revenue, stack).

```tsx
// components/shared/ProjectsSection.tsx
'use client';

import { Module } from '../responsive/Module';

type Project = {
  name: string;
  description: string;
  stats: { label: string; value: string }[];
};

const PROJECTS: Project[] = [
  {
    name: 'PAYMENT_ORCHESTRA',
    description: 'PCI-DSS cashier platform — multi-brand deposit/withdraw orchestration across 15+ regulated markets.',
    stats: [
      { label: 'VOLUME', value: '40M+ TX / YR' },
      { label: 'REVENUE', value: '€1B+ / YR' },
      { label: 'STACK', value: 'ANGULAR / REACT / STENCIL / NGRX' },
    ],
  },
  {
    name: 'CARE_OPS_CONSOLE',
    description: 'Mission-critical hospital operations dashboards — real-time, multi-site, Clean Architecture.',
    stats: [
      { label: 'JS BUNDLE', value: '-33%' },
      { label: 'TTI GAIN', value: '+52%' },
      { label: 'STACK', value: 'ANGULAR / NX / RXJS' },
    ],
  },
  {
    name: 'COMMERCE_EDGE',
    description: 'Nike Brazil & Centauro storefronts — SSR/SSG, micro-frontends, experiment-driven UX.',
    stats: [
      { label: 'REACH', value: '8M+ MAU' },
      { label: 'LOAD TIME', value: '-32%' },
      { label: 'STACK', value: 'NEXT.JS / REACT / TS' },
    ],
  },
  {
    name: 'AI_AGENT_MESH',
    description: '12-agent multi-agent system + orchestration — codegen, review, debugging, architectural validation.',
    stats: [
      { label: 'AGENTS', value: '12 + ORCHESTRATOR' },
      { label: 'SCOPE', value: 'TEAM-WIDE' },
      { label: 'STACK', value: 'CUSTOM TOOLING' },
    ],
  },
  {
    name: 'EDTECH_OMNI',
    description: 'Cross-platform EdTech app — one codebase, five OSes (Android / iOS / Win / macOS / Linux).',
    stats: [
      { label: 'REUSE', value: '~90% LOGIC' },
      { label: 'COST', value: '-80% VS NATIVE' },
      { label: 'STACK', value: 'IONIC / ANGULAR / ELECTRON' },
    ],
  },
  {
    name: 'NIKE_STORES_FINDER',
    description: 'Personal showcase — geolocation + Google Maps Directions, independent system design.',
    stats: [
      { label: 'TYPE', value: 'SHOWCASE' },
      { label: 'APIS', value: 'MAPS / GEOLOCATION' },
      { label: 'STACK', value: 'JS / WEB APIS' },
    ],
  },
];

export function ProjectsSection() {
  return (
    <Module id="sec-projects" header="LS -LA ./PROJECTS">
      <ul className="projects">
        {PROJECTS.map((p) => (
          <li key={p.name} className="project">
            <p className="project__perm">drwxr-xr-x</p>
            <h3 className="project__name">{p.name}</h3>
            <p className="project__desc">{p.description}</p>
            <dl className="project__stats">
              {p.stats.map((s) => (
                <div key={s.label}><dt>{s.label}:</dt><dd>{s.value}</dd></div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </Module>
  );
}
```

- [ ] **Step 2: Create `GitLogSection.tsx`**

The git log block from the mockup is one big monospaced text dump with ASCII graph characters (`*`, `|`). Render verbatim inside `<pre>`. Copy the entire text from `prototype/Portfolio.html`'s git log section.

```tsx
// components/shared/GitLogSection.tsx
'use client';

import { Module } from '../responsive/Module';

export function GitLogSection() {
  return (
    <Module id="sec-git-log" header="GIT LOG ~/CAREER --PRETTY=FULLER --DECORATE --GRAPH">
      <p className="git-log__prompt">erik@portfolio:~$ git log --graph --pretty=fuller --decorate --since="2018-06-01" ~/career</p>
      <pre className="git-log">
{`* commit 7f3a2bc09f8e1d4c2b6a5d3e8c1f2a7b9d4e6c0a (HEAD -> main, tag: v8.0, origin/main)
| Author:     Erik Henrique Alves Cunha <erik@erikunha.com.br>
| AuthorDate: Sat Mar 1 09:42:11 2025 +0100
| Branch:     career/betsson
|
|   feat(career): BETSSON_GROUP · SR FRONTEND ENGINEER · Malta (EU)
|
|   wanted regulated multi-market scale; got 40M+ tx/yr
|   across 15+ jurisdictions on a PCI-DSS payment platform.
|
* commit 4a9e1d886b3f2c7e0a8d5b9c1e6f4a2b3d7e8c01 (tag: v7.0)
| Author:     Erik Henrique Alves Cunha <erik@erikunha.com.br>
| AuthorDate: Mon Apr 17 11:24:00 2023 -0300
| Branch:     career/canon-medical
|
|   feat(career): CANON_MEDICAL_SYSTEMS · SR SOFTWARE ENG (CONSULTING) · Remote (CA)
|
|   mission-critical hospital ops platform; full architectural
|   ownership across multi-site network.
|
* commit cc1cc1ad202300823f5b1e8d9c4a7e2f0b6d8c1a (tag: visa-ca)
| Author:     Erik Henrique Alves Cunha <erik@erikunha.com.br>
| AuthorDate: Wed Aug 30 10:15:33 2023 -0700
| Branch:     education/web-dev-coop
|
|   feat(life): CICCC · WEB DEV CO-OP DIPLOMA · Vancouver, CA
|
|   part-time, concurrent with Canon Medical role.
|   forcing function to relocate and earn CA work authorization.
|
* commit 5b6f0a4c8d9e1b3a7c2f5d8b0a4e6c9f1b3d7a02 (tag: v6.0)
| Author:     Erik Henrique Alves Cunha <erik@erikunha.com.br>
| AuthorDate: Mon Dec 6 16:08:22 2021 -0300
| Branch:     career/grupo-sbf
|
|   feat(career): GRUPO_SBF (NIKE / CENTAURO) · REACT DEVELOPER · São Paulo, BR (remote)
|
|   React at LATAM e-commerce scale (8M+ MAU); institutionalized
|   experiment-driven dev (20+ A/B tests).
|
* commit 3d4e8c1a5b9f2c7e6d3a8b1c4e5f9d2a7b6c0e8d (tag: v5.0)
| Author:     Erik Henrique Alves Cunha <erik@erikunha.com.br>
| AuthorDate: Mon Jan 4 09:00:11 2021 -0300
| Branch:     career/encora
|
|   feat(career): ENCORA (DAITAN GROUP) · FRONTEND ENGINEER · Campinas, BR
|
|   enterprise B2B Angular depth; NgRx in production.
|
* commit 1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a01 (tag: v4.0)
| Author:     Erik Henrique Alves Cunha <erik@erikunha.com.br>
| AuthorDate: Wed Apr 1 13:22:45 2020 -0300
| Branch:     career/zup-itau
|
|   feat(career): ZUP_INNOVATION (ITAÚ) · FRONTEND ENGINEER · Campinas, BR
|
|   first regulated / banking work; Web Components +
|   micro-frontends across multiple banking apps.
|
* commit 9c8b7a6e5d4f3c2b1a0e9d8c7b6a5e4f3d2c1b0a (tag: v3.0)
| Author:     Erik Henrique Alves Cunha <erik@erikunha.com.br>
| AuthorDate: Fri Feb 1 10:30:00 2019 -0300
| Branch:     career/venturus
|
|   feat(career): VENTURUS · MEAN STACK ENGINEER · Campinas, BR
|
|   cut teeth on backend; -97.5% API latency (40s → <1s);
|   Mongo → Postgres migration with custom ETL.
|
* commit 0e0f0a0b0c0d0e0f0a0b0c0d0e0f0a0b0c0d0e0f (tag: v1.0, root-commit)
  Author:     Erik Henrique Alves Cunha <erik@erikunha.com.br>
  AuthorDate: Mon Jun 4 08:00:00 2018 -0300
  Branch:     career/mb-labs

      feat(career): MB_LABS · MOBILE / FULL STACK · Campinas, BR

      first job. shipped 5-OS cross-platform from one
      Ionic + Angular + Electron codebase.

(END) — press q to return to portfolio`}
      </pre>
    </Module>
  );
}
```

- [ ] **Step 3: Create `PerfReceiptsSection.tsx`**

Eight perf-receipt tiles. The first one (`API_LATENCY -97.5%`) is rendered prominently.

```tsx
// components/shared/PerfReceiptsSection.tsx
'use client';

import { Module } from '../responsive/Module';

type Receipt = { metric: string; delta: string; company: string; note: string; hero?: boolean };

const RECEIPTS: Receipt[] = [
  { metric: 'API_LATENCY', delta: '-97.5%', company: '@ VENTURUS', note: '40s → <1s on a reporting endpoint. Query redesign + indexing strategy.', hero: true },
  { metric: 'BUNDLE_CSS', delta: '-98%', company: '@ CANON_MEDICAL', note: 'layout refactor + lazy load.' },
  { metric: 'TTI', delta: '-52%', company: '@ CANON_MEDICAL', note: 'concurrent async + OnPush.' },
  { metric: 'BUNDLE_JS', delta: '-33%', company: '@ CANON_MEDICAL', note: 'code splitting + dynamic imports.' },
  { metric: 'PAGE_LOAD', delta: '-32%', company: '@ GRUPO_SBF', note: 'CWV optimization + image pipeline.' },
  { metric: 'CONVERSION', delta: '+10%', company: '@ GRUPO_SBF', note: '20+ A/B experiments.' },
  { metric: 'DESKTOP_BUILD', delta: '-40%', company: '@ MB_LABS', note: 'Electron consolidation across 5 OS.' },
  { metric: 'ONBOARDING_TIME', delta: '-40%', company: '@ BETSSON_GROUP', note: '35-page architecture knowledge system + diagrams.' },
];

export function PerfReceiptsSection() {
  const [hero, ...rest] = RECEIPTS;
  return (
    <Module id="sec-perf-receipts" header="PERF_RECEIPTS --HARD-NUMBERS">
      <div className="receipt receipt--hero">
        <p className="receipt__metric">{hero.metric}</p>
        <p className="receipt__delta receipt__delta--hero">{hero.delta}</p>
        <p className="receipt__company">{hero.company}</p>
        <p className="receipt__note">{hero.note}</p>
      </div>
      <ul className="receipts">
        {rest.map((r) => (
          <li key={r.metric} className="receipt">
            <p className="receipt__metric">{r.metric}</p>
            <p className="receipt__delta">{r.delta}</p>
            <p className="receipt__company">{r.company}</p>
            <p className="receipt__note">{r.note}</p>
          </li>
        ))}
      </ul>
    </Module>
  );
}
```

- [ ] **Step 4: Add stat-heavy section styles to `app/globals.css`**

```css
/* ─── Stat-heavy sections ─────────────────────────────────────────── */

.projects {
  list-style: none;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

@media (max-width: 768px) {
  .projects { grid-template-columns: 1fr; }
}

.project {
  border: 1px solid var(--border);
  padding: 16px;
}

.project__perm {
  color: var(--muted);
  font-size: 11px;
  margin: 0 0 4px;
}

.project__name {
  color: var(--signal);
  font-size: 16px;
  margin: 0 0 8px;
}

.project__desc {
  color: var(--fg);
  font-size: 13px;
  margin: 0 0 12px;
}

.project__stats {
  margin: 0;
  display: grid;
  gap: 4px;
}

.project__stats div {
  display: flex;
  gap: 8px;
  font-size: 11px;
}

.project__stats dt {
  color: var(--muted);
}

.project__stats dd {
  margin: 0;
  color: var(--signal);
}

.git-log__prompt {
  color: var(--muted);
  font-size: 12px;
  margin: 0 0 8px;
}

.git-log {
  font-size: 12px;
  color: var(--fg);
  overflow-x: auto;
}

.receipt {
  border: 1px solid var(--border);
  padding: 16px;
}

.receipt--hero {
  border-color: var(--signal);
  padding: 24px;
  margin-bottom: 16px;
  text-align: center;
}

.receipt__metric {
  color: var(--muted);
  font-size: 12px;
  margin: 0 0 4px;
}

.receipt__delta {
  color: var(--signal);
  font-size: 32px;
  font-weight: 700;
  margin: 0;
}

.receipt__delta--hero {
  font-size: 80px;
  line-height: 1;
}

@media (max-width: 768px) {
  .receipt__delta--hero { font-size: 56px; }
}

.receipt__company {
  color: var(--muted);
  font-size: 11px;
  margin: 4px 0;
}

.receipt__note {
  color: var(--fg);
  font-size: 12px;
  margin: 0;
}

.receipts {
  list-style: none;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

@media (max-width: 768px) {
  .receipts { grid-template-columns: 1fr; }
}
```

- [ ] **Step 5: Wire stat-heavy sections into `<Page/>`**

Add imports + render after Batch A. The final ordering will be set in Task 10.

- [ ] **Step 6: Verify**

Compare against mockup at 1440 and 390. Pay attention to ASCII graph alignment in `<GitLogSection>` — characters should line up vertically.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(sections): projects, git_log, perf_receipts"
```

---

## Task 6: Mobile chrome — StatusBar + Dock

**Files:**
- Create: `components/responsive/StatusBar.tsx`, `components/responsive/Dock.tsx`
- Modify: `components/Page.tsx`, `app/globals.css`

- [ ] **Step 1: Create `StatusBar.tsx`**

```tsx
// components/responsive/StatusBar.tsx
'use client';

import { useEffect, useState } from 'react';

export function StatusBar() {
  const [time, setTime] = useState(() => fmt(new Date()));

  useEffect(() => {
    setTime(fmt(new Date()));
    const id = setInterval(() => setTime(fmt(new Date())), 15_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="statusbar" role="status" aria-label="device status">
      <div className="statusbar__signal" aria-hidden>
        <span style={{ height: 4 }} />
        <span style={{ height: 7 }} />
        <span style={{ height: 10 }} />
        <span style={{ height: 13, opacity: 0.5 }} />
      </div>
      <div className="statusbar__time">{time}</div>
      <div className="statusbar__right" aria-hidden>
        <span className="statusbar__cell">5G</span>
        <span className="statusbar__battery">
          <span style={{ width: '78%' }} />
        </span>
      </div>
    </div>
  );
}

function fmt(d: Date) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
```

- [ ] **Step 2: Create `Dock.tsx`**

Sticky bottom nav. Clicking any item: ensure target Module is open (set `data-open="true"` on `section#<target>` if present), then smooth-scroll to it.

```tsx
// components/responsive/Dock.tsx
'use client';

const ITEMS = [
  { label: 'HOME', target: 'bio' },
  { label: 'WORK', target: 'sec-projects' },
  { label: 'PERF', target: 'sec-perf-receipts' },
  { label: 'SHELL', target: 'sec-shell' },
  { label: 'HIRE', target: 'sec-contact' },
];

export function Dock() {
  const onJump = (target: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    const el = document.getElementById(target);
    if (!el) return;
    // Force open if it's a module
    if (el.classList.contains('module--mobile')) {
      el.setAttribute('data-open', 'true');
      const toggle = el.querySelector<HTMLButtonElement>('.module__toggle');
      toggle?.setAttribute('aria-expanded', 'true');
      const body = el.querySelector<HTMLDivElement>('.module__body');
      body?.removeAttribute('hidden');
    }
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <nav className="dock" aria-label="primary">
      {ITEMS.map((it) => (
        <a key={it.target} href={`#${it.target}`} onClick={onJump(it.target)}>
          {it.label}
        </a>
      ))}
    </nav>
  );
}
```

- [ ] **Step 3: Add mobile chrome styles**

```css
/* ─── Mobile chrome ─────────────────────────────────────────── */

.statusbar {
  position: sticky;
  top: 0;
  z-index: 110;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 16px;
  height: 28px;
  background: var(--bg);
  border-bottom: 1px solid var(--border);
}

.statusbar__signal {
  display: inline-flex;
  align-items: flex-end;
  gap: 2px;
}

.statusbar__signal span {
  display: block;
  width: 3px;
  background: var(--signal);
}

.statusbar__time {
  color: var(--signal);
  font-size: 12px;
}

.statusbar__right {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.statusbar__cell {
  color: var(--signal);
  font-size: 10px;
}

.statusbar__battery {
  display: inline-block;
  width: 22px;
  height: 11px;
  border: 1px solid var(--signal);
  position: relative;
}

.statusbar__battery span {
  position: absolute;
  inset: 1px auto 1px 1px;
  background: var(--signal);
}

.dock {
  position: sticky;
  bottom: 0;
  z-index: 110;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 0;
  background: var(--bg);
  border-top: 1px solid var(--border);
}

.dock a {
  text-align: center;
  padding: 14px 0;
  color: var(--signal);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  border-right: 1px solid var(--border);
}

.dock a:last-child { border-right: none; }
```

- [ ] **Step 4: Wire StatusBar and Dock into `<Page/>` conditionally on mobile**

Modify `components/Page.tsx`:

```tsx
'use client';

import { useBreakpoint } from '@/lib/use-breakpoint';
import { CRTOverlay } from './responsive/CRTOverlay';
import { StatusBar } from './responsive/StatusBar';
import { Dock } from './responsive/Dock';
import { Hero } from './shared/Hero';
// ...other section imports

export function Page() {
  const { isMobile } = useBreakpoint();
  return (
    <>
      <CRTOverlay />
      {isMobile ? <StatusBar /> : null}
      <main className="page">
        <Hero />
        {/* all sections here */}
      </main>
      {isMobile ? <Dock /> : null}
    </>
  );
}
```

- [ ] **Step 5: Verify**

- At 1440: no status bar, no dock.
- At 390: status bar pinned at top with clock, signal bars, "5G", battery. Dock pinned at bottom with HOME / WORK / PERF / SHELL / HIRE. Click HIRE — page smooth-scrolls to the contact section.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(mobile): status bar + sticky bottom dock with smooth-scroll auto-open"
```

---

## Task 7: Interactive islands — InteractiveShell + ContactForm reskin

**Files:**
- Create: `components/client/InteractiveShell.tsx`, `components/client/ContactForm.tsx`, `components/shared/ShellSection.tsx`, `components/shared/ContactSection.tsx`
- Modify: `components/Page.tsx`, `app/globals.css`

The shell and contact form keep their existing API wiring — `/api/ask` and `/api/contact` — but their UI gets re-skinned to match the mockup.

### Step 7.1: InteractiveShell

- [ ] **Step 1: Create `components/client/InteractiveShell.tsx`**

```tsx
// components/client/InteractiveShell.tsx
'use client';

import { useState } from 'react';

type Line = { kind: 'prompt' | 'output' | 'error'; text: string };

const SESSION_ID = '0xDEADBEEF';

export function InteractiveShell() {
  const [history, setHistory] = useState<Line[]>([
    { kind: 'output', text: 'erik@portfolio · /bin/sh' },
    { kind: 'output', text: `SESSION_ID: ${SESSION_ID}` },
    { kind: 'output', text: 'Connected. Type help to list commands. Try ask "what\'s your strongest project?" for an LLM answer.' },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);

  async function runCommand(cmd: string) {
    setHistory((h) => [...h, { kind: 'prompt', text: `erik@portfolio:~$ ${cmd}` }]);
    setInput('');
    setBusy(true);

    if (cmd.startsWith('ask ')) {
      const question = cmd.slice(4).trim();
      try {
        const res = await fetch('/api/ask', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question }),
        });
        const data = await res.json();
        if (!res.ok) {
          setHistory((h) => [...h, { kind: 'error', text: data?.error ?? `error: HTTP ${res.status}` }]);
        } else {
          setHistory((h) => [...h, { kind: 'output', text: data.answer ?? '(empty response)' }]);
        }
      } catch (err) {
        setHistory((h) => [...h, { kind: 'error', text: `error: ${(err as Error).message}` }]);
      }
    } else {
      setHistory((h) => [...h, ...localCommand(cmd)]);
    }
    setBusy(false);
  }

  return (
    <div className="shell">
      <div className="shell__feed">
        {history.map((l, i) => (
          <p key={i} className={`shell__line shell__line--${l.kind}`}>{l.text}</p>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (input.trim() && !busy) runCommand(input.trim());
        }}
        className="shell__form"
      >
        <span className="shell__prompt">erik@portfolio:~$</span>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={busy}
          autoComplete="off"
          spellCheck={false}
          className="shell__input"
          aria-label="shell command"
        />
      </form>
      <p className="shell__commands">commands: help · whoami · whoami --recursive · ls · cat skills.md · cat ~/.now · contact · face · hire · clear · ask &lt;question&gt;</p>
    </div>
  );
}

function localCommand(cmd: string): Line[] {
  switch (cmd) {
    case 'help':
      return [{ kind: 'output', text: 'commands: help, whoami, whoami --recursive, ls, cat skills.md, cat ~/.now, contact, face, hire, clear, ask <q>' }];
    case 'whoami':
      return [{ kind: 'output', text: 'erik — senior software engineer, frontend specialization' }];
    case 'whoami --recursive':
      return [{ kind: 'output', text: 'erik → engineer → builder → student → curious → 9yo with a guitar' }];
    case 'ls':
      return [{ kind: 'output', text: 'README.md  ~/.now  ~/.guitar_rig  ~/.visa  ~/.unknowns  ~/.community  ~/.credentials  hottest_takes.md  contact' }];
    case 'cat skills.md':
      return [{ kind: 'output', text: 'angular, react, next.js, typescript, node, rxjs, ngrx, web components, ai tooling' }];
    case 'cat ~/.now':
      return [{ kind: 'output', text: 'shipping multi-currency settlement · Betsson cashier (PCI-DSS)' }];
    case 'contact':
    case 'hire':
      return [{ kind: 'output', text: 'mailto: erikhenriquealvescunha@gmail.com' }];
    case 'face':
      return [{ kind: 'output', text: '(•_•) ( •_•)>⌐■-■ (⌐■_■)' }];
    case 'clear':
      return [{ kind: 'output', text: '' }];
    default:
      return [{ kind: 'error', text: `command not found: ${cmd}. type 'help'` }];
  }
}
```

- [ ] **Step 2: Create `components/shared/ShellSection.tsx`**

```tsx
// components/shared/ShellSection.tsx
'use client';

import { Module } from '../responsive/Module';
import { InteractiveShell } from '../client/InteractiveShell';

export function ShellSection() {
  return (
    <Module id="sec-shell" header="./EXEC INTERACTIVE_SHELL">
      <InteractiveShell />
    </Module>
  );
}
```

### Step 7.2: ContactForm

- [ ] **Step 1: Create `components/client/ContactForm.tsx`**

```tsx
// components/client/ContactForm.tsx
'use client';

import { useState } from 'react';

type Status = 'idle' | 'submitting' | 'success' | 'error';

export function ContactForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState<string>('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('submitting');
    setErrorMsg('');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, message }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      }
      setStatus('success');
    } catch (err) {
      setErrorMsg((err as Error).message);
      setStatus('error');
    }
  }

  if (status === 'success') {
    return (
      <div className="contact contact--success">
        <p>EXECUTE_SEND :: SUCCESS</p>
        <p>handshake initiated · expect reply within 48h</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="contact">
      <label className="contact__field">
        <span className="contact__prompt">user@terminal:~$ enter_name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={2}
          maxLength={80}
          autoComplete="name"
          className="contact__input"
        />
      </label>
      <label className="contact__field">
        <span className="contact__prompt">user@terminal:~$ enter_email</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          className="contact__input"
        />
      </label>
      <label className="contact__field">
        <span className="contact__prompt">user@terminal:~$ enter_message</span>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          minLength={10}
          maxLength={2000}
          rows={5}
          className="contact__input contact__input--area"
        />
      </label>
      <button
        type="submit"
        disabled={status === 'submitting'}
        className="contact__send"
      >
        {status === 'submitting' ? 'TRANSMITTING...' : 'EXECUTE_SEND'}
      </button>
      <p className="contact__cursor">{status === 'submitting' ? 'waiting for manual override...' : 'waiting for manual override... _'}</p>
      {status === 'error' && <p className="contact__error">error: {errorMsg}</p>}
    </form>
  );
}
```

- [ ] **Step 2: Create `components/shared/ContactSection.tsx`**

```tsx
// components/shared/ContactSection.tsx
'use client';

import { Module } from '../responsive/Module';
import { ContactForm } from '../client/ContactForm';

export function ContactSection() {
  return (
    <Module id="sec-contact" header="SUDO CONTACT --INIT">
      <ContactForm />
    </Module>
  );
}
```

### Step 7.3: Styles

- [ ] **Step 1: Append shell + contact styles**

```css
/* ─── Shell ─────────────────────────────────────────── */

.shell {
  background: rgba(0, 255, 65, 0.02);
  border: 1px solid var(--border);
  padding: 12px;
  font-size: 13px;
}

.shell__feed {
  margin-bottom: 8px;
}

.shell__line {
  margin: 0;
  white-space: pre-wrap;
}

.shell__line--prompt { color: var(--signal); }
.shell__line--output { color: var(--fg); }
.shell__line--error { color: #ff4040; }

.shell__form {
  display: flex;
  gap: 8px;
  align-items: center;
}

.shell__prompt { color: var(--signal); white-space: nowrap; }

.shell__input {
  flex: 1;
  background: none;
  border: none;
  color: var(--fg);
  font-family: var(--font-mono);
  font-size: 13px;
  outline: none;
}

.shell__commands {
  margin: 8px 0 0;
  color: var(--muted);
  font-size: 11px;
}

/* ─── Contact ─────────────────────────────────────────── */

.contact {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.contact__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.contact__prompt {
  color: var(--signal);
  font-size: 13px;
}

.contact__input {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--fg);
  font-family: var(--font-mono);
  font-size: 13px;
  padding: 8px;
  outline: none;
}

.contact__input--area { resize: vertical; }

.contact__send {
  align-self: flex-start;
  background: var(--signal);
  color: var(--bg);
  border: none;
  padding: 10px 16px;
  font-weight: 700;
  letter-spacing: 0.04em;
  cursor: pointer;
}

.contact__send:disabled { opacity: 0.6; cursor: not-allowed; }

.contact__cursor {
  color: var(--muted);
  font-size: 12px;
  margin: 0;
}

.contact__error {
  color: #ff4040;
  font-size: 12px;
}

.contact--success {
  border: 1px solid var(--signal);
  padding: 16px;
  color: var(--signal);
  text-align: center;
}
```

- [ ] **Step 2: Wire ShellSection and ContactSection into `<Page/>`**

Add the imports and place them in the section list.

### Step 7.4: Verify (manual smoke test)

- [ ] **Step 1: Submit a question to the shell**

Open `http://localhost:3000`, navigate to the shell section, type `ask what is your strongest project` and press Enter. Confirm:
- Input clears.
- A new prompt line appears.
- After a delay, an answer line appears (real Anthropic response).
- No console errors.

- [ ] **Step 2: Submit a contact-form test**

Scroll to the contact section. Fill in name, email, message. Click EXECUTE_SEND. Confirm:
- Button text changes to TRANSMITTING...
- On success: form replaced with green success box reading "EXECUTE_SEND :: SUCCESS / handshake initiated · expect reply within 48h".
- Email arrives at `erikhenriquealvescunha@gmail.com` (check inbox).

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(islands): InteractiveShell + ContactForm reskinned and wired to existing APIs"
```

---

## Task 8: Footer — SESSION_REPORT + NETSTAT shutdown

**Files:**
- Create: `components/shared/Footer.tsx`
- Modify: `components/Page.tsx`, `app/globals.css`

- [ ] **Step 1: Create `components/shared/Footer.tsx`**

```tsx
// components/shared/Footer.tsx
'use client';

import { useEffect, useState } from 'react';

export function Footer() {
  const [uptime, setUptime] = useState('00:00:00');
  const [time, setTime] = useState(() => fmt(new Date()));

  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => {
      const s = Math.floor((Date.now() - start) / 1000);
      setUptime(`${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`);
      setTime(fmt(new Date()));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <footer className="shutdown">
      <p className="shutdown__head">[SYSTEM SHUTDOWN INITIATED]</p>
      <p className="shutdown__head">HALTED AT {time}</p>
      <p className="shutdown__prompt">erik@portfolio:~$ shutdown -h now</p>

      <div className="shutdown__grid">
        <section className="shutdown__panel">
          <header>▌ SESSION_REPORT</header>
          <dl>
            <dt>user</dt><dd>erik@portfolio</dd>
            <dt>uptime</dt><dd>{uptime}</dd>
            <dt>scroll depth</dt><dd>0%</dd>
            <dt>sections seen</dt><dd>1 / 19</dd>
            <dt>commands run</dt><dd>0</dd>
          </dl>
        </section>

        <section className="shutdown__panel">
          <header>▌ NETSTAT -AN</header>
          <pre>{`Proto  State        Endpoint
tcp    ESTABLISHED  github.com/erikunha
tcp    ESTABLISHED  linkedin.com/in/erikunha
tcp    LISTEN       erikhenriquealvescunha@gmail.com
tcp    ESTABLISHED  erikunha.com.br`}</pre>
        </section>
      </div>

      <pre className="shutdown__init">
{`[  0.270] init: switching runlevel to 0
[  0.411] systemd: stopping matrix_rain.daemon ........ OK
[  0.482] systemd: stopping crt_flicker.service ........ OK
[  0.557] kernel: tcp: closing 3 connections ........ OK
[  0.670] systemd: reached target Shutdown.
[  0.771] systemd: reached target Final Step.
[  0.870] kernel: Power down.
[SYSTEM HALTED]
press R to reboot`}
      </pre>

      <p className="shutdown__copyright">© 2026 erik cunha · this session ends here · the work doesn't.</p>
    </footer>
  );
}

function pad(n: number) { return String(n).padStart(2, '0'); }
function fmt(d: Date) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
```

- [ ] **Step 2: Add footer styles**

```css
/* ─── Shutdown footer ─────────────────────────────────────────── */

.shutdown {
  margin-top: 48px;
  padding: 24px 0;
  border-top: 1px solid var(--border);
  font-size: 13px;
  color: var(--fg);
}

.shutdown__head {
  color: var(--signal);
  margin: 0;
}

.shutdown__prompt {
  color: var(--muted);
  margin: 8px 0 16px;
}

.shutdown__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  margin-bottom: 16px;
}

@media (max-width: 768px) {
  .shutdown__grid { grid-template-columns: 1fr; }
}

.shutdown__panel header {
  color: var(--signal);
  margin-bottom: 8px;
}

.shutdown__panel dl {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 4px 16px;
  margin: 0;
}

.shutdown__panel dt { color: var(--muted); }
.shutdown__panel dd { color: var(--fg); margin: 0; }

.shutdown__panel pre {
  margin: 0;
  font-size: 12px;
  overflow-x: auto;
}

.shutdown__init {
  font-size: 12px;
  color: var(--muted);
  margin: 16px 0;
}

.shutdown__copyright {
  color: var(--muted);
  font-size: 11px;
  text-align: center;
  margin-top: 16px;
}
```

- [ ] **Step 3: Wire `<Footer/>` into `<Page/>`**

Place outside `<main>` but inside the fragment, after the section list:

```tsx
<main className="page">...</main>
<Footer />
{isMobile ? <Dock /> : null}
```

- [ ] **Step 4: Verify**

Footer appears at the bottom. Uptime ticks. Both panels visible. Compare against mockup.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(footer): SESSION_REPORT + NETSTAT shutdown sequence"
```

---

## Task 9: Matrix rain (last)

**Files:**
- Create: `components/responsive/MatrixRain.tsx`
- Modify: `components/Page.tsx`

- [ ] **Step 1: Create `components/responsive/MatrixRain.tsx`**

```tsx
// components/responsive/MatrixRain.tsx
'use client';

import { useEffect, useRef } from 'react';

const KATAKANA = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン';
const DIGITS = '0123456789';
const CHARSET = KATAKANA + DIGITS;
const FONT_SIZE = 14;

export function MatrixRain() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;

    let columns = Math.floor(width / FONT_SIZE);
    let drops = new Array(columns).fill(0).map(() => Math.random() * height / FONT_SIZE);

    let rafId = 0;
    let lastDraw = 0;

    const draw = (time: number) => {
      if (time - lastDraw > 50) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = '#00FF41';
        ctx.font = `${FONT_SIZE}px ${getComputedStyle(document.documentElement).getPropertyValue('--font-mono')}`;
        for (let i = 0; i < drops.length; i++) {
          const ch = CHARSET[Math.floor(Math.random() * CHARSET.length)];
          ctx.fillText(ch, i * FONT_SIZE, drops[i] * FONT_SIZE);
          if (drops[i] * FONT_SIZE > height && Math.random() > 0.975) {
            drops[i] = 0;
          }
          drops[i]++;
        }
        lastDraw = time;
      }
      rafId = requestAnimationFrame(draw);
    };

    const onResize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
      columns = Math.floor(width / FONT_SIZE);
      drops = new Array(columns).fill(0).map(() => Math.random() * height / FONT_SIZE);
    };

    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(rafId);
      } else {
        rafId = requestAnimationFrame(draw);
      }
    };

    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVisibility);
    rafId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  );
}
```

- [ ] **Step 2: Wire `<MatrixRain/>` into `<Page/>` before `<CRTOverlay/>`**

```tsx
import { MatrixRain } from './responsive/MatrixRain';

// inside <Page/>:
<MatrixRain />
<CRTOverlay />
{/* ... */}
```

- [ ] **Step 3: Verify**

- Rain falls behind all content in green katakana / digit glyphs.
- Scroll a long page; rain stays anchored to viewport (fixed position).
- Set OS to "Reduce motion": rain doesn't initialize.
- Switch to another browser tab and back: rain doesn't keep painting offscreen.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(rain): matrix rain canvas, RAF-driven, reduced-motion + visibility gates"
```

---

## Task 10: Final sweep — reorder, verify, polish

**Files:**
- Modify: `components/Page.tsx` (final section order)

- [ ] **Step 1: Set canonical section order in `<Page/>`**

```tsx
// components/Page.tsx
'use client';

import { useBreakpoint } from '@/lib/use-breakpoint';
import { MatrixRain } from './responsive/MatrixRain';
import { CRTOverlay } from './responsive/CRTOverlay';
import { StatusBar } from './responsive/StatusBar';
import { Dock } from './responsive/Dock';
import { Hero } from './shared/Hero';
import { ReadmeSection } from './shared/ReadmeSection';
import { ManPageSection } from './shared/ManPageSection';
import { NowSection } from './shared/NowSection';
import { ProjectsSection } from './shared/ProjectsSection';
import { GitLogSection } from './shared/GitLogSection';
import { NpmStackSection } from './shared/NpmStackSection';
import { SysHealthSection } from './shared/SysHealthSection';
import { ShellSection } from './shared/ShellSection';
import { LivePerfSection } from './shared/LivePerfSection';
import { PerfReceiptsSection } from './shared/PerfReceiptsSection';
import { GuitarSection } from './shared/GuitarSection';
import { VisaSection } from './shared/VisaSection';
import { CredentialsSection } from './shared/CredentialsSection';
import { CommunitySection } from './shared/CommunitySection';
import { HottestTakesSection } from './shared/HottestTakesSection';
import { ResponsibilitiesSection } from './shared/ResponsibilitiesSection';
import { UnknownsSection } from './shared/UnknownsSection';
import { ContactSection } from './shared/ContactSection';
import { Footer } from './shared/Footer';

export function Page() {
  const { isMobile } = useBreakpoint();
  return (
    <>
      <MatrixRain />
      <CRTOverlay />
      {isMobile ? <StatusBar /> : null}
      <main className="page">
        <Hero />
        <ReadmeSection />
        <ManPageSection />
        <NowSection />
        <ProjectsSection />
        <GitLogSection />
        <NpmStackSection />
        <SysHealthSection />
        <ShellSection />
        <LivePerfSection />
        <PerfReceiptsSection />
        <GuitarSection />
        <VisaSection />
        <CredentialsSection />
        <CommunitySection />
        <HottestTakesSection />
        <ResponsibilitiesSection />
        <UnknownsSection />
        <ContactSection />
      </main>
      <Footer />
      {isMobile ? <Dock /> : null}
    </>
  );
}
```

- [ ] **Step 2: Side-by-side at 1440**

Open `prototype/Portfolio.html` in one window, `http://localhost:3000` in another, both at 1440x900. Scroll both at the same rate. Note any drift:
- Section ordering
- Copy mismatches (wording, punctuation)
- Spacing / typography differences
- Missing or duplicated content

For each drift item: fix it. Do not commit incremental fixes — collect them and commit once at the end of this task.

- [ ] **Step 3: Side-by-side at 390**

Same procedure with `prototype/Portfolio.mobile.html` and the live page at 390x844. Note that the mockup mobile has fewer sections (per spec); the live should have ALL 19 sections rendered as collapsible Modules. Confirm:
- Status bar appears
- Dock appears
- Tap each Module header — collapse / expand works
- Tap each Dock item — scrolls AND auto-opens target module

- [ ] **Step 4: Test reduced-motion**

In macOS: System Settings → Accessibility → Display → Reduce motion. Reload. Verify:
- No matrix rain.
- No flicker, no scan beam.
- Static scanlines + grain + phosphor still visible.

- [ ] **Step 5: Lint and typecheck**

```bash
pnpm typecheck
pnpm check
```

Fix any errors.

- [ ] **Step 6: Commit final state**

```bash
git add -A
git commit -m "feat(port): finalize section order + final sweep against mockup"
```

---

## Self-review checklist

Run this after writing the plan, before handoff:

**Spec coverage:**
- [x] Demolition + mockup preservation (Task 0)
- [x] Breakpoint detection + hook (Task 1.1, 1.2)
- [x] CSS tokens + CRT layer + fonts (Task 1.3, 1.4)
- [x] CRTOverlay + Page skeleton (Task 1.5, 1.6)
- [x] `app/page.tsx` reads UA from headers (Task 1.7)
- [x] Hero — both viewport variants (Task 2)
- [x] Module wrapper (Task 3)
- [x] All 19 sections (Tasks 4a, 4b, 5, 7, plus Hero)
- [x] Mobile chrome (Task 6)
- [x] Interactive shell wired to /api/ask (Task 7.1)
- [x] Contact form wired to /api/contact (Task 7.2)
- [x] Footer with dynamic uptime + NETSTAT (Task 8)
- [x] Matrix rain canvas + reduced-motion gate (Task 9)
- [x] Final sweep against mockup at both viewports (Task 10)

**Placeholder scan:** Every code block contains the full code or explicit "copy verbatim from mockup section X". No "TODO" or "fill in later".

**Type consistency:** `BreakpointProvider`, `useBreakpoint`, and `Module` are used with identical prop names and return shapes across all consumers. `Line` type in InteractiveShell is local. Contact form `Status` type is local.

**Build order:** Demolition first, foundation second, hero third, Module fourth (gates all other sections), then sections in batches, then chrome, then islands, then footer, matrix rain last, final sweep.

---

## Risk reminders during execution

- **ASCII alignment**: any time a `<pre>` block is rendered, verify at 390 width — if it wraps, the alignment breaks. Use `overflow-x: auto` on the parent (already in styles) so the horizontal scroll preserves alignment.
- **Hydration warnings**: if React logs "did not match" during dev, check that `app/page.tsx` reads headers correctly and the initial breakpoint flows through.
- **`/api/ask` rate limit**: the shell will return 429 after several rapid asks. Treat as expected; the error renders inline.
- **Email deliverability**: contact-form success is "POST succeeded" — not "email definitely landed". Manual smoke test in step 7.4.2 is the only verification.
- **Mockup absolute path**: Tasks 0 and the verification protocol reference `<repo-root>/prototype/`. If a different engineer runs this, substitute their absolute repo path. The relative path `prototype/Portfolio.html` from the repo root works in any case.
