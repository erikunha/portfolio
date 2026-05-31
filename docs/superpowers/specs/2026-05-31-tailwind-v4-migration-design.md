# Tailwind v4 Full Migration — Design Spec

**Date:** 2026-05-31
**Status:** Approved for implementation
**Branch:** new worktree from main (feat/tailwind-v4)

---

## ADR Reference

This spec reverses two prior decisions. Both are explicitly engaged in `DECISIONS.md` under the `2026-05-31` entry:

1. **2026-05-18 Tailwind removal** — all three removal reasons invalidated by v4.
2. **2026-05-23 Style Dictionary as reference-system artifact** — Tailwind v4 `@theme` supersedes SD as the superior reference artifact; SD JSON files retained as docs.

---

## Problem

The CSS system has 52 CSS module files, each containing raw `@media (max-width: 768px)` literals. There is no native CSS mechanism to use named breakpoints in this stack (Next.js 16 + Turbopack ignores `lightningCssFeatures`; `var()` is invalid inside `@media` conditions). The authoring friction of repeating raw pixel values is the core frustration.

The root fix is to adopt Tailwind v4 — the tool that solved this problem at the industry level via responsive prefixes (`sm:`, `md:`, `lg:`, `xl:`).

---

## Context: Why Tailwind Was Removed (2026-05-18)

Tailwind was present at scaffold but never used — zero utility classes, only `@import "tailwindcss"`. It was removed because:
- Zero usage: the import was dead weight
- ~2.25KB gzip of Preflight in the render-blocking bundle
- Forced `style-src 'unsafe-inline'` CSP via runtime style injection

**All three reasons are invalidated by Tailwind v4:**
- v4 only emits classes actually used in source files
- v4 has no runtime style injection — pure static extraction, no CSP issue
- v4 requires PostCSS (`@tailwindcss/postcss`) but Turbopack reads `postcss.config.mjs` cleanly

The codebase has also changed significantly since removal: CSS Modules co-location was adopted (2026-05-24), making a full Tailwind migration the logical next step.

---

## Approach: Utilities + `@layer components`

**Standard Tailwind utilities** handle all layout, spacing, color, responsive, and typography.

**`@layer components`** handles what utilities cannot express: CRT scanlines, phosphor text-shadow stacks, matrix rain, `@keyframes`, pseudo-element overlays, and complex multi-stop gradients.

**Component class + utilities** is the authoring pattern:
```tsx
// Semantic class for complex/unique CSS + Tailwind for everything standard
<div className="hero-panel relative border border-signal-subtle min-h-[640px] overflow-hidden mb-12 md:min-h-[520px]">
<ul className="grid grid-cols-1 md:grid-cols-3 gap-5 list-none p-0 m-0">
<span className="boot-cursor inline-block w-2 h-[1.05em] bg-signal align-[-2px] ml-0.5">
```

The component class is **optional** — only added when there is no utility equivalent.

---

## Section 1: Infrastructure

**New dependencies:**
```
pnpm add -D tailwindcss @tailwindcss/postcss postcss clsx tailwind-merge
```

**New files:**
- `postcss.config.mjs` — `{ plugins: { "@tailwindcss/postcss": {} } }`
- `lib/cn.ts` — `twMerge(clsx(...inputs))` composition utility
- `app/css/theme.css` — `@theme {}` brand tokens
- `app/css/base.css` — `@layer base {}` font-face, body, focus-visible
- `app/css/components.css` — `@layer components {}` CRT, animations, complex patterns

**`app/globals.css` becomes:**
```css
@import "tailwindcss";
@import "./css/theme.css";
@import "./css/base.css";
@import "./css/components.css";
```

**Removed:**
- `app/css/_base.css`
- `app/css/_breakpoints.css`
- `design-system/tokens/*.json` and Style Dictionary build pipeline
- All 52 `.module.css` files
- `scripts/lint-breakpoints.mjs`
- `scripts/lint-token-boundary.mjs`
- `scripts/lint-no-magic-values.mjs`

---

## Section 2: Token Migration

**Standard Tailwind breakpoints — no overrides:**

| Prefix | Value | Replaces |
|---|---|---|
| `sm:` | 640px | `--ds-bp-narrow` (was 560px — slight shift) |
| `md:` | 768px | `--ds-bp-mobile` (exact match) |
| `lg:` | 1024px | `--ds-bp-tablet` (was 900px — visual shift) |
| `xl:` | 1280px | `--ds-bp-wide` (was 1080px — slight shift) |

