# Tailwind v4 Full Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all 52 CSS module files with Tailwind v4 utility classes + `@layer components` for CRT/animations, migrating Style Dictionary tokens to `@theme`, in a single big-bang PR.

**Architecture:** Tailwind v4 via `@tailwindcss/postcss` (PostCSS returns to the stack for this transform only). Brand colors, chrome colors, and glow stops defined in `@theme`; standard Tailwind scale used for spacing, typography, and breakpoints. Complex CSS (CRT scanlines, grain, animations, keyframes) moves to `@layer components` in `app/css/components.css`. All component `.module.css` imports are removed and replaced with utility class strings.

**Tech Stack:** Next.js 16 App Router, Tailwind CSS v4, `@tailwindcss/postcss`, `clsx`, `tailwind-merge`, PostCSS

---

## Token name mapping (ds-* → Tailwind)

These are the resolved values from `design-system/dist/tokens.json`. Reference this table in every component migration task.

| Old CSS var | New Tailwind class / new CSS var | Value |
|---|---|---|
| `--ds-color-signal` | `text-signal` / `bg-signal` / `border-signal` | `#00ff41` |
| `--ds-color-signal-subtle` | `border-signal-subtle` / `bg-signal-subtle` | `rgba(0,255,65,0.40)` |
| `--ds-color-signal-quiet` | `bg-signal-quiet` | `rgba(0,255,65,0.10)` |
| `--ds-color-signal-faint` | `bg-signal-faint` | `rgba(0,255,65,0.12)` |
| `--ds-color-text-body` | `text-text-body` | `#e6ffe6` |
| `--ds-color-text-muted` | `text-text-muted` | `#4ade80` |
| `--ds-color-text-faint` | `text-text-faint` | `#5ae07b` |
| `--ds-color-surface-base` | `bg-surface` | `#000000` |
| `--ds-color-surface-shell` | `bg-surface-shell` | `#050505` |
| `--ds-color-border-default` | `border-border-default` | `rgba(0,255,65,0.20)` |
| `--ds-color-surface-panel` | `var(--color-surface-panel)` in CSS | `transparent` |
| `--ds-color-feedback-error` | `text-error` / `border-error` | `#ff8a8a` |
| `--ds-color-accent-warm` | `text-accent-warm` | `#ffd86b` |
| `--ds-color-accent-cool` | `text-accent-cool` | `#7fe4ff` |
| `--ds-color-highlight-fg` | `text-highlight-fg` | `#000000` |
| `--ds-font-family-mono` | `font-mono` | JetBrains Mono |
| `--ds-font-size-2xs` | `text-[10px]` | 10px |
| `--ds-font-size-xs` | `text-xs` (Tailwind default 12px) | 10px→use `text-[10px]` |
| `--ds-font-size-sm` | `text-xs` | 12px |
| `--ds-font-size-body` | `text-sm` | 14px |
| `--ds-font-size-md` | `text-base` | 16px |
| `--ds-font-size-lg` | `text-2xl` | 24px |
| `--ds-font-size-heading-sm` | `text-2xl` | use `text-[size]` arbitrary |
| `--ds-font-size-heading-md` | `text-3xl` or `text-[32px]` | 32px |
| `--ds-font-size-heading-xl` | `text-[64px]` | 64px |
| `var(--ds-duration-base)` | `duration-200` | 200ms default |
| `var(--ds-duration-fast)` | `duration-150` | 150ms default |
| `var(--ds-ease-out)` | `ease-out` | default |
| `var(--ds-glow-*)` | `var(--color-glow-*)` | CSS var in @layer components only |
| `@media (max-width: 768px)` | `md:` prefix (mobile-first: apply below md) | Switch class ordering |
| `@media (max-width: 900px)` | `lg:` prefix | 1024px (standard) |
| `display: none` → `@media(max-width:768px){ display:block }` | `hidden md:block` → flip: `block md:hidden` | Mobile-first! |

**Mobile-first pattern shift** — all responsive rules flip direction:
```tsx
// OLD: desktop default, mobile override
// .root { grid-template-columns: repeat(3,1fr) }
// @media(max-width:768px) { .root { grid-template-columns:1fr } }

// NEW: mobile default, md+ override
<ul className="grid grid-cols-1 md:grid-cols-3 gap-5">
```

**cn() pattern for conditional classes:**
```tsx
import { cn } from '@/lib/cn'
<div className={cn("base-classes", condition && "conditional-class", { "object-class": flag })}>
```

---

## Task 1: Install Tailwind v4 + PostCSS

**Files:**
- Create: `postcss.config.mjs`
- Modify: `package.json` (deps via pnpm)

- [ ] **Step 1: Install dependencies**

```bash
cd /path/to/repo
pnpm add -D tailwindcss @tailwindcss/postcss postcss clsx tailwind-merge
```

Expected: packages added to `devDependencies`, lockfile updated.

- [ ] **Step 2: Create postcss.config.mjs**

```js
// postcss.config.mjs
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
export default config;
```

- [ ] **Step 3: Verify pnpm check passes**

```bash
pnpm check
```

Expected: no lint errors on the new config file.

- [ ] **Step 4: Commit**

```bash
git add postcss.config.mjs package.json pnpm-lock.yaml
git commit -m "feat(tailwind): install tailwind v4 + postcss + cn deps"
```

---

## Task 2: Create lib/cn.ts

**Files:**
- Create: `lib/cn.ts`

- [ ] **Step 1: Write cn.ts**

```ts
// lib/cn.ts
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 2: Verify typecheck**

```bash
pnpm typecheck
```

Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add lib/cn.ts
git commit -m "feat(tailwind): add cn() composition utility"
```

---

## Task 3: Create app/css/theme.css

**Files:**
- Create: `app/css/theme.css`

- [ ] **Step 1: Write theme.css with all brand tokens**

```css
/* app/css/theme.css — Tailwind v4 @theme: brand palette + font.
   Standard Tailwind scale handles spacing, typography sizes, z-index, and breakpoints.
   Only values Tailwind has no opinion on live here. */

@theme {
  /* ── Brand palette ──────────────────────────────────────────────────────── */
  --color-signal:           #00ff41;
  --color-signal-subtle:    #00ff4166;
  --color-signal-quiet:     #00ff411a;
  --color-signal-faint:     #00ff411f;
  --color-fg:               #e6ffe6;
  --color-text-body:        #e6ffe6;
  --color-text-muted:       #4ade80;
  --color-text-faint:       #5ae07b;
  --color-surface:          #000000;
  --color-surface-shell:    #050505;
  --color-border-default:   #00ff4133;
  --color-surface-panel:    transparent;
  --color-error:            #ff8a8a;
  --color-accent-warm:      #ffd86b;
  --color-accent-cool:      #7fe4ff;
  --color-highlight-bg:     #00ff41;
  --color-highlight-fg:     #000000;

  /* ── Window chrome dots ─────────────────────────────────────────────────── */
  --color-chrome-close:     #ff5f57;
  --color-chrome-minimize:  #febc2e;
  --color-chrome-maximize:  #28c840;

  /* ── Glow alpha stops — used in box-shadow, text-shadow, gradients ────────
     Referenced as var(--color-glow-*) inside @layer components only.
     Also generates bg-glow-* / text-glow-* utilities as a bonus. */
  --color-glow-03: rgba(0, 255, 65, 0.03);
  --color-glow-04: rgba(0, 255, 65, 0.04);
  --color-glow-05: rgba(0, 255, 65, 0.05);
  --color-glow-06: rgba(0, 255, 65, 0.06);
  --color-glow-15: rgba(0, 255, 65, 0.15);
  --color-glow-18: rgba(0, 255, 65, 0.18);
  --color-glow-25: rgba(0, 255, 65, 0.25);
  --color-glow-30: rgba(0, 255, 65, 0.30);
  --color-glow-35: rgba(0, 255, 65, 0.35);
  --color-glow-40: rgba(0, 255, 65, 0.40);
  --color-glow-45: rgba(0, 255, 65, 0.45);
  --color-glow-50: rgba(0, 255, 65, 0.50);
  --color-glow-55: rgba(0, 255, 65, 0.55);
  --color-glow-60: rgba(0, 255, 65, 0.60);

  /* ── Typography ─────────────────────────────────────────────────────────── */
  --font-mono:    'JetBrains Mono', monospace;
  --font-display: 'Geist Black', sans-serif;
}
```

