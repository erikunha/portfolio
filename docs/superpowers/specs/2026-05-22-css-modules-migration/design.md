> **Status: Superseded by PR #80** — Tailwind v4 migration replaces the CSS module + Style Dictionary system described here. See `docs/superpowers/specs/2026-05-31-tailwind-v4-migration-design.md` and `DECISIONS.md` (2026-05-31 entry).

# CSS Modules Migration

**Date:** 2026-05-22
**Status:** Approved
**Scope:** Replace all hand-rolled global CSS (except tokens + base resets) with colocated CSS Modules following Next.js App Router conventions.

---

## Motivation

The current approach — 10 global CSS files aggregated through `globals.css` and manually inlined via `lib/inline-css.ts` — was the right call before CSS Modules were considered. Three problems it creates at the current codebase size:

1. **No dead code signal.** Orphaned selectors accumulate silently; no import graph, no compiler error.
2. **Navigation overhead.** `Hero.tsx` uses `.hero__name` but the rule lives in `_sections.css`. Two files, two mental contexts.
3. **Bespoke critical CSS machinery.** `lib/inline-css.ts` exists solely because `import './globals.css'` causes React 19 Float to emit a render-blocking `<link rel="stylesheet">`. CSS Modules solve this at the framework level — Next.js inlines module styles as `<style>` tags during SSR for server-rendered components. The custom minifier, file-reader, and layer-order comment become dead weight.

CSS Modules eliminate all three. They are also the documented Next.js App Router convention for component styles.

---

## What Changes

### `app/globals.css` — slimmed to truly global only

Keeps:
- `:root` custom properties (all CSS tokens)
- Element-level resets: `html`, `body`, `a`, `h1-h3`, `button`, form controls, media embeds, `::selection`, `.sr-only`, `.skip-to-content`

Removes: all `@import` lines except `_tokens.css` and `_base.css`. The `@layer` declaration is removed — cascade conflicts don't exist between scoped modules.

### `app/css/` — 8 of 10 files deleted

Survivors: `_tokens.css`, `_base.css`.

Deleted: `_crt.css`, `_layout.css`, `_sections.css`, `_chrome.css`, `_shell.css`, `_contact.css`, `_footer.css`, `_responsive.css`.

Their styles move to colocated CSS Module files (see inventory below).

### `lib/inline-css.ts` — deleted

Along with:
- The `import { INLINE_CSS }` line in `app/layout.tsx`
- The `<style>{INLINE_CSS}</style>` tag in `app/layout.tsx`
- `__tests__/inline-css.test.ts`

Next.js handles critical CSS for CSS Modules automatically.

### `app/layout.tsx`

Adds `import './globals.css'` (tokens + base). The existing font and metadata exports are unchanged.

---

## CSS Module Inventory

One `.module.css` per component, colocated in the same directory.

### `app/css/` survivors (global)
| File | Stays as |
|---|---|
| `_tokens.css` | `app/css/_tokens.css` (unchanged, imported by `globals.css`) |
| `_base.css` | `app/css/_base.css` (unchanged, imported by `globals.css`) |