**Known visual trade-off:** layouts currently collapsing at 900px will collapse at 1024px. Viewports 900–1023px show the desktop layout. Acceptable in standard Tailwind mode.

**`@theme` — brand values only:**
```css
@theme {
  --color-signal:         #00FF41;
  --color-fg:             #E6FFE6;
  --color-surface:        #000000;
  --color-signal-subtle:  rgba(0, 255, 65, 0.15);
  --color-signal-quiet:   rgba(0, 255, 65, 0.08);
  --color-text-body:      #E6FFE6;
  --color-text-muted:     rgba(230, 255, 230, 0.45);
  --color-glow-03:        rgba(0, 255, 65, 0.03);
  --color-glow-04:        rgba(0, 255, 65, 0.04);
  --color-glow-05:        rgba(0, 255, 65, 0.05);
  --color-glow-06:        rgba(0, 255, 65, 0.06);
  --color-glow-15:        rgba(0, 255, 65, 0.15);
  --color-glow-18:        rgba(0, 255, 65, 0.18);
  --color-glow-25:        rgba(0, 255, 65, 0.25);
  --color-glow-30:        rgba(0, 255, 65, 0.30);
  --color-glow-35:        rgba(0, 255, 65, 0.35);
  --color-glow-40:        rgba(0, 255, 65, 0.40);
  --color-glow-45:        rgba(0, 255, 65, 0.45);
  --color-glow-50:        rgba(0, 255, 65, 0.50);
  --color-glow-55:        rgba(0, 255, 65, 0.55);
  --color-glow-60:        rgba(0, 255, 65, 0.60);
  --color-surface-panel:  rgba(0, 0, 0, 0.85);
  --font-mono:            'JetBrains Mono', monospace;
}
```

Standard Tailwind scale handles spacing (`p-4`, `p-6`, `gap-5`), typography (`text-sm`, `text-base`, `text-lg`), z-index (`z-10`, `z-50`), and duration (`duration-200`, `duration-300`).

Style Dictionary pipeline is removed entirely. `@theme` is the runtime source of truth.

---

## Section 3: CSS Architecture

```
app/
  globals.css                 ← entry: @import "tailwindcss" + 3 imports
  css/
    theme.css                 ← @theme { brand palette + font }
    base.css                  ← @layer base { font-face, body bg, focus-visible }
    components.css            ← @layer components { CRT, matrix, animations, @keyframes }
postcss.config.mjs            ← { "@tailwindcss/postcss": {} }
lib/
  cn.ts                       ← twMerge(clsx(...inputs))
```

**`@layer base` contains:**
- `@font-face` for JetBrains Mono (self-hosted)
- `body { background: #000000; color: #E6FFE6; font-family: var(--font-mono); }`
- `:focus-visible` outline using `--color-signal`
- `prefers-reduced-motion` base rules

**`@layer components` contains:**
- `.crt-panel` — scanlines, grain, RGB sub-pixel mask, flicker (pseudo-element overlays)
- `.crt-phosphor` / `.signal-glow` — phosphor text-shadow stacks
- `.scan-beam` — scanning beam animation
- `.boot-cursor` — blink keyframes
- `.matrix-rain` — canvas container positioning
- `.sysfail-headline` — fixed overlay with emergency z-index
- All `@keyframes` definitions
- `prefers-reduced-motion` and `body[data-motion="reduce"]` animation overrides

---

## Section 4: Component Migration Pattern

**Before:**
```tsx
import s from './ProjectsSection.module.css'
<ul className={s.root}>
  <li className={cn(s.project, isActive && s.projectActive)}>
```

**After:**
```tsx
// no import
<ul className="grid grid-cols-1 md:grid-cols-3 gap-5 list-none p-0 m-0">
  <li className={cn("project-card p-5 border border-signal-subtle transition-[border-color,box-shadow] duration-200", isActive && "border-signal")}>
```

**Desktop/mobile visibility:**
```tsx
// before: s.desktop (flex, hidden at mobile) / s.mobile (hidden, block at mobile)
<div className="hidden md:flex">   {/* desktop only */}
<div className="md:hidden">        {/* mobile only */}
```