- [ ] **Step 2: Commit**

```bash
git add app/css/theme.css
git commit -m "feat(tailwind): add @theme brand token definitions"
```

---

## Task 4: Create app/css/base.css

**Files:**
- Create: `app/css/base.css`
- This replaces `app/css/_base.css` — all `--ds-*` vars renamed to new tokens or Tailwind utilities.

- [ ] **Step 1: Write base.css**

```css
/* app/css/base.css — @layer base: resets, body, typography, global utilities.
   Replaces app/css/_base.css. Uses renamed --color-* / --font-* vars from theme.css. */

@layer base {
  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  html {
    scroll-padding-top: 52px;
    -webkit-text-size-adjust: 100%;
    tab-size: 4;
  }

  @media (max-width: 768px) {
    html {
      scroll-padding-top: 76px;
    }
  }

  img,
  svg,
  video,
  canvas,
  audio,
  iframe,
  embed,
  object {
    display: block;
    vertical-align: middle;
  }

  img,
  video {
    max-width: 100%;
    height: auto;
  }

  input,
  textarea,
  select,
  optgroup {
    font: inherit;
    color: inherit;
    margin: 0;
  }

  ul,
  ol {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  html,
  body {
    margin: 0;
    padding: 0;
    background: var(--color-surface);
    color: var(--color-text-body);
    font-family: var(--font-mono);
    font-size: 16px;
    line-height: 1.55;
    -webkit-font-smoothing: antialiased;
    overflow-x: hidden;
  }

  ::selection {
    background: var(--color-signal);
    color: var(--color-highlight-fg);
  }

  a {
    color: var(--color-signal);
    text-decoration: none;
  }

  a:hover {
    text-decoration: underline;
  }

  a:focus-visible {
    text-decoration: underline;
    outline: 2px solid var(--color-signal);
    outline-offset: 2px;
  }

  button:focus-visible,
  input:focus-visible,
  textarea:focus-visible {
    outline: 2px solid var(--color-signal);
    outline-offset: 2px;
  }

  button {
    font-family: inherit;
    color: inherit;
    background: transparent;
    border: 1px solid var(--color-border-default);
    cursor: pointer;
  }

  pre,
  code {
    font-family: var(--font-mono);
    white-space: pre;
  }

  h1,
  h2,
  h3 {
    font-family: var(--font-mono);
    font-weight: 700;
    color: var(--color-signal);
    margin: 0 0 8px 0;
    text-shadow: 0 0 2px var(--color-glow-30);
  }

  h1 {
    font-size: 48px;
    font-family: var(--font-display);
    font-weight: 900;
  }

  @media (max-width: 768px) {
    h1 {
      font-size: 32px;
    }
  }

  /* ── Global utility classes ─────────────────────────────────────────────── */

  .skip-to-content {
    position: absolute;
    left: 0;
    top: 0;
    z-index: 9999;
    padding: 8px 16px;
    background: var(--color-signal);
    color: #000;
    font-family: var(--font-mono);
    font-size: 16px;
    font-weight: 700;
    text-decoration: none;
    clip-path: inset(50%);
    overflow: hidden;
    transition: clip-path 0.1s;
  }

  .skip-to-content:focus {
    clip-path: inset(0);
    overflow: visible;
  }

  @media (prefers-reduced-motion: reduce) {
    .skip-to-content {
      transition: none;
    }
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .not-found {
    min-height: 100svh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    background: var(--color-surface);
    color: var(--color-text-body);
    font-family: var(--font-mono);
    position: relative;
  }

  /* AppShell viewport visibility — global because AppShell uses plain className strings */
  .mobile-only {
    display: none;
  }

  @media (max-width: 768px) {
    .desktop-only {
      display: none;
    }
    .mobile-only {
      display: contents;
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/css/base.css
git commit -m "feat(tailwind): add @layer base (replaces _base.css)"
```

---

## Task 5: Create app/css/components.css

**Files:**
- Create: `app/css/components.css`
- This captures all CSS from CRTOverlay.module.css plus the Badge animation and any complex patterns that cannot be expressed as Tailwind utilities.

- [ ] **Step 1: Write components.css**

```css
/* app/css/components.css — @layer components: named classes for CRT/animation/
   complex patterns that cannot be expressed as Tailwind utilities. */

@layer components {

  /* ── Boot cursor ─────────────────────────────────────────────────────────── */

  @keyframes boot-blink {
    to { background: transparent; }
  }

  .boot-cursor {
    display: inline-block;
    width: 9px;
    height: 1.05em;
    background: var(--color-signal);
    vertical-align: -2px;
    margin-left: 2px;
    animation: boot-blink 1.05s steps(2, start) infinite;
  }

  @media (prefers-reduced-motion: reduce) {
    .boot-cursor { animation: none; }
  }
  body[data-motion="reduce"] .boot-cursor { animation: none; }

  /* ── Badge pulse ─────────────────────────────────────────────────────────── */

  @keyframes badge-pulse {
    0%, 100% { opacity: 1; box-shadow: 0 0 4px var(--color-signal); }
    50%       { opacity: 0.35; box-shadow: none; }
  }

  .badge-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--color-signal);
    flex-shrink: 0;
    animation: badge-pulse 1.6s ease-in-out infinite;
  }

  @media (prefers-reduced-motion: reduce) {
    .badge-dot { animation: none; }
  }
  body[data-motion="reduce"] .badge-dot { animation: none; }

  /* ── CRT vignette ────────────────────────────────────────────────────────── */

  .crt-vignette {
    position: fixed;
    inset: 0;
    pointer-events: none;
    background:
      radial-gradient(ellipse at 50% 30%, rgba(0, 80, 20, 0.12) 0%, transparent 55%),
      radial-gradient(ellipse at center, transparent 70%, rgba(0, 0, 0, 0.38) 100%);
    z-index: 1;
  }

  /* ── CRT scanlines ───────────────────────────────────────────────────────── */

  .crt-scanlines {
    position: fixed;
    inset: 0;
    pointer-events: none;
    background-image: repeating-linear-gradient(
      to bottom,
      rgba(0, 0, 0, 0.45) 0px,
      rgba(0, 0, 0, 0.45) 1px,
      transparent 1px,
      transparent 4px
    );
    mix-blend-mode: multiply;
    opacity: 0.3;
    z-index: 2;
  }

  /* ── CRT RGB sub-pixel mask ─────────────────────────────────────────────── */

  .crt-mask {
    position: fixed;
    inset: 0;
    pointer-events: none;
    background-image: repeating-linear-gradient(
      to right,
      rgba(255, 0, 0, 0.06) 0px, rgba(255, 0, 0, 0.06) 1px,
      rgba(0, 255, 0, 0.06) 1px, rgba(0, 255, 0, 0.06) 2px,
      rgba(0, 0, 255, 0.06) 2px, rgba(0, 0, 255, 0.06) 3px
    );
    mix-blend-mode: screen;
    opacity: 0.18;
    z-index: 3;
  }

  /* ── CRT noise / grain ───────────────────────────────────────────────────── */

  @keyframes crt-noise-shift {
    0%   { transform: translate(0, 0); }
    20%  { transform: translate(-4%, 2%); }
    40%  { transform: translate(3%, -3%); }
    60%  { transform: translate(-2%, 4%); }
    80%  { transform: translate(4%, 1%); }
    100% { transform: translate(0, 0); }
  }

  .crt-noise {
    position: fixed;
    inset: -50%;
    pointer-events: none;
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 1  0 0 0 0 0.25  0 0 0 0.5 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
    background-size: 180px 180px;
    opacity: 0.07;
    mix-blend-mode: screen;
    animation: crt-noise-shift 0.6s steps(6) infinite;
    will-change: transform;
    z-index: 4;
  }

  /* ── CRT flicker ─────────────────────────────────────────────────────────── */

  @keyframes crt-flicker {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.97; }
  }

  .crt-flicker {
    position: fixed;
    inset: 0;
    pointer-events: none;
    background: rgba(0, 255, 65, 0.02);
    animation: crt-flicker 4s infinite;
    will-change: opacity;
    z-index: 4;
  }

  /* ── CRT scan beam ───────────────────────────────────────────────────────── */

  @keyframes crt-scan-beam {
    0%   { transform: translateY(0); }
    100% { transform: translateY(calc(100vh + var(--crt-scan-offset) * 2)); }
  }

  .crt-scan-beam {
    --crt-scan-offset: 120px;
    position: fixed;
    left: 0;
    right: 0;
    top: calc(var(--crt-scan-offset) * -1);
    height: 110px;
    background: linear-gradient(180deg, transparent, rgba(0, 255, 65, 0.06) 50%, transparent);
    pointer-events: none;
    animation: crt-scan-beam 7s linear infinite;
    z-index: 5;
    will-change: transform;
  }

  /* ── CRT motion disable ─────────────────────────────────────────────────── */

  @media (prefers-reduced-motion: reduce) {
    .crt-flicker,
    .crt-scan-beam,
    .crt-noise {
      animation: none;
      opacity: 0;
      will-change: auto;
    }
  }

  body[data-motion="reduce"] .crt-flicker,
  body[data-motion="reduce"] .crt-scan-beam,
  body[data-motion="reduce"] .crt-noise {
    animation: none;
    opacity: 0;
    will-change: auto;
  }

  /* Freeze CRT during sysfail overlay */
  html.sysfail-on .crt-scan-beam,
  html.sysfail-on .crt-flicker,
  html.sysfail-on .crt-noise {
    animation-play-state: paused;
  }

  /* ── Phosphor / signal glow text-shadow ─────────────────────────────────── */

  .signal-glow {
    text-shadow:
      0 0 8px var(--color-glow-45),
      0 0 4px #000;
  }

  .signal-glow-strong {
    text-shadow:
      0 0 6px var(--color-glow-60),
      0 0 4px #000;
  }

  /* ── Sysfail plate / emergency overlay ─────────────────────────────────── */

  .sysfail-plate {
    background: var(--color-signal);
    color: #000;
    font-family: var(--font-mono);
    font-weight: 700;
    font-size: 24px;
    letter-spacing: 0.08em;
    padding: 6px 18px 8px;
    line-height: 1;
    text-transform: uppercase;
    box-shadow:
      0 0 24px var(--color-glow-55),
      0 0 60px var(--color-glow-25);
    white-space: nowrap;
  }

  @media (max-width: 1024px) {
    .sysfail-plate {
      padding: 5px 14px 6px;
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/css/components.css
git commit -m "feat(tailwind): add @layer components (CRT, animations, glow)"
```