### New module files
| Source CSS | Module file | Component |
|---|---|---|
| `_crt.css` | `components/responsive/CRTOverlay.module.css` | `CRTOverlay.client.tsx` |
| `_layout.css` (page container, section ordering) | `components/AppShell.module.css` | `AppShell.client.tsx` |
| `_sections.css` → Hero | `components/sections/Hero.module.css` | `Hero.tsx` |
| `_sections.css` → HeroStats | `components/HeroStats.module.css` | `HeroStats.tsx` |
| `_sections.css` → ManPage | `components/sections/ManPageSection.module.css` | `ManPageSection.tsx`, `ManPageDesktop.tsx`, `ManPageMobile.tsx` |
| `_sections.css` → Readme | `components/sections/ReadmeSection.module.css` | `ReadmeSection.tsx` |
| `_sections.css` → Projects | `components/sections/ProjectsSection.module.css` | `ProjectsSection.tsx` |
| `_sections.css` → GitLog | `components/sections/GitLogSection.module.css` | `GitLogSection.tsx` |
| `_sections.css` → NpmStack | `components/sections/NpmStackSection.module.css` | `NpmStackSection.tsx` |
| `_sections.css` → SysHealth | `components/sections/SysHealthSection.module.css` | `SysHealthSection.tsx` |
| `_sections.css` → LivePerf | `components/sections/LivePerfSection.module.css` | `LivePerfSection.tsx` |
| `_sections.css` → PerfReceipts | `components/sections/PerfReceiptsSection.module.css` | `PerfReceiptsSection.tsx` |
| `_sections.css` → AiMetrics | `components/sections/AiMetricsSection.module.css` | `AiMetricsSection.tsx` |
| `_sections.css` → Guitar | `components/sections/GuitarSection.module.css` | `GuitarSection.tsx` |
| `_sections.css` → Now | `components/sections/NowSection.module.css` | `NowSection.tsx` |
| `_sections.css` → Visa | `components/sections/VisaSection.module.css` | `VisaSection.tsx` |
| `_sections.css` → Credentials | `components/sections/CredentialsSection.module.css` | `CredentialsSection.tsx` |
| `_sections.css` → Community | `components/sections/CommunitySection.module.css` | `CommunitySection.tsx` |
| `_sections.css` → HottestTakes | `components/sections/HottestTakesSection.module.css` | `HottestTakesSection.tsx` |
| `_sections.css` → Responsibilities | `components/sections/ResponsibilitiesSection.module.css` | `ResponsibilitiesSection.tsx` |
| `_sections.css` → Unknowns | `components/sections/UnknownsSection.module.css` | `UnknownsSection.tsx` |
| `_layout.css` → Module wrapper | `components/responsive/Module.module.css` | `Module.tsx` |
| `_chrome.css` | `components/responsive/DesktopTopbar.module.css` | `DesktopTopbar.client.tsx` |
| `_chrome.css` | `components/responsive/Dock.module.css` | `Dock.client.tsx` |
| `_chrome.css` | `components/responsive/StatusBar.module.css` | `StatusBar.client.tsx` |
| `_chrome.css` | `components/responsive/MobileTitleBar.module.css` | `MobileTitleBar.client.tsx` |
| `_shell.css` | `components/client/InteractiveShell.module.css` | `InteractiveShell.tsx` |
| `_contact.css` (form styles) | `components/client/ContactForm.module.css` | `ContactForm.tsx` |
| `_contact.css` (section wrapper) | `components/sections/ContactSection.module.css` | `ContactSection.tsx` |
| `_footer.css` | `components/sections/Footer.module.css` | `Footer.client.tsx` |

---

## Class Naming Convention

Inside a module, the filename is the namespace. Drop the BEM block prefix.

```css
/* BEFORE: _sections.css */
.hero { }
.hero__name { }
.hero__tagline { }
.hero--desktop { }
.hero--mobile { }

/* AFTER: Hero.module.css */
.root { }
.name { }
.tagline { }
.desktop { }
.mobile { }
```

```tsx
// BEFORE
<section className="hero hero--desktop">
  <h1 className="hero__name">

// AFTER
import styles from './Hero.module.css';
<section className={styles.desktop}>
  <h1 className={styles.name}>
```

**Rules:**
- Use camelCase for multi-word names: `.statusDot`, `.ctaPrimary`
- Use `.root` for the outermost element of a component
- Modifiers are standalone classes applied alongside the base: `className={`${styles.root} ${styles.desktop}`}`
- No `clsx` dependency — template literals cover all existing patterns; none of the current class combinations are computed at runtime

---

## Cross-Cutting Selectors

Three cases where global selectors are unavoidable. Use `:global()` scoped tightly.

### Motion reduction (CRTOverlay.module.css)