**Rules:**
- Tailwind utilities carry: spacing, color, layout, responsive, typography, transitions
- Component class carries: pseudo-elements, `@keyframes`, complex box-shadow/gradient stacks
- Component class is optional — only added when utilities are insufficient
- All conditional classes use `cn()` from `lib/cn.ts`
- No CSS module imports anywhere in `.tsx` files

---

## Section 5: Lint Gates

**Removed** (Tailwind makes them redundant):
- `lint-breakpoints.mjs` — breakpoints enforced by Tailwind config
- `lint-token-boundary.mjs` — `@theme` is the boundary, no dynamic tokens
- `lint-no-magic-values.mjs` — Tailwind arbitrary values are intentional

**Kept:**
- `check-bundle-size.mjs` — re-calibrate threshold after first clean build
- `check-client-naming.mjs` — RSC/client island discipline unchanged
- `contrast-check` — a11y requirement unchanged
- `check:component-docs-coverage` — design system docs unchanged

**Gates that need rewriting** (not just removal — they depend on the deleted token pipeline):

- `contrast-check.mjs` currently reads `design-system/dist/tokens.json`. Must be rewritten to parse brand color values from `app/css/theme.css` (`@theme` block). The a11y contrast requirement (WCAG AA) is unchanged — only the input source changes.
- `design-system/tokens/__tests__/alpha.test.ts` asserts byte-identity against `dist/tokens.css`. Delete this test file — the SD pipeline that generated `dist/tokens.css` no longer exists. Color values are verified by the `@theme` source directly.

**Design system docs components that import token JSON** (compile errors if deleted without migration):

- `design-system/components/ColorSwatch/ColorSwatch.tsx` — imports `color.json`
- `design-system/components/SpacingRuler/SpacingRuler.tsx` — imports `space.json`
- `design-system/components/TypeSpecimen/TypeSpecimen.tsx` — imports `typography.json`

These three RSCs must be migrated to read their values from the `@theme` CSS file (parse the CSS custom properties at build time) or from a generated JSON artifact before `design-system/tokens/*.json` is deleted.

**New gate** — prevents CSS module regression:
```bash
# In CI: must return zero matches
grep -r "\.module\.css" --include="*.tsx" --include="*.ts" app components
```

---

## Section 6: Tests + Performance

**Tests:**
- Behavioral tests — unaffected (assert DOM behavior, not class names)
- Snapshot tests — regenerate after migration
- Visual regression baselines — full regeneration required (`playwright test --update-snapshots` on CI after PR lands)
- A11y tests — unaffected (semantic HTML unchanged)

**Performance:**
- CSS bundle threshold re-calibrated after first clean build (current: 9.68KB gzip)
- Lighthouse gates unchanged (perf ≥ 95, a11y = 100, BP ≥ 95, SEO = 100)
- **Explicit check:** Playwright visual at 900–1023px viewports for layout shift from `900px → 1024px` breakpoint change
- LCP and CLS re-verified post-migration via `pnpm gates:runtime`
- **`render-blocking-resources` mobile gate** — LHCI mobile asserts `maxLength: 3`. Tailwind emits its own stylesheet chunk; verify this gate passes after first build. If it crosses the limit, audit which stylesheets are blocking and address before merge.

---

## Migration Execution (Big Bang — One PR)

Logical order within the single PR:

1. Add deps, `postcss.config.mjs`, `lib/cn.ts`
2. Write `theme.css`, `base.css`, `components.css`
3. Update `globals.css` entry point
4. Migrate `ColorSwatch.tsx`, `SpacingRuler.tsx`, `TypeSpecimen.tsx` off `design-system/tokens/*.json` imports
5. Rewrite `contrast-check.mjs` to parse `app/css/theme.css` instead of `dist/tokens.json`
6. Delete `design-system/tokens/__tests__/alpha.test.ts`
7. Remove Style Dictionary pipeline + `design-system/tokens/*.json`
8. Convert all 52 `.tsx` component files — remove CSS module imports, apply utilities
9. Delete all 52 `.module.css` files
10. Remove `lint-breakpoints.mjs`, `lint-token-boundary.mjs`, `lint-no-magic-values.mjs`
11. Add no-module-css grep gate to CI
12. Run `pnpm ci:local` — fix all failures
13. Run `pnpm gates:runtime` — verify `render-blocking-resources` gate, re-calibrate bundle threshold, verify LCP/CLS
14. Regenerate visual baselines
15. Full 5-agent review battery before push