---

## Task 6: Update app/globals.css

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Replace globals.css content**

```css
/* app/globals.css — entry point: Tailwind + brand theme + base resets + component classes */
@import "tailwindcss";
@import "./css/theme.css";
@import "./css/base.css";
@import "./css/components.css";
```

- [ ] **Step 2: Verify dev server starts without errors**

```bash
pnpm dev
```

Open `http://localhost:3000`. Expect: page renders with black background and green text (base styles load). CSS modules still working at this stage — this just adds Tailwind alongside.

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "feat(tailwind): update globals.css entry point"
```

---

## Task 7: Migrate ColorSwatch off JSON — CSS module → utilities

**Files:**
- Modify: `app/design-system/_components/ColorSwatch/ColorSwatch.tsx`
- Delete later: `app/design-system/_components/ColorSwatch/ColorSwatch.module.css`

Read `ColorSwatch.module.css` first, then apply changes below.

- [ ] **Step 1: Read the module CSS**

```bash
cat app/design-system/_components/ColorSwatch/ColorSwatch.module.css
```

- [ ] **Step 2: Replace CSS module import with Tailwind utilities in ColorSwatch.tsx**

The ColorSwatch renders a color swatch row with a swatch block, token name, and value. Replace with:

```tsx
import colorTokens from '../../../../design-system/tokens/color.json';
import { resolveValue } from '../../_lib/resolve-tokens';
// import styles from './ColorSwatch.module.css'; ← REMOVE

type Props = { token: string; usage?: string };