```css
/* prefers-reduced-motion */
@media (prefers-reduced-motion: reduce) {
  .crtFlicker, .crtScanBeam, .crtNoise { animation: none; opacity: 0; }
}

/* runtime body attribute set by /init.js */
:global(body[data-motion="reduce"]) .crtFlicker,
:global(body[data-motion="reduce"]) .crtScanBeam,
:global(body[data-motion="reduce"]) .crtNoise {
  animation: none;
  opacity: 0;
}
```

### Section ordering (AppShell.module.css)

Mobile flex `order` rules target section IDs set in `page.tsx`:

```css
@media (max-width: 768px) {
  :global(#sec-readme) { order: 1; }
  :global(#sec-shell)  { order: 2; }
  /* ... all 18 sections */
}
```

### Mobile body clearance (AppShell.module.css)

```css
@media (max-width: 768px) {
  :global(body) { padding-bottom: calc(80px + env(safe-area-inset-bottom, 0px)); }
}
```

These three are the only `:global()` uses in the entire codebase. All others are eliminated by scoping.

---

## Responsive Strategy

`_responsive.css` is deleted. Each component owns its `@media` queries inside its module. Rules that override another component's styles are moved to the owning component's module. The `_layout.css` responsive overrides for `.page` move to `AppShell.module.css`.

---

## `@layer` Removal

The `@layer tokens, base, effects, layout, sections, ...` declaration in `globals.css` was a cascade management tool for global CSS. CSS Modules are scoped — specificity conflicts between components don't exist. Layers are removed from `globals.css` and from `_tokens.css` / `_base.css` (their `@layer base` / `@layer tokens` wrappers are unwrapped).

---

## Deleted Files

| File | Reason |
|---|---|
| `lib/inline-css.ts` | CSS Modules provide free SSR critical CSS inlining |
| `__tests__/inline-css.test.ts` | Tests a deleted module |
| `app/css/_crt.css` | Moved to `CRTOverlay.module.css` |
| `app/css/_layout.css` | Moved to `AppShell.module.css` + section modules |
| `app/css/_sections.css` | Split into per-section modules |
| `app/css/_chrome.css` | Split into per-chrome-component modules |
| `app/css/_shell.css` | Moved to `InteractiveShell.module.css` |
| `app/css/_contact.css` | Moved to `ContactForm.module.css` |
| `app/css/_footer.css` | Moved to `Footer.module.css` |
| `app/css/_responsive.css` | Distributed into each component module |

---

## Testing Impact

| Test file | Action |
|---|---|
| `__tests__/inline-css.test.ts` | Delete — module deleted |
| `__tests__/HeroStats.test.ts` | Update className assertions to use hashed module class names or `data-testid` |
| All other `__tests__/*.test.ts` | Check for hardcoded className string assertions; replace with `data-testid` where found |
| `tests/e2e/visual.spec.ts` | Baselines must be regenerated after migration (appearance unchanged, DOM class names change) |
| `tests/a11y/axe.spec.ts` | No change expected — a11y is semantic, not className-dependent |
| `tests/e2e/*.spec.ts` | Any selector using CSS class names must switch to `data-testid` or role-based selectors |

---

## Migration Sequence

Execute as a single PR. The site is either fully migrated or not — a half-migrated state (some global, some modules) risks cascade conflicts.

1. Slim `globals.css` to tokens + base only; remove `@layer` wrappers from `_tokens.css` and `_base.css`
2. Delete `lib/inline-css.ts`, remove its usage from `app/layout.tsx`; add `import './globals.css'`
3. Delete `__tests__/inline-css.test.ts`
4. Create all CSS Module files (one per component), transplanting styles from the source CSS files
5. Update every component's `.tsx` to import its module and use `styles.xxx`
6. Delete the 8 now-empty CSS source files
7. Regenerate visual regression baselines via `workflow_dispatch`
8. Verify Lighthouse gates pass (LCP, CLS, performance score)