export function ColorSwatch({ token, usage }: Props) {
  const entry = colorTokens[token as keyof typeof colorTokens];
  if (!entry) return null;
  const resolved = resolveValue(entry.$value, colorTokens as Parameters<typeof resolveValue>[1]);

  return (
    <div className="flex items-center gap-3 py-2 border-b border-border-default last:border-0">
      <div
        className="w-8 h-8 flex-shrink-0 border border-border-default"
        style={{ background: resolved }}
        aria-hidden="true"
      />
      <div className="flex flex-col gap-0.5">
        <code className="text-[10px] font-mono text-text-muted tracking-widest">--{token}</code>
        <span className="text-xs font-mono text-text-body">{resolved}</span>
        {usage && <span className="text-[10px] font-mono text-text-faint">{usage}</span>}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify typecheck passes**

```bash
pnpm typecheck
```

- [ ] **Step 4: Commit**

```bash
git add app/design-system/_components/ColorSwatch/ColorSwatch.tsx
git commit -m "refactor(design-system): migrate ColorSwatch to Tailwind utilities"
```

---

## Task 8: Migrate SpacingRuler — CSS module → utilities

**Files:**
- Modify: `app/design-system/_components/SpacingRuler/SpacingRuler.tsx`
- Delete later: `app/design-system/_components/SpacingRuler/SpacingRuler.module.css`

- [ ] **Step 1: Read the module CSS**

```bash
cat app/design-system/_components/SpacingRuler/SpacingRuler.module.css
```

- [ ] **Step 2: Replace CSS module import in SpacingRuler.tsx**

```tsx
import spaceTokens from '../../../../design-system/tokens/space.json';
import { resolveValue } from '../../_lib/resolve-tokens';
// import styles from './SpacingRuler.module.css'; ← REMOVE

type Props = { token: string; usage?: string };
const MAX_BAR_PX = 320;

export function SpacingRuler({ token, usage }: Props) {
  const entry = spaceTokens[token as keyof typeof spaceTokens];
  if (!entry) return null;
  const resolved = resolveValue(entry.$value, spaceTokens as Parameters<typeof resolveValue>[1]);
  const numericPx = Number.parseInt(resolved, 10);
  const barWidth = Number.isNaN(numericPx) ? '100%' : `${Math.min(numericPx, MAX_BAR_PX)}px`;

  return (
    <div className="flex items-center gap-3 py-2 border-b border-border-default last:border-0">
      <div className="flex flex-col gap-1 min-w-[140px]">
        <code className="text-[10px] font-mono text-text-muted tracking-widest">--{token}</code>
        <span className="text-xs font-mono text-text-body">{resolved}</span>
        {usage && <span className="text-[10px] font-mono text-text-faint">{usage}</span>}
      </div>
      <div className="flex-1 h-4 bg-surface border border-border-default relative overflow-hidden">
        <div
          className="absolute left-0 top-0 h-full bg-signal-quiet border-r border-signal"
          style={{ width: barWidth }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify typecheck passes**

```bash
pnpm typecheck
```

- [ ] **Step 4: Commit**

```bash
git add app/design-system/_components/SpacingRuler/SpacingRuler.tsx
git commit -m "refactor(design-system): migrate SpacingRuler to Tailwind utilities"
```

---

## Task 9: Migrate TypeSpecimen — CSS module → utilities

**Files:**
- Modify: `app/design-system/_components/TypeSpecimen/TypeSpecimen.tsx`
- Delete later: `app/design-system/_components/TypeSpecimen/TypeSpecimen.module.css`

- [ ] **Step 1: Read the module CSS**

```bash
cat app/design-system/_components/TypeSpecimen/TypeSpecimen.module.css
```

- [ ] **Step 2: Replace CSS module import in TypeSpecimen.tsx**

```tsx
import typographyTokens from '../../../../design-system/tokens/typography.json';
import { resolveValue } from '../../_lib/resolve-tokens';
// import styles from './TypeSpecimen.module.css'; ← REMOVE

type Props = { token: string };

export function TypeSpecimen({ token }: Props) {
  const entry = typographyTokens[token as keyof typeof typographyTokens];
  if (!entry) return null;
  const resolved = resolveValue(
    entry.$value as string,
    typographyTokens as Parameters<typeof resolveValue>[1],
  );

  return (
    <div className="flex items-baseline gap-4 py-2 border-b border-border-default last:border-0">
      <div
        className="text-signal font-mono flex-shrink-0 w-16"
        style={{ fontSize: resolved }}
        aria-hidden="true"
      >
        Aa
      </div>
      <div className="flex flex-col gap-0.5">
        <code className="text-[10px] font-mono text-text-muted tracking-widest">--{token}</code>
        <span className="text-xs font-mono text-text-body">{resolved}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify typecheck passes**

```bash
pnpm typecheck
```

- [ ] **Step 4: Commit**

```bash
git add app/design-system/_components/TypeSpecimen/TypeSpecimen.tsx
git commit -m "refactor(design-system): migrate TypeSpecimen to Tailwind utilities"
```

---

## Task 10: Rewrite scripts/contrast-check.mjs

**Files:**
- Modify: `scripts/contrast-check.mjs`

The current script reads `design-system/dist/tokens.json` (generated file, deleted in Task 11). Rewrite to use hardcoded resolved values from `@theme` — the same values, sourced directly.

- [ ] **Step 1: Replace contrast-check.mjs**

```js
#!/usr/bin/env node
// Verifies WCAG AA contrast for defined semantic token pairs.
// Values sourced from app/css/theme.css @theme block (canonical source after Tailwind migration).

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const len = h.length === 3 ? 1 : 2;
  return [0, 1, 2].map((i) =>
    parseInt(h.substring(i * len, i * len + len).padEnd(2, h[i * len]), 16),
  );
}

function relativeLuminance([r, g, b]) {
  return [r, g, b].reduce((sum, c, i) => {
    const s = c / 255;
    const lin = s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    return sum + lin * [0.2126, 0.7152, 0.0722][i];
  }, 0);
}

function contrastRatio(hex1, hex2) {
  const L1 = relativeLuminance(hexToRgb(hex1));
  const L2 = relativeLuminance(hexToRgb(hex2));
  const [light, dark] = L1 > L2 ? [L1, L2] : [L2, L1];
  return (light + 0.05) / (dark + 0.05);
}

// Resolved values from @theme (app/css/theme.css).
// Update here whenever @theme values change.
const COLORS = {
  signal:       '#00ff41',
  textBody:     '#e6ffe6',
  textMuted:    '#4ade80',
  textFaint:    '#5ae07b',
  surface:      '#000000',
  surfaceShell: '#050505',
};

// Pairs: [foreground, background, minRatio, label]
const PAIRS = [
  [COLORS.textMuted,  COLORS.surface,      4.5, 'muted text on base'],
  [COLORS.textFaint,  COLORS.surface,      4.5, 'faint text on base'],
  [COLORS.signal,     COLORS.surface,      3.0, 'signal on base (large text)'],
  [COLORS.textBody,   COLORS.surfaceShell, 4.5, 'body text on shell'],
  [COLORS.signal,     COLORS.surfaceShell, 3.0, 'signal on shell (large text)'],
];

let failures = 0;
for (const [fg, bg, minRatio, label] of PAIRS) {
  const ratio = contrastRatio(fg, bg);
  const pass = ratio >= minRatio;
  console.log(`${pass ? 'PASS' : 'FAIL'} ${label}: ${ratio.toFixed(2)}:1 (min ${minRatio}:1)`);
  if (!pass) failures++;
}

if (failures > 0) {
  console.error(`\n${failures} contrast failure(s).`);
  process.exit(1);
}
console.log('\nContrast check passed.');
```

- [ ] **Step 2: Run contrast check to verify it passes**

```bash
node scripts/contrast-check.mjs
```

Expected output:
```
PASS muted text on base: X.XX:1 (min 4.5:1)
PASS faint text on base: X.XX:1 (min 4.5:1)
PASS signal on base (large text): X.XX:1 (min 3.0:1)
PASS body text on shell: X.XX:1 (min 4.5:1)
PASS signal on shell (large text): X.XX:1 (min 3.0:1)

Contrast check passed.
```

- [ ] **Step 3: Commit**

```bash
git add scripts/contrast-check.mjs
git commit -m "refactor(ci): rewrite contrast-check to read from @theme values (removes dist/tokens.json dep)"
```

---

## Task 11: Remove Style Dictionary pipeline + alpha.test.ts

**Files:**
- Delete: `design-system/tokens/__tests__/alpha.test.ts`
- Delete: `design-system/dist/` (entire directory)
- Modify: `package.json` — remove `tokens:build` and `tokens:check` scripts
- Delete Style Dictionary config file (find it: `ls design-system/` or `ls`)

- [ ] **Step 1: Find and delete SD config**

```bash
ls design-system/
# Look for: sd.config.ts, sd.config.mjs, style-dictionary.config.*, build-tokens.*
# Then delete whichever exists:
rm design-system/sd.config.ts  # or whichever file exists
```

- [ ] **Step 2: Delete dist output and alpha test**

```bash
rm -rf design-system/dist
rm design-system/tokens/__tests__/alpha.test.ts
```

- [ ] **Step 3: Remove SD scripts from package.json**

Open `package.json`. Remove the `tokens:build` and `tokens:check` script entries. Also remove `style-dictionary` from devDependencies if present.

```bash
pnpm check
pnpm typecheck
```

Expected: no errors related to removed files.

- [ ] **Step 4: Update globals.css to remove dist/tokens.css import**

`app/globals.css` was already updated in Task 6 — confirm it no longer imports `../design-system/dist/tokens.css`. If it still does, remove that line.

- [ ] **Step 5: Run tests to verify alpha.test.ts removal doesn't break coverage**

```bash
pnpm test --run 2>&1 | tail -10
```

Expected: all tests pass, no reference to deleted file.

- [ ] **Step 6: Commit**

```bash
git add -u
git commit -m "refactor(tokens): remove Style Dictionary pipeline and dist output"
```

---

## Task 12: Migrate design-system primitives — Button + WindowChrome

**Files:**
- Modify: `design-system/components/Button/Button.tsx`
- Modify: `design-system/components/WindowChrome/WindowChrome.tsx`
- Delete later: `design-system/components/Button/Button.module.css`
- Delete later: `design-system/components/WindowChrome/WindowChrome.module.css`

- [ ] **Step 1: Read both module CSS files**

```bash
cat design-system/components/Button/Button.module.css
cat design-system/components/WindowChrome/WindowChrome.module.css
```

- [ ] **Step 2: Migrate Button.tsx**

Button has: `root` (base), `primary`, `secondary`, `sm/md/lg` size variants. Migrate with `cn()`:

```tsx
import { cn } from '@/lib/cn';
// Remove: import s from './Button.module.css';

type ButtonVariant = 'primary' | 'secondary';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  as?: 'button' | 'a';
  href?: string;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:   'bg-signal text-surface border-signal hover:shadow-[0_0_12px_theme(colors.signal)]',
  secondary: 'bg-transparent text-signal hover:shadow-[0_0_12px_theme(colors.signal)] hover:bg-signal-quiet',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'min-h-[36px]',
  md: 'min-h-[44px]',
  lg: 'min-h-[52px]',
};

export function Button({
  variant = 'primary',
  size = 'md',
  as: Tag = 'button',
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <Tag
      className={cn(
        'inline-flex items-center justify-center px-[14px] border border-signal-subtle',
        'text-xs font-bold tracking-[0.1em] uppercase cursor-pointer no-underline',
        'transition-[box-shadow,background] duration-200 ease-out',
        'focus-visible:outline-2 focus-visible:outline-signal focus-visible:outline-offset-2',
        'disabled:opacity-40 disabled:pointer-events-none',
        '[&[aria-disabled="true"]]:opacity-40 [&[aria-disabled="true"]]:pointer-events-none',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    >
      {children}
    </Tag>
  );
}
```

- [ ] **Step 3: Migrate WindowChrome.tsx**

Read `WindowChrome.module.css` first. WindowChrome renders three colored dots (close/minimize/maximize). Typical implementation:

```tsx
import { cn } from '@/lib/cn';
// Remove: import s from './WindowChrome.module.css';

interface WindowChromeProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function WindowChrome({ size = 10, className, style }: WindowChromeProps) {
  const dotStyle = { width: size, height: size };
  return (
    <div
      className={cn('flex items-center gap-[6px]', className)}
      aria-hidden="true"
      style={style}
    >
      <span className="rounded-full bg-chrome-close flex-shrink-0" style={dotStyle} />
      <span className="rounded-full bg-chrome-minimize flex-shrink-0" style={dotStyle} />
      <span className="rounded-full bg-chrome-maximize flex-shrink-0" style={dotStyle} />
    </div>
  );
}
```

- [ ] **Step 4: Verify typecheck + tests**

```bash
pnpm typecheck && pnpm test --run 2>&1 | grep -E "PASS|FAIL|Error" | head -10
```

- [ ] **Step 5: Commit**

```bash
git add design-system/components/Button/Button.tsx design-system/components/WindowChrome/WindowChrome.tsx
git commit -m "refactor(design-system): migrate Button + WindowChrome to Tailwind utilities"
```

---

## Task 13: Migrate design-system primitives — Badge + StatTile

**Files:**
- Modify: `design-system/components/Badge/Badge.tsx`
- Modify: `design-system/components/StatTile/StatTile.tsx`
- Delete later: `design-system/components/Badge/Badge.module.css`
- Delete later: `design-system/components/StatTile/StatTile.module.css`

- [ ] **Step 1: Read both module CSS files**

```bash
cat design-system/components/Badge/Badge.module.css
cat design-system/components/StatTile/StatTile.module.css
```

- [ ] **Step 2: Migrate Badge.tsx**

Badge has `.root`, `.dot` (animated with `badge-pulse`), size variants. The `.badge-dot` keyframe is now in `components.css`:

```tsx
import { cn } from '@/lib/cn';
// Remove: import s from './Badge.module.css';

type BadgeVariant = 'default' | 'dot';
type BadgeSize = 'sm' | 'md';

interface BadgeProps {
  variant?: BadgeVariant;
  size?: BadgeSize;
  children: React.ReactNode;
}

export function Badge({ variant = 'default', size = 'md', children }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-[7px] border border-signal-subtle text-signal',
        'font-mono tracking-[0.12em] uppercase whitespace-nowrap',
        size === 'sm' ? 'text-[10px] px-2 py-[3px]' : 'text-[10px] px-[10px] py-1',
        // narrow viewport badge wrap
        'max-[359px]:whitespace-normal max-[359px]:flex-wrap',
      )}
    >
      {variant === 'dot' && (
        <span className="badge-dot" aria-hidden="true" />
      )}
      {children}
    </span>
  );
}
```

- [ ] **Step 3: Read StatTile.module.css and migrate StatTile.tsx**

```bash
cat design-system/components/StatTile/StatTile.module.css
```

StatTile renders a `<dl>` with a value and label. Typical:

```tsx
import { cn } from '@/lib/cn';
// Remove: import s from './StatTile.module.css';

type StatTileVariant = 'default' | 'compact';

interface StatTileProps {
  value: string;
  label: string;
  variant?: StatTileVariant;
}

export function StatTile({ value, label, variant = 'default' }: StatTileProps) {
  return (
    <dl
      className={cn(
        'flex flex-col border border-signal-subtle',
        variant === 'compact' ? 'px-3 py-2' : 'px-4 py-3',
      )}
    >
      <dd className="text-signal font-bold font-mono text-2xl leading-none m-0">{value}</dd>
      <dt className="text-[10px] text-text-muted tracking-widest uppercase mt-1">{label}</dt>
    </dl>
  );
}
```

- [ ] **Step 4: Verify**

```bash
pnpm typecheck && pnpm test --run 2>&1 | tail -5
```

- [ ] **Step 5: Commit**

```bash
git add design-system/components/Badge/Badge.tsx design-system/components/StatTile/StatTile.tsx
git commit -m "refactor(design-system): migrate Badge + StatTile to Tailwind utilities"
```

---

## Task 14: Migrate design-system primitives — CmdLine + KbdKey + Field + CopyButton + TerminalPanel

**Files:**
- Modify: `design-system/components/CmdLine/CmdLine.tsx`
- Modify: `design-system/components/KbdKey/KbdKey.tsx`
- Modify: `design-system/components/Field/Field.tsx` (client component)
- Modify: `design-system/components/TerminalPanel/TerminalPanel.tsx`
- Delete later: all 4 `.module.css` files
- Note: `design-system/components/CopyButton/CopyButton.tsx` has no `.module.css` — skip

- [ ] **Step 1: Read all 4 module CSS files**

```bash
cat design-system/components/CmdLine/CmdLine.module.css
cat design-system/components/KbdKey/KbdKey.module.css
cat design-system/components/Field/Field.module.css
cat design-system/components/TerminalPanel/TerminalPanel.module.css
```

- [ ] **Step 2: For each component, remove the CSS module import and replace `s.className` with Tailwind utility strings**

Apply the token mapping table from the plan header. Key patterns:
- `var(--ds-color-signal)` → `text-signal` / `bg-signal` / `border-signal`
- `var(--ds-color-signal-subtle)` → `border-signal-subtle`
- `var(--ds-font-size-xs)` → `text-[10px]` (token is 10px, not Tailwind's `text-xs` which is 12px)
- `var(--ds-font-size-sm)` → `text-xs` (12px)
- `var(--ds-font-size-body)` → `text-sm` (14px)
- Use `cn()` from `@/lib/cn` for conditional class composition
- `@media (max-width: 768px)` overrides become `md:` prefixes (mobile-first flip)

- [ ] **Step 3: Run typecheck after all 5 edits**

```bash
pnpm typecheck
```

- [ ] **Step 4: Verify design system docs page builds**

```bash
pnpm build 2>&1 | grep -E "error|Error|✓" | head -20
```

- [ ] **Step 5: Commit**

```bash
git add design-system/components/CmdLine/ design-system/components/KbdKey/ design-system/components/Field/ design-system/components/CopyButton/ design-system/components/TerminalPanel/
git commit -m "refactor(design-system): migrate CmdLine, KbdKey, Field, CopyButton, TerminalPanel to Tailwind"
```

---

## Task 15: Migrate design-system docs UI components

**Files:**
- Modify: `app/design-system/_components/ColorSwatch/ColorSwatch.module.css` (already done in Task 7)
- Modify: `app/design-system/_components/ComponentNav/ComponentNav.tsx`
- Modify: `app/design-system/_components/Preview.tsx` (or equivalent)
- Modify: `app/design-system/_components/Sidebar.tsx`
- Modify: `app/design-system/layout.tsx`
- Modify: `app/page.tsx` (uses `app/page.module.css`)
- Delete later: all corresponding `.module.css` files

- [ ] **Step 1: Read all module CSS files**

```bash
cat app/design-system/_components/ComponentNav/ComponentNav.module.css
cat app/design-system/_components/Preview.module.css
cat app/design-system/_components/Sidebar.module.css
cat app/design-system/layout.module.css
cat app/page.module.css
```

- [ ] **Step 2: Migrate each component following the token mapping table**

For each: remove `import s from './X.module.css'`, replace `s.className` with utility strings. Use `cn()` for conditionals.

- [ ] **Step 3: Verify build**

```bash
pnpm build 2>&1 | grep -E "error|Error" | head -10
```

- [ ] **Step 4: Commit**

```bash
git add app/design-system/ app/page.tsx
git commit -m "refactor(design-system): migrate docs UI components and page to Tailwind utilities"
```

---

## Task 16: Migrate AppShell + layout components

**Files:**
- Modify: `components/AppShell/AppShell.tsx`
- Modify: `components/responsive/DesktopTopbar/DesktopTopbar.tsx`
- Modify: `components/responsive/Dock/Dock.tsx`
- Modify: `components/responsive/MobileTitleBar/MobileTitleBar.tsx`
- Modify: `components/responsive/Module/Module.tsx`
- Modify: `components/responsive/StatusBar/StatusBar.tsx`
- Delete later: all 5 `.module.css` files

- [ ] **Step 1: Read all module CSS files**

```bash
cat components/AppShell/AppShell.module.css
cat components/responsive/DesktopTopbar/DesktopTopbar.module.css
cat components/responsive/Dock/Dock.module.css
cat components/responsive/MobileTitleBar/MobileTitleBar.module.css
cat components/responsive/Module/Module.module.css
cat components/responsive/StatusBar/StatusBar.module.css
```

- [ ] **Step 2: Migrate each component following the token mapping table**

For `AppShell`: note it uses `:global()` selectors in its module CSS — these become plain class selectors in `@layer base` (already handled by `.mobile-only`/`.desktop-only` in `base.css`). Do not add new global classes; use `md:hidden` / `hidden md:flex` instead.

For `Module` (the responsive section wrapper): it likely has a padding pattern that varies by breakpoint — convert to `px-[14px] md:px-[18px] lg:px-6`.

- [ ] **Step 3: Verify**

```bash
pnpm typecheck && pnpm test --run 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
git add components/AppShell/ components/responsive/
git commit -m "refactor(shell): migrate AppShell and responsive layout components to Tailwind"
```

---

## Task 17: Migrate CRTOverlay + HeroStats

**Files:**
- Modify: `components/responsive/CRTOverlay/CRTOverlay.tsx`
- Modify: `components/HeroStats/HeroStats.tsx`
- Delete later: `components/responsive/CRTOverlay/CRTOverlay.module.css`
- Delete later: `components/HeroStats/HeroStats.module.css`

- [ ] **Step 1: Read both module CSS files**

```bash
cat components/responsive/CRTOverlay/CRTOverlay.module.css
cat components/HeroStats/HeroStats.module.css
```

- [ ] **Step 2: Migrate CRTOverlay.tsx**

The CRT module classes (`vignette`, `overlay`/`scanlines`, `mask`, `noise`, `flicker`, `scanBeam`) are now global named classes in `components.css`. Replace the module import with the global class names directly:

```tsx
// Remove: import s from './CRTOverlay.module.css';
// Before: <div className={s.vignette} />
// After:
<div className="crt-vignette" />
<div className="crt-scanlines" />
<div className="crt-mask" />
<div className="crt-noise" aria-hidden="true" />
<div className="crt-flicker" aria-hidden="true" />
<div className="crt-scan-beam" aria-hidden="true" />
```

The `sysfail-on` freeze is handled in `components.css` via `html.sysfail-on .crt-*` selectors — no change needed in TSX.

- [ ] **Step 3: Migrate HeroStats.tsx following the token mapping table**

- [ ] **Step 4: Commit**

```bash
git add components/responsive/CRTOverlay/ components/HeroStats/
git commit -m "refactor(shell): migrate CRTOverlay and HeroStats to Tailwind + @layer components"
```

---

## Task 18: Migrate Hero section

**Files:**
- Modify: `components/sections/Hero/Hero.tsx` (and `HeroBootAnimation.tsx`, `HeroSystemFailure.tsx` if co-located)
- Delete later: `components/sections/Hero/Hero.module.css`

- [ ] **Step 1: Read the module CSS**

```bash
cat components/sections/Hero/Hero.module.css
```

- [ ] **Step 2: Migrate Hero.tsx**

Key patterns in Hero:
- `.root` — `relative border border-signal-subtle min-h-[640px] overflow-hidden mb-12 transition-transform md:min-h-[520px]`
- `.desktop` / `.mobile` toggle — `hidden md:flex` / `md:hidden`
- `.bio` — `flex-1 border-l border-dashed border-signal-subtle flex flex-col justify-end p-8 lg:p-[18px] gap-2.5`
- `.ctas` — `grid grid-cols-2 gap-3 mt-3`
- `.headline` (sysfail overlay) — `fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[9999] opacity-0 pointer-events-none transition-opacity`
- `.headline.on` — add `opacity-100` via `cn()`
- `.headlinePlate` — use `.sysfail-plate` from `components.css`
- `.bootCursor` — use `.boot-cursor` from `components.css`
- `.status` with mobile `margin-bottom: 14px` — `md:mb-[14px]` (mobile-first: `mb-[14px] md:mb-0`)
- `.dialog` text-shadow — use `.signal-glow` from `components.css`

- [ ] **Step 3: Verify typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 4: Commit**

```bash
git add components/sections/Hero/
git commit -m "refactor(hero): migrate Hero section to Tailwind utilities"
```

---

## Task 19: Migrate ProjectsSection

**Files:**
- Modify: `components/sections/ProjectsSection/ProjectsSection.tsx`
- Delete later: `components/sections/ProjectsSection/ProjectsSection.module.css`

- [ ] **Step 1: Read the module CSS**

```bash
cat components/sections/ProjectsSection/ProjectsSection.module.css
```

- [ ] **Step 2: Migrate ProjectsSection.tsx**

Key patterns:
- `.root` (grid) — `grid grid-cols-1 md:grid-cols-3 gap-5 list-none p-0 m-0`
- `.project` (card) — `relative border border-signal-subtle p-5 transition-[border-color,box-shadow] duration-200 ease-out md:p-[14px]`
- `.project:hover` — `hover:border-signal hover:shadow-[0_0_16px_var(--color-glow-18)]`
- `.projectTop` — `flex justify-between items-end mb-3`
- `.projectFolder` — `w-10 h-8 fill-signal md:w-8 md:h-[26px]`
- `.projectName` — `text-signal font-bold tracking-[0.04em] my-1.5 text-base md:text-sm`
- `.projectDesc` — `text-text-body text-xs mb-4`
- `.projectStats` — `grid gap-1 text-xs m-0`
- `.card` (mobile card) — `border border-signal-subtle p-[14px] mb-2.5 last:mb-0`
- `.prefers-reduced-motion` — handled by Tailwind's `motion-reduce:` variant: `motion-reduce:transition-none`

- [ ] **Step 3: Verify**

```bash
pnpm typecheck
```

- [ ] **Step 4: Commit**

```bash
git add components/sections/ProjectsSection/
git commit -m "refactor(projects): migrate ProjectsSection to Tailwind utilities"
```

---

## Task 20: Migrate NpmStackSection + LivePerfSection + PerfReceiptsSection

**Files:**
- Modify: `components/sections/NpmStackSection/NpmStackSection.tsx`
- Modify: `components/sections/LivePerfSection/LivePerfSection.tsx`
- Modify: `components/sections/PerfReceiptsSection/PerfReceiptsSection.tsx`
- Delete later: all 3 `.module.css` files

- [ ] **Step 1: Read the module CSS files**

```bash
cat components/sections/NpmStackSection/NpmStackSection.module.css
cat components/sections/LivePerfSection/LivePerfSection.module.css
cat components/sections/PerfReceiptsSection/PerfReceiptsSection.module.css
```

- [ ] **Step 2: Migrate each component following the token mapping table**

For PerfReceiptsSection note: `.receiptHero` uses `background: linear-gradient(180deg, var(--ds-glow-04), var(--ds-color-surface-panel))` — becomes `bg-[linear-gradient(180deg,var(--color-glow-04),var(--color-surface-panel))]` as an arbitrary value, or move this to `@layer components` as `.receipt-hero-gradient`.

For desktop-only visibility (`display: none` on mobile, `display: flex` on desktop-up): use `hidden md:flex` (mobile-first: hidden by default, flex at md+).

- [ ] **Step 3: Verify**

```bash
pnpm typecheck && pnpm test --run 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
git add components/sections/NpmStackSection/ components/sections/LivePerfSection/ components/sections/PerfReceiptsSection/
git commit -m "refactor(sections): migrate NpmStack, LivePerf, PerfReceipts to Tailwind utilities"
```

---

## Task 21: Migrate GuitarSection + DawMixerSection

**Files:**
- Modify: `components/sections/GuitarSection/GuitarSection.tsx`
- Modify: `components/sections/DawMixerSection/DawMixerSection.tsx` (and co-located files)
- Delete later: both `.module.css` files

- [ ] **Step 1: Read the module CSS files**

```bash
cat components/sections/GuitarSection/GuitarSection.module.css
cat components/sections/DawMixerSection/DawMixerSection.module.css
```

- [ ] **Step 2: Migrate each component following the token mapping table**

DawMixerSection is complex (grid-based audio mixer). Key concern: the 7-column grid layout — use CSS grid utilities (`grid grid-cols-7`) and map column-span rules to `col-span-*` utilities. If the grid is highly customized, consider adding a `.daw-grid` class to `@layer components`.

- [ ] **Step 3: Verify**

```bash
pnpm typecheck && pnpm test --run 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
git add components/sections/GuitarSection/ components/sections/DawMixerSection/
git commit -m "refactor(sections): migrate GuitarSection and DawMixerSection to Tailwind utilities"
```

---

## Task 22: Migrate client islands — ContactForm + InteractiveShell + ToTopButton

**Files:**
- Modify: `components/client/ContactForm/ContactForm.tsx`
- Modify: `components/client/InteractiveShell/InteractiveShell.tsx`
- Modify: `components/client/ToTopButton/ToTopButton.tsx`
- Delete later: all 3 `.module.css` files

- [ ] **Step 1: Read the module CSS files**

```bash
cat components/client/ContactForm/ContactForm.module.css
cat components/client/InteractiveShell/InteractiveShell.module.css
cat components/client/ToTopButton/ToTopButton.module.css
```

- [ ] **Step 2: Migrate ContactForm.tsx**

Note: the gradient background `linear-gradient(180deg, var(--ds-glow-04), var(--ds-color-surface-panel))` — use an arbitrary value `bg-[linear-gradient(180deg,var(--color-glow-04),var(--color-surface-panel))]` or add `.contact-gradient` to `components.css`.

- [ ] **Step 3: Migrate InteractiveShell.tsx**

InteractiveShell is a client island with streaming output — the CSS is likely layout + borders. Apply the token mapping table. Preserve the `useRef.textContent` mutation pattern; this task is CSS only.

- [ ] **Step 4: Verify tests pass (InteractiveShell has behavioral tests)**

```bash
pnpm test --run 2>&1 | grep -E "InteractiveShell|FAIL|Error" | head -10
```

- [ ] **Step 5: Commit**

```bash
git add components/client/ContactForm/ components/client/InteractiveShell/ components/client/ToTopButton/
git commit -m "refactor(client): migrate ContactForm, InteractiveShell, ToTopButton to Tailwind utilities"
```

---

## Task 23: Migrate DAW client islands — FaderIsland + KnobIsland + RmsButtons + VuMeter + FaderDbIsland

**Files:**
- Modify: `components/client/DawMixer/FaderIsland/FaderIsland.tsx`
- Modify: `components/client/DawMixer/KnobIsland/KnobIsland.tsx`
- Modify: `components/client/DawMixer/RmsButtons/RmsButtons.tsx`
- Modify: `components/client/DawMixer/VuMeter/VuMeter.tsx`
- Modify: `components/client/DawMixer/FaderIsland/FaderDbIsland.tsx` (if exists)
- Delete later: all corresponding `.module.css` files

- [ ] **Step 1: Read all module CSS files**

```bash
cat components/client/DawMixer/FaderIsland/FaderIsland.module.css
cat components/client/DawMixer/KnobIsland/KnobIsland.module.css
cat components/client/DawMixer/RmsButtons/RmsButtons.module.css
cat components/client/DawMixer/VuMeter/VuMeter.module.css
```

- [ ] **Step 2: Migrate each following the token mapping table**

DAW islands are highly interactive. CSS changes only — preserve all event handler and ref logic. Any complex animation or pseudo-element in the DAW (VU meter bars, fader track) may warrant a `@layer components` entry. Judge by complexity; if more than 3 non-utility properties, add to `components.css`.

- [ ] **Step 3: Verify tests (DawMixer has behavioral tests)**

```bash
pnpm test --run 2>&1 | grep -E "Daw|Fader|Knob|FAIL" | head -10
```

- [ ] **Step 4: Commit**

```bash
git add components/client/DawMixer/
git commit -m "refactor(daw): migrate DawMixer client islands to Tailwind utilities"
```

---

## Task 24: Migrate remaining section components (batch)

**Files:** All remaining section `.tsx` files:
- `components/sections/AiMetricsSection/`
- `components/sections/CommunitySection/`
- `components/sections/CredentialsSection/`
- `components/sections/Footer/`
- `components/sections/GitLogSection/`
- `components/sections/HottestTakesSection/`
- `components/sections/ManPageSection/`
- `components/sections/NowSection/`
- `components/sections/ReadmeSection/`
- `components/sections/ResponsibilitiesSection/`
- `components/sections/SysHealthSection/`
- `components/sections/UnknownsSection/`
- `components/sections/VisaSection/`

- [ ] **Step 1: Read all module CSS files**

```bash
for f in AiMetrics Community Credentials Footer GitLog HottestTakes ManPage Now Readme Responsibilities SysHealth Unknowns Visa; do
  echo "=== ${f}Section ===" && cat "components/sections/${f}Section/${f}Section.module.css" 2>/dev/null || echo "(not found)"
done
```

- [ ] **Step 2: Migrate each component following the token mapping table**

Work through each file. For each:
1. Open the `.tsx` file
2. Remove `import s from './X.module.css'`
3. Add `import { cn } from '@/lib/cn'` (if conditionals needed)
4. Replace every `s.className` with the Tailwind equivalent

Common patterns across sections:
- Section header: `text-signal font-bold tracking-[0.08em] uppercase text-xs mb-3`
- Panel with border: `border border-signal-subtle p-6 mb-[var(--space-rhythm)]`
- Grid layouts: `grid grid-cols-1 md:grid-cols-2 gap-4`
- Terminal-style labels: `text-[10px] text-text-muted tracking-[0.14em] uppercase`

- [ ] **Step 3: Verify all sections**

```bash
pnpm typecheck && pnpm test --run 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
git add components/sections/
git commit -m "refactor(sections): migrate remaining 13 section components to Tailwind utilities"
```

---

## Task 25: Delete all CSS module files

At this point, all 52 `.tsx` files have been migrated. Every `.module.css` import has been removed.

- [ ] **Step 1: Verify no module imports remain**

```bash
grep -r "\.module\.css" --include="*.tsx" --include="*.ts" app components design-system
```

Expected: **zero output**. If any lines appear, go back and fix those files before continuing.

- [ ] **Step 2: Delete all CSS module files**

```bash
find . -name "*.module.css" \
  -not -path "./node_modules/*" \
  -not -path "./.next/*" \
  -delete
```

- [ ] **Step 3: Verify build succeeds**

```bash
pnpm build 2>&1 | grep -E "error|Error|✓ Compiled" | head -20
```

Expected: build completes with no CSS module import errors.

- [ ] **Step 4: Commit**

```bash
git add -u
git commit -m "refactor(css): delete all 52 CSS module files"
```

---

## Task 26: Remove lint scripts + add no-module-css gate

**Files:**
- Delete: `scripts/lint-breakpoints.mjs`
- Delete: `scripts/lint-token-boundary.mjs`
- Delete: `scripts/lint-no-magic-values.mjs`
- Modify: `package.json` — remove the three lint script entries, add `lint:no-module-css`
- Modify: `.github/workflows/ci.yml` — update CI to run `lint:no-module-css` instead of the three removed scripts

- [ ] **Step 1: Delete the three lint scripts**

```bash
rm scripts/lint-breakpoints.mjs scripts/lint-token-boundary.mjs scripts/lint-no-magic-values.mjs
```

- [ ] **Step 2: Update package.json scripts**

Remove entries for `lint:breakpoints`, `lint:token-boundary`, `lint:no-magic-values` from the `scripts` block.

Add the new gate:
```json
"lint:no-module-css": "node -e \"const {execSync}=require('child_process');const r=execSync('grep -r \\\\.module\\\\.css --include=*.tsx --include=*.ts app components design-system || true').toString().trim();if(r){console.error('CSS module imports found:\\n'+r);process.exit(1);}console.log('No CSS module imports found.');\""
```

Or as a script file — create `scripts/lint-no-module-css.mjs`:
```js
#!/usr/bin/env node
import { execSync } from 'node:child_process';
const result = execSync(
  "grep -r '\\.module\\.css' --include='*.tsx' --include='*.ts' app components design-system || true",
  { encoding: 'utf8' }
).trim();
if (result) {
  console.error('CSS module imports found:\n' + result);
  process.exit(1);
}
console.log('No CSS module imports found.');
```

Then in `package.json`: `"lint:no-module-css": "node scripts/lint-no-module-css.mjs"`

- [ ] **Step 3: Update CI to use the new gate**

In `.github/workflows/ci.yml`, replace references to the three deleted lint scripts with `pnpm lint:no-module-css`. Also update `pnpm ci:local` if it references the old scripts.

- [ ] **Step 4: Verify the new gate passes**

```bash
node scripts/lint-no-module-css.mjs
```

Expected: `No CSS module imports found.`

- [ ] **Step 5: Update CLAUDE.md CSS section**

In `CLAUDE.md`, update the Stack section:
- Remove: `_Tailwind v4 was removed 2026-05-18; see DECISIONS.md. Do not re-add._`
- Update to: `Tailwind v4 via @tailwindcss/postcss. @theme in app/css/theme.css. @layer components in app/css/components.css for CRT/animations. No CSS modules.`
- Update the lint gate table: remove `lint-token-boundary`, `lint-no-magic-values`, `lint-breakpoints`; add `lint:no-module-css`

- [ ] **Step 6: Commit**

```bash
git add scripts/ package.json .github/workflows/ci.yml CLAUDE.md
git commit -m "refactor(ci): replace 3 token lint gates with no-module-css gate"
```

---

## Task 27: Run pnpm ci:local — fix all failures

- [ ] **Step 1: Run full local CI**

```bash
pnpm ci:local 2>&1 | tail -30
```

- [ ] **Step 2: Fix any failures**

Common expected failures at this stage:
- Tests referencing class names that changed (update assertions)
- TypeScript errors from component files not yet fully migrated
- Vitest coverage drop (add tests if needed to maintain 80% threshold)

For each failure: identify the root cause, fix minimally, re-run.

- [ ] **Step 3: Re-run until clean**

```bash
pnpm ci:local 2>&1 | tail -10
```

Expected: all checks pass.

- [ ] **Step 4: Commit fixes**

```bash
git add -u
git commit -m "fix(tailwind): address ci:local failures after migration"
```

---

## Task 28: Run pnpm gates:runtime — verify perf + a11y

- [ ] **Step 1: Run full runtime gates**

```bash
pnpm gates:runtime 2>&1 | tail -30
```

This runs: build + LHCI desktop + LHCI mobile + axe-core + E2E functional.

- [ ] **Step 2: Check render-blocking-resources mobile gate**

```bash
pnpm gates:runtime 2>&1 | grep -i "render-blocking\|blocking" | head -5
```

If the `render-blocking-resources` `maxLength: 3` gate fails: audit which stylesheets are blocking. Tailwind emits one CSS chunk; combined with `globals.css` and `next/font` this may hit 3+ blocking resources. Options:
- Verify Tailwind outputs a single chunk (it should)
- If 4+ blocking resources: investigate whether the font CSS can be deferred or inlined

- [ ] **Step 3: Re-calibrate bundle-check threshold**

After a clean build, read the new CSS gzip size:
```bash
pnpm build 2>&1 | grep -E "\.css.*gzip|css.*kB" | head -5
```

Update `scripts/check-bundle-size.mjs` threshold if the new size is within acceptable bounds and differs from the previous 9.68KB.

- [ ] **Step 4: Check Lighthouse scores**

```bash
pnpm gates:runtime 2>&1 | grep -E "performance|accessibility|PASS|FAIL" | head -20
```

Expected: perf ≥ 95, a11y = 100. If a11y fails: run `pnpm test:e2e` and check axe output for specific violations.

- [ ] **Step 5: Fix any gate failures and re-run**

- [ ] **Step 6: Commit if any fixes were needed**

```bash
git add -u
git commit -m "fix(tailwind): address gates:runtime failures after migration"
```

---

## Task 29: Regenerate visual regression baselines

- [ ] **Step 1: Start dev server**

```bash
pnpm dev &
sleep 5
```

- [ ] **Step 2: Run Playwright visual check (Playwright MCP)**

Using the Playwright MCP tool, visually inspect:
- Desktop (1280×720): Hero, Projects, NpmStack, GuitarRig, DawMixer, Footer
- Mobile (375×812): same sections
- **900–1023px viewports** specifically (breakpoint shift from 900px → 1024px for `lg:`)

Verify the visual output matches expected design. Flag any layout regressions.

- [ ] **Step 3: Update visual baselines**

Visual regression snapshots will fail because all class names changed. Update them:
```bash
pnpm test:e2e --update-snapshots 2>&1 | tail -10
```

Or trigger the CI baseline regeneration workflow if running on Linux.

- [ ] **Step 4: Commit updated baselines**

```bash
git add tests/
git commit -m "chore(tests): regenerate visual regression baselines after Tailwind migration"
```

---

## Task 30: Full 5-agent review battery

- [ ] **Step 1: Check what changed**

```bash
git diff origin/main --stat | head -30
```

- [ ] **Step 2: Dispatch all 5 review agents in parallel**

Dispatch simultaneously:
1. `pr-review-toolkit:review-pr` — full diff review
2. `accessibility-tester` — a11y focus: check `md:hidden` / `hidden md:flex` patterns, verify aria attributes survived migration, check breakpoint 900–1023px layout for CLS risk
3. `security-auditor` — verify no security-adjacent files touched
4. `performance-engineer` — focus on: render-blocking CSS, 900→1024px breakpoint shift CLS risk, Tailwind bundle size vs prior 9.68KB gzip
5. `dependency-manager` — verify new deps (tailwindcss, postcss, clsx, tailwind-merge) are properly pinned

- [ ] **Step 3: Fix all Critical and Important findings**

- [ ] **Step 4: Re-run any agent that found Critical/Important issues**

- [ ] **Step 5: Run pnpm review:stamp**

```bash
pnpm review:stamp
```

Expected: writes HEAD SHA to `.review-passed`. This unblocks the pre-push hook.

- [ ] **Step 6: Push**

```bash
git push origin feat/tailwind-v4
```

---

## Task 31: Open PR

- [ ] **Step 1: Run pnpm ready-for-pr**

```bash
pnpm ready-for-pr 2>&1 | tail -20
```

Expected: all checks pass.

- [ ] **Step 2: Fill PR template**

```bash
cat .github/pull_request_template.md
```

Fill every section: Summary, Type of change, Test plan, Visual changes, Checklist.

- [ ] **Step 3: Create PR**

```bash
gh pr create --title "feat(tailwind): full Tailwind v4 migration — replace all 52 CSS modules" --body "$(cat /tmp/pr-body.md)"
```

- [ ] **Step 4: Validate PR body**

```bash
pnpm validate-pr-body $(gh pr view --json number -q .number)
```

Expected: exits 0.

- [ ] **Step 5: Watch for Copilot review**

Wait for Copilot auto-review. Address any threads. Re-request only after fixing Copilot-specific findings.
