# CSS Modules Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace 8 of 10 hand-rolled global CSS files with colocated CSS Modules (one per component), keeping `_tokens.css` + `_base.css` as the only global stylesheets.

**Architecture:** Each component owns a colocated `*.module.css` file. Class names are scoped/hashed by Next.js; only three cross-cutting concerns use `:global()`. The migration runs component-by-component: each component gets its module created and its `.tsx` updated in the same task. `globals.css` keeps importing all 10 legacy files **until the final task** — this keeps the site continuously styled, because once a component's `.tsx` switches to `styles.*`, no element carries the old global class strings, so the legacy global rules go dead for that component with zero cascade conflict. The final task slims `globals.css`, deletes the 8 now-dead legacy files, and unwraps `@layer`.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Lightning CSS (via Turbopack), Vitest + jsdom, Playwright.

---

## Key Mechanics (read before starting)

1. **CSS Modules in Vitest/jsdom:** Vite identity-maps module class names in the test environment — `styles.foo` evaluates to the string `"foo"`. Tests that query rendered DOM by class must use the **new short name** (`.foo`) or a `data-testid`.
2. **`@keyframes` in modules:** A `@keyframes` block defined inside a `.module.css` file is scoped by Next.js; references to it *within the same file* are rewritten consistently. Keep keyframe **names** unchanged — only class **selectors** are renamed.
3. **`:global()`:** Escapes scoping. Used for exactly three things: CRT motion-reduction body attribute, section-ordering DOM ids, mobile body padding.
4. **Naming convention:** Drop the BEM block prefix. `.root` for a component's outermost element. camelCase for multi-word (`.statusDot`). Modifiers are standalone classes applied alongside the base via template literal: `` className={`${styles.root} ${styles.desktop}`} ``.
5. **`@keyframes blink` is undefined.** `.hero__status-dot` (in `_responsive.css`) and `.perf-foot .live-dot` (in `_sections.css`) reference `animation: blink ...` but no `@keyframes blink` exists anywhere in the codebase. This is a **pre-existing latent bug**. Preserve it exactly as-is — do **not** define `blink`. The migration changes class names, not behavior.
6. **Intermediate render-blocking:** From Task 1 until Task 15, `globals.css` is loaded via `import './globals.css'`, which React 19 Float emits as a render-blocking `<link>`. This is a known transient regression. Task 15 slims `globals.css` to tokens+base; component CSS modules are then inlined as `<style>` by Next during SSR. Lighthouse is verified only at Task 15 — do **not** treat intermediate Lighthouse numbers as gating.

---

## File Structure

### Files DELETED (10, all in Task 1 or Task 15)
| File | Task | Reason |
|---|---|---|
| `lib/inline-css.ts` | 1 | CSS Modules provide SSR critical-CSS inlining |
| `__tests__/inline-css.test.ts` | 1 | Tests a deleted module |
| `app/css/_crt.css` | 15 | → `CRTOverlay.module.css` |
| `app/css/_layout.css` | 15 | → `page.module.css` + `AppShell.module.css` + `Module.module.css` + `Hero.module.css` |
| `app/css/_sections.css` | 15 | → 17 per-section modules |
| `app/css/_chrome.css` | 15 | → 5 chrome-component modules |
| `app/css/_shell.css` | 15 | → `InteractiveShell.module.css` |
| `app/css/_contact.css` | 15 | → `ContactForm.module.css` |
| `app/css/_footer.css` | 15 | → `Footer.module.css` |
| `app/css/_responsive.css` | 15 | global bits → `_base.css`; component bits → component modules |

### Files SURVIVING as global
| File | Change |
|---|---|
| `app/css/_tokens.css` | Task 15: unwrap `@layer tokens { }` |
| `app/css/_base.css` | Task 15: unwrap `@layer base { }`, append global utilities + 900px token overrides |
| `app/globals.css` | Task 15: slim to 2 `@import`s, drop `@layer` line |

### Files CREATED (~33 `.module.css`)
Listed per task below.

---

### Task 1: Remove the inline-CSS machinery, wire up `globals.css`

**Files:**
- Delete: `lib/inline-css.ts`
- Delete: `__tests__/inline-css.test.ts`
- Modify: `app/layout.tsx`

**Context:** Currently *all* CSS ships through `lib/inline-css.ts`, which reads the 10 CSS files and inlines them as `<style>{INLINE_CSS}</style>` in `<head>`. `globals.css` is not imported anywhere as a Next CSS entry. This task switches to the standard `import './globals.css'` path. `globals.css` is left **unchanged** (still `@import`s all 10 files), so the site stays fully styled — just delivered through Next's CSS pipeline instead of the hand-rolled inliner.

- [ ] **Step 1: Delete the inliner and its test**

```bash
git rm lib/inline-css.ts __tests__/inline-css.test.ts
```

- [ ] **Step 2: Rewire `app/layout.tsx`**

Remove this import line (currently line 7):
```tsx
import { INLINE_CSS } from '@/lib/inline-css';
```
Add, as the first import in the file (above the `@vercel/analytics` import):
```tsx
import './globals.css';
```
In the `<head>`, remove the inlined style tag:
```tsx
        <style>{INLINE_CSS}</style>
```
The `<head>` keeps only the JSON-LD script:
```tsx
      <head>
        <script type="application/ld+json">{personJsonLd}</script>
      </head>
```

- [ ] **Step 3: Verify build + typecheck**

Run: `pnpm typecheck && pnpm build`
Expected: both PASS. No reference to `inline-css` remains (`grep -rn "inline-css" app lib __tests__` returns nothing).

- [ ] **Step 4: Verify the site renders styled**

Run: `pnpm dev`, open `http://localhost:3000`. Expected: the page looks identical to before — CRT overlay, lime-on-black sections, hero panel all styled. (CSS now arrives via a `<link rel="stylesheet">` instead of an inlined `<style>` — acceptable transient state, see Key Mechanics §6.)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(css): deliver globals.css via Next pipeline, drop inline-css inliner"
```

---

### Task 2: `page.module.css` — the page container

**Files:**
- Create: `app/page.module.css`
- Modify: `app/page.tsx`

**Context:** `app/page.tsx` renders `<main className="page" id="main-content">`. The `.page` rule (a flex column — its flex context is what makes mobile section `order` work) lives in `_layout.css` lines 5–29, split across the base rule, the 900px block, and the 768px block.

- [ ] **Step 1: Create `app/page.module.css`**

```css
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
```

- [ ] **Step 2: Update `app/page.tsx`**

Add to the import block:
```tsx
import styles from './page.module.css';
```
Change the `<main>` element:
```tsx
        <main className={styles.page} id="main-content" tabIndex={-1}>
```

- [ ] **Step 3: Verify**

Run: `pnpm typecheck && pnpm build`
Expected: PASS. In `pnpm dev`, the page container width/centering/padding is unchanged at desktop, 900px, and 768px widths.

- [ ] **Step 4: Commit**

```bash
git add app/page.module.css app/page.tsx
git commit -m "refactor(css): migrate page container to CSS module"
```

---

### Task 3: `Module.module.css` — the section panel shell

**Files:**
- Create: `components/responsive/Module.module.css`
- Modify: `components/responsive/Module.tsx`

**Context:** `Module.tsx` wraps every section in a `<details>` panel. Its CSS is `_layout.css` lines 619–816 (the `.module*` / `.cv-defer` rules, including the `@media (min-width: 769px)` desktop block). **Exclude** `#sec-man-page .module__body` (lines 814–816) — that moves to `ManPageSection.module.css` in Task 8.

**Rename table:**
| Legacy (`_layout.css`) | Module key |
|---|---|
| `.module` | `.root` |
| `.module__toggle` | `.toggle` |
| `.module__header` | `.header` |
| `.module__icon` | `.icon` |
| `.module__label` | `.label` |
| `.module__label--desktop` | `.labelDesktop` |
| `.module__label--mobile` | `.labelMobile` |
| `.module__chevron` | `.chevron` |
| `.module__body` | `.body` |
| `.cv-defer` | `.cvDefer` |

- [ ] **Step 1: Create `components/responsive/Module.module.css`**

Transplant `_layout.css` lines 619–812 (everything from the `MODULE` comment block through the close of the `@media (min-width: 769px)` block), applying the rename table. Notable transformed rules:

```css
.root {
  margin-bottom: var(--vrhythm);
  border: 1px solid var(--signal-dim);
  background: rgba(0, 0, 0, 0.55);
  overflow: hidden;
}

.header {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--signal);
  font-family: var(--font-mono-stack);
  font-size: var(--fs-xs);
  font-weight: 500;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  margin: 0;
}

.icon {
  display: inline-flex;
  width: 16px;
  height: 16px;
  align-items: center;
  justify-content: center;
  color: var(--signal);
}

.icon svg {
  width: 14px;
  height: 14px;
  stroke: currentColor;
  fill: none;
  stroke-width: 1.4;
}

.cvDefer {
  content-visibility: auto;
  contain-intrinsic-size: auto 520px;
}

.body {
  color: var(--fg);
}

.toggle {
  list-style: none;
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  padding: 12px 14px;
  min-height: 44px;
  background: rgba(0, 255, 65, 0.04);
  border-bottom: 1px solid var(--signal-dim-2);
  cursor: pointer;
}

.toggle::-webkit-details-marker {
  display: none;
}

.labelMobile {
  display: inline;
}
.labelDesktop {
  display: none;
}

.chevron {
  color: var(--signal);
  font-size: var(--fs-sm);
  transition: transform 120ms ease-out;
}

.root[open] .chevron {
  transform: rotate(90deg);
}

.root:not([open]) .body {
  display: none;
}

.root[open] .body {
  padding: var(--pad);
}

@media (min-width: 769px) {
  .root {
    border: 0;
    background: none;
    overflow: visible;
  }

  .toggle {
    display: block;
    padding: 0;
    min-height: 0;
    background: none;
    border-bottom: 0;
    cursor: default;
    margin-bottom: 10px;
  }

  .header {
    font-size: var(--fs-base);
    letter-spacing: 0.1em;
  }

  .labelDesktop {
    display: inline;
  }
  .labelMobile {
    display: none;
  }

  .chevron {
    display: none;
  }

  .root .body,
  .root:not([open]) .body,
  .root[open] .body {
    display: block;
    border: 1px solid var(--signal-dim);
    padding: var(--pad);
    background: linear-gradient(180deg, rgba(0, 255, 65, 0.015), rgba(0, 0, 0, 0));
    color: var(--fg);
  }
}
```

> **Note:** keep the explanatory comments from the source where they explain non-obvious behavior (the `cvDefer` `contain-intrinsic-size` rationale, the desktop-neutralization rationale). They are still accurate.

- [ ] **Step 2: Update `components/responsive/Module.tsx`**

Add import:
```tsx
import styles from './Module.module.css';
```
Replace the JSX class names. The `<details>` className currently is `` `module${defer ? ' cv-defer' : ''}` ``:
```tsx
    <details
      id={id}
      className={defer ? `${styles.root} ${styles.cvDefer}` : styles.root}
      open
    >
      <summary className={styles.toggle}>
        <h2 className={styles.header}>
          {icon ? (
            <span className={styles.icon} aria-hidden>
              {icon}
            </span>
          ) : null}
          <span className={`${styles.label} ${styles.labelDesktop}`}>{header}</span>
          <span className={`${styles.label} ${styles.labelMobile}`}>{mobileHeader ?? header}</span>
        </h2>
        <span className={styles.chevron} aria-hidden>
          ▸
        </span>
      </summary>
      <div className={styles.body} id={`${id}-body`}>
        {children}
      </div>
    </details>
```

> The `id={id}` and `id={`${id}-body`}` attributes are **unchanged** — section-ordering and the ManPage min-height rule depend on those global ids.

- [ ] **Step 3: Update `__tests__/content-visibility.test.ts`**

Two changes — the deferral class is now `cvDefer` (jsdom identity-maps `styles.cvDefer` → `"cvDefer"`), and the build-asset read must move from the deleted-later `_layout.css` to `Module.module.css`.

In the `Module renders the cv-defer class only when defer is set` test, change both string literals:
```ts
    expect(renderToStaticMarkup(deferredEl)).toContain('cvDefer');
    expect(renderToStaticMarkup(eagerEl)).not.toContain('cvDefer');
```

Replace the `_layout.css ships the .cv-defer content-visibility rule` test with:
```ts
  it('Module.module.css ships the cvDefer content-visibility rule', () => {
    // behavioral-test-allow: reads the shipped stylesheet build asset; jsdom cannot evaluate content-visibility
    const moduleCss = readFileSync(
      path.resolve(__dirname, '../components/responsive/Module.module.css'),
      'utf-8',
    );
    expect(moduleCss).toContain('.cvDefer');
    expect(moduleCss).toContain('content-visibility: auto');
    // Class-based selection replaced the brittle nth-of-type positional
    // selector — guard against a regression back to positional deferral.
    expect(moduleCss).not.toMatch(/nth-of-type\(n\s*\+\s*\d+\)/);
  });
```

Update the file's top doc comment where it references `.cv-defer` / `_layout.css` so it reads `.cvDefer` / `Module.module.css` (accuracy only — no behavior change). The `app/page.tsx defers every below-fold section` test is unaffected — leave it as-is.

- [ ] **Step 4: Verify**

Run: `pnpm typecheck && pnpm build && pnpm test -- content-visibility`
Expected: build PASS, all 3 `content-visibility` tests PASS. In `pnpm dev`: every section panel still renders with its border, header, chevron (mobile), and collapse behavior intact.

- [ ] **Step 5: Commit**

```bash
git add components/responsive/Module.module.css components/responsive/Module.tsx __tests__/content-visibility.test.ts
git commit -m "refactor(css): migrate Module panel shell to CSS module"
```

---

### Task 4: `AppShell.module.css` — section ordering + mobile body padding

**Files:**
- Create: `components/AppShell.module.css`
- Modify: `components/AppShell.client.tsx`

**Context:** Two cross-cutting global concerns from `_layout.css` lines 21–86: mobile flex `order` on the 18 section DOM ids, and `body` bottom-padding to clear the fixed dock. These target global ids / the `body` element, so the module file contains **only `:global()` rules** — no scoped classes. `AppShell.client.tsx` imports it for side effects. The `.desktop-only` / `.mobile-only` / `.skip-to-content` classes used in that component stay **global** (they live in `_base.css` / are added there in Task 15) — leave those className strings unchanged.

- [ ] **Step 1: Create `components/AppShell.module.css`**

```css
/* Cross-cutting layout rules. These target global DOM ids (set by Module.tsx
   via the section `id` prop) and the document body, so they cannot be scoped.
   The .page flex column (page.module.css) is what makes `order` effective. */

@media (max-width: 768px) {
  :global(#sec-readme) {
    order: 1;
  }
  :global(#sec-shell) {
    order: 2;
  }
  :global(#sec-man-page) {
    order: 3;
  }
  :global(#sec-now) {
    order: 4;
  }
  :global(#sec-projects) {
    order: 5;
  }
  :global(#sec-git-log) {
    order: 6;
  }
  :global(#sec-npm-stack) {
    order: 7;
  }
  :global(#sec-sys-health) {
    order: 8;
  }
  :global(#sec-live-perf) {
    order: 9;
  }
  :global(#sec-perf-receipts) {
    order: 10;
  }
  :global(#sec-guitar) {
    order: 11;
  }
  :global(#sec-visa) {
    order: 12;
  }
  :global(#sec-credentials) {
    order: 13;
  }
  :global(#sec-community) {
    order: 14;
  }
  :global(#sec-hottest-takes) {
    order: 15;
  }
  :global(#sec-responsibilities) {
    order: 16;
  }
  :global(#sec-unknowns) {
    order: 17;
  }
  :global(#sec-contact) {
    order: 18;
  }

  /* Clear space for the fixed mobile dock at the bottom of the viewport. */
  :global(body) {
    padding-bottom: calc(80px + env(safe-area-inset-bottom, 0px));
  }
}
```

- [ ] **Step 2: Update `components/AppShell.client.tsx`**

Add a side-effect import alongside the existing imports (it has no scoped classes to bind):
```tsx
import './AppShell.module.css';
```
Leave `className="desktop-only"`, `className="mobile-only"`, and `className="skip-to-content"` **unchanged** — they are global utilities.

- [ ] **Step 3: Verify**

Run: `pnpm typecheck && pnpm build`
Expected: PASS. In `pnpm dev` at ≤768px width: section visual order matches desktop DOM order, and the page bottom clears the dock.

- [ ] **Step 4: Commit**

```bash
git add components/AppShell.module.css components/AppShell.client.tsx
git commit -m "refactor(css): migrate section ordering + dock clearance to CSS module"
```

---

### Task 5: `CRTOverlay.module.css` — CRT effect layers

**Files:**
- Create: `components/responsive/CRTOverlay.module.css`
- Modify: `components/responsive/CRTOverlay.client.tsx`

**Context:** `_crt.css` (entire file). Three special handling points:
1. The `@media (prefers-reduced-motion)` and `body[data-motion="reduce"]` blocks (lines 138–156) list `.bar.pulse > i` and `.perf-foot .live-dot` — those are **not CRT elements**; they were grouped here for cascade convenience. **Drop them from this module.** SysHealth (Task 10) and LivePerf (Task 10) each get their own motion-reduction rule.
2. `_layout.css` lines 524–528 (`html.sysfail-on .crt-* { animation-play-state: paused }`) move **into this module** as `:global(html.sysfail-on)` rules.
3. Keep `@keyframes` names (`crt-noise-shift`, `crt-flicker`, `crt-scan-beam`) unchanged.

**Rename table:**
| Legacy | Module key |
|---|---|
| `.crt-vignette` | `.vignette` |
| `.crt-overlay` | `.overlay` |
| `.crt-mask` | `.mask` |
| `.crt-noise` | `.noise` |
| `.crt-flicker` | `.flicker` |
| `.crt-scan-beam` | `.scanBeam` |

- [ ] **Step 1: Create `components/responsive/CRTOverlay.module.css`**

Transplant `_crt.css` body (drop the `@layer effects { }` wrapper), apply the rename table. The motion-reduction blocks and the new sysfail block at the end:

```css
@media (prefers-reduced-motion: reduce) {
  .flicker,
  .scanBeam,
  .noise {
    animation: none;
    opacity: 0;
  }
}

body[data-motion="reduce"] .flicker,
body[data-motion="reduce"] .scanBeam,
body[data-motion="reduce"] .noise {
  animation: none;
  opacity: 0;
}

/* Freeze CRT animations while the sysfail plate is visible.
   html.sysfail-on is a global runtime class toggled by HeroSystemFailure. */
:global(html.sysfail-on) .scanBeam,
:global(html.sysfail-on) .flicker,
:global(html.sysfail-on) .noise {
  animation-play-state: paused;
}
```

> The `body[data-motion="reduce"] .flicker` form works because `body` is an element selector (global by nature in CSS Modules — element selectors are never scoped) and `.flicker` is the scoped class. No `:global()` wrapper is needed around `body[data-motion="reduce"]`. The `html.sysfail-on` form **does** need `:global()` because `.sysfail-on` is a class selector and would otherwise be scoped.

- [ ] **Step 2: Update `components/responsive/CRTOverlay.client.tsx`**

Add import:
```tsx
import styles from './CRTOverlay.module.css';
```
Update the returned JSX:
```tsx
  return (
    <>
      <div className={styles.vignette} aria-hidden />
      <div className={styles.overlay} aria-hidden />
      <div className={styles.mask} aria-hidden />
      <div className={styles.noise} aria-hidden />
      <div className={styles.flicker} aria-hidden />
      <div className={styles.scanBeam} aria-hidden />
    </>
  );
```

- [ ] **Step 3: Verify**

Run: `pnpm typecheck && pnpm build`
Expected: PASS. In `pnpm dev`: scanlines, sub-pixel mask, grain, flicker, and scan beam all render. Toggling MOTION off (DesktopTopbar) freezes the animations.

- [ ] **Step 4: Commit**

```bash
git add components/responsive/CRTOverlay.module.css components/responsive/CRTOverlay.client.tsx
git commit -m "refactor(css): migrate CRT overlay to CSS module"
```

---

### Task 6: `Hero.module.css` — hero panel, boot animation, sysfail plate

**Files:**
- Create: `components/sections/Hero.module.css`
- Modify: `components/sections/Hero.tsx`
- Modify: `components/client/HeroBootAnimation.tsx` (and any `*.client.tsx` variant it delegates to)
- Modify: `components/client/HeroSystemFailure.tsx`

**Context:** One shared module for the whole hero subsystem. Source CSS spans three files:
- `_layout.css` lines 284–580 (hero panel, bio, status, CTAs, boot tokens, sysfail headline) — **exclude** `.hero-stats*` (lines 582–617, Task 7) and **exclude** `html.sysfail-on .crt-*` (lines 524–528, already moved to CRT in Task 5).
- `_layout.css` lines 819–837 (`.hero--mobile` / `.hero--desktop` responsive toggle).
- `_responsive.css` lines 15–87 (`.hero__dialog`, `.hero__inner`, `.hero--mobile` mobile rules, `.hero__status`, `.hero__status-dot`) and lines 134–139 (`@media (max-width: 359px) .hero__status`).

**Rename table:**
| Legacy | Module key | | Legacy | Module key |
|---|---|---|---|---|
| `.hero` | `.root` | | `.boot__line` | `.bootLine` |
| `.hero.shake` | `.shake` | | `.boot__ok` | `.bootOk` |
| `.hero.shake-2` | `.shake2` | | `.boot__enc` | `.bootEnc` |
| `.hero--desktop` | `.desktop` | | `.boot__welcome` | `.bootWelcome` |
| `.hero--mobile` | `.mobile` | | `.boot__prompt` | `.bootPrompt` |
| `.hero__left` | `.left` | | `.boot__cmd` | `.bootCmd` |
| `.hero__boot` | `.boot` | | `.boot__matrix-prefix` | `.bootMatrixPrefix` |
| `.hero__bio` | `.bio` | | `.boot__matrix-out` | `.bootMatrixOut` |
| `.hero__name` | `.name` | | `.boot__cursor` | `.bootCursor` |
| `.hero__tagline` | `.tagline` | | `.hero__dialog` | `.dialog` |
| `.hero__meta` | `.meta` | | `.hero__inner` | `.inner` |
| `.hero__status` | `.status` | | `.hero__headline` | `.headline` |
| `.hero__status-dot` | `.statusDot` | | `.hero__headline.on` | `.headline.on` (compound) |
| `.hero__ctas` | `.ctas` | | `.hero__headline-plate` | `.headlinePlate` |
| `.hero__cta` | `.cta` | | | |
| `.hero__cta--primary` | `.ctaPrimary` | | | |
| `.hero__cta--secondary` | `.ctaSecondary` | | | |

Keep `@keyframes` names unchanged: `status-pulse`, `boot-blink`. The `.statusDot` mobile variant references `animation: blink ...` — **preserve that literal string** (see Key Mechanics §5; `blink` is intentionally undefined).

**`.on` state class:** `HeroSystemFailure` toggles the headline visibility with a separate `.on` class. Emit it as a standalone module class `.on` and apply both: `` className={`${styles.headline}${visible ? ` ${styles.on}` : ''}`} ``.

- [ ] **Step 1: Create `components/sections/Hero.module.css`**

Transplant the three source ranges, applying the rename table. Resolve the two `.hero__status` / `.hero__status-dot` definitions (one in `_layout.css` ~383–422, one in `_responsive.css` ~57–87) by keeping **both** in source order: `_layout.css` rules first, then `_responsive.css` rules — `_responsive.css` previously won via `@layer responsive`, so its rules must appear **after** the `_layout.css` ones in the module file to preserve the cascade. The `.hero--mobile` base rule (`_layout.css` 827 `display:none`) and the `_responsive.css` `.hero--mobile` block (min-height/position/overflow) likewise: `_layout.css` first, `_responsive.css` after.

Key transformed fragments:
```css
.root {
  position: relative;
  border: 1px solid var(--signal-dim);
  min-height: 640px;
  padding: 0;
  overflow: hidden;
  background: transparent;
  transition: transform 80ms ease-out;
  margin-bottom: var(--vrhythm);
}

.root.shake {
  transform: translate(2px, -2px);
}
.root.shake2 {
  transform: translate(-2px, 1px);
}

.desktop {
  display: flex;
}

.mobile {
  display: none;
}

@media (max-width: 768px) {
  .desktop {
    display: none;
  }
  .mobile {
    display: block;
  }
}
```

> The `.headline` rule uses `position: fixed` — unaffected by scoping. The `.statusDot` mobile rule keeps `animation: blink 1.4s steps(2, start) infinite;` verbatim.

- [ ] **Step 2: Update `components/sections/Hero.tsx`**

Add `import styles from './Hero.module.css';`. Apply the rename table to every `className`. Compound classes use template literals:
```tsx
      <section id="bio" className={`${styles.root} ${styles.desktop}`}>
        <div className={styles.left}>
          <HeroBootAnimation variant="desktop" />
        </div>
        <aside className={styles.bio}>
          <h1 className={styles.name}>Erik Henrique Alves Cunha</h1>
          <p className={styles.tagline}>{heroTagline}</p>
          <p className={styles.meta}>
            {/* ...inner <span>/<b> unchanged... */}
          </p>
          <p className={styles.status}>
            <span className={styles.statusDot} aria-hidden="true" />
            OPEN_TO_RELOCATION · WORLDWIDE
          </p>
          <HeroStats />
          <div className={styles.ctas}>
            <a className={`${styles.cta} ${styles.ctaPrimary}`} href="..." ...>EXEC HIRE</a>
            <a className={`${styles.cta} ${styles.ctaSecondary}`} href="..." ...>GITHUB ↗</a>
          </div>
        </aside>
        <HeroSystemFailure />
      </section>

      <section className={`${styles.root} ${styles.mobile}`}>
        <div className={styles.inner}>
          {/* ...apply table to all child classNames... */}
        </div>
      </section>
```
The `<b>` elements inside `.meta` are styled by descendant selector `.meta b` — already covered by the module, no className needed on `<b>`.

- [ ] **Step 3: Update `HeroBootAnimation.tsx` and `HeroSystemFailure.tsx`**

In each, add `import styles from '../sections/Hero.module.css';` (adjust relative path to the file's location). Apply the rename table to every `boot__*` / `hero__*` className. For `HeroSystemFailure`, the headline visibility:
```tsx
<div className={`${styles.headline}${visible ? ` ${styles.on}` : ''}`}>
  <span className={styles.headlinePlate}>{/* ... */}</span>
</div>
```
Find every importer with: `grep -rln "hero__\|boot__" components/`.

- [ ] **Step 4: Verify**

Run: `pnpm typecheck && pnpm build`
Expected: PASS. In `pnpm dev`: desktop hero (two-column, boot animation + bio), mobile hero (stacked), the boot typewriter animation, the status pill, CTAs, and the sysfail plate (trigger it) all render correctly.

- [ ] **Step 5: Commit**

```bash
git add components/sections/Hero.module.css components/sections/Hero.tsx components/client/HeroBootAnimation.tsx components/client/HeroSystemFailure.tsx
git commit -m "refactor(css): migrate hero subsystem to CSS module"
```

---

### Task 7: `HeroStats.module.css` — hero stat bar

**Files:**
- Create: `components/HeroStats.module.css`
- Modify: `components/HeroStats.tsx`
- Modify: `__tests__/HeroStats.test.ts`

**Context:** `.hero-stats*` rules from `_layout.css` lines 582–617 plus the `@media (max-width: 768px)` override from `_responsive.css` lines 160–172. `HeroStats.test.ts` currently selects by `.hero-stats__item` etc.; those become hashed module names in production but identity-mapped (`"item"`) in jsdom — switch the test to `data-testid`.

**Rename table:**
| Legacy | Module key |
|---|---|
| `.hero-stats` | `.root` |
| `.hero-stats__item` | `.item` |
| `.hero-stats__value` | `.value` |
| `.hero-stats__label` | `.label` |

- [ ] **Step 1: Create `components/HeroStats.module.css`**

```css
.root {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  border: 1px solid var(--signal-dim);
  margin-top: 12px;
}

.item {
  display: flex;
  flex-direction: column;
  padding: 7px 10px;
  border-right: 1px solid var(--signal-dim);
}

.item:last-child {
  border-right: none;
}

.value {
  color: var(--signal);
  font-size: var(--fs-sm);
  font-weight: 700;
  letter-spacing: 0.04em;
  font-family: var(--font-mono-stack);
  line-height: 1.3;
}

.label {
  color: var(--fg);
  font-size: var(--fs-2xs);
  letter-spacing: 0.08em;
  opacity: 0.65;
  font-family: var(--font-mono-stack);
  line-height: 1.3;
}

@media (max-width: 768px) {
  .root {
    grid-template-columns: repeat(2, 1fr);
  }

  .item:nth-child(2) {
    border-right: none;
  }

  .item:nth-child(1),
  .item:nth-child(2) {
    border-bottom: 1px solid var(--signal-dim);
  }
}
```

- [ ] **Step 2: Update `components/HeroStats.tsx`**

```tsx
import styles from './HeroStats.module.css';
import { heroStats } from '@/content/perf-receipts';

export function HeroStats() {
  return (
    <section className={styles.root} aria-label="Impact at scale" data-testid="hero-stats">
      {heroStats.map((stat) => (
        <div
          key={`${stat.value}|${stat.label}`}
          className={styles.item}
          data-testid="hero-stats-item"
        >
          <span className={styles.value} data-testid="hero-stats-value">
            {stat.value}
          </span>
          <span className={styles.label} data-testid="hero-stats-label">
            {stat.label}
          </span>
        </div>
      ))}
    </section>
  );
}
```

- [ ] **Step 3: Update `__tests__/HeroStats.test.ts`**

Replace every class selector with the matching `data-testid` selector:
```ts
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { HeroStats } from '@/components/HeroStats';
import { heroStats } from '@/content/perf-receipts';

function getDOM() {
  const html = renderToStaticMarkup(createElement(HeroStats));
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('HeroStats', () => {
  it('renders one item per heroStats entry', () => {
    const items = getDOM().querySelectorAll('[data-testid="hero-stats-item"]');
    expect(items).toHaveLength(heroStats.length);
  });

  it('each item renders a value element', () => {
    const values = getDOM().querySelectorAll('[data-testid="hero-stats-value"]');
    expect(values).toHaveLength(heroStats.length);
  });

  it('each item renders a label element', () => {
    const labels = getDOM().querySelectorAll('[data-testid="hero-stats-label"]');
    expect(labels).toHaveLength(heroStats.length);
  });

  it('first stat value matches heroStats[0].value', () => {
    const first = getDOM().querySelector('[data-testid="hero-stats-value"]');
    expect(first?.textContent).toBe(heroStats[0]?.value);
  });

  it('container carries aria-label for AT context', () => {
    const container = getDOM().querySelector('[data-testid="hero-stats"]');
    expect(container?.getAttribute('aria-label')).toBe('Impact at scale');
  });
});
```

- [ ] **Step 4: Verify**

Run: `pnpm typecheck && pnpm test -- HeroStats && pnpm build`
Expected: all 5 `HeroStats` tests PASS, build PASS. In `pnpm dev`: the 4-up stat bar renders below the hero bio (2x2 grid at ≤768px).

- [ ] **Step 5: Commit**

```bash
git add components/HeroStats.module.css components/HeroStats.tsx __tests__/HeroStats.test.ts
git commit -m "refactor(css): migrate hero stat bar to CSS module"
```

---

## Section Module Tasks (8–12) — shared procedure

Tasks 8–12 each migrate a group of section components. Every section module follows the **same procedure**, so it is stated once here:

1. **Create the module file** at the path in the task table. Transplant the CSS from the cited `app/css/_sections.css` line range, **dropping the `@layer sections { }` wrapper** (dedent by 2 spaces). Then append the section's responsive overrides from the `_layout.css` 768px block (cited per section) and any `_sections.css` mixed-block fragments (cited per section). Apply the rename table.
2. **Naming:** drop the BEM/abbrev block prefix, camelCase multi-word, `.root` for the section's outermost element. Each task table gives the full rename table — there are no judgement calls.
3. **Find importers:** `grep -rln "<legacy-prefix>" components/` — for dual-variant sections (ManPage, Projects, GitLog, Visa, Guitar) this returns the `XSection.tsx` plus `XDesktop.tsx` / `XMobile.tsx` variant files. **Every** file that uses the section's classes imports the **one** shared module (`import styles from './XSection.module.css'` — adjust relative path) and switches to `styles.*`.
4. **Descendant selectors stay intact:** rules like `.manpage pre` or `.gitfuller .g-hash` keep their element/child part; only the leading scoped class is renamed (`.manpage pre` → `.root pre`). Child color-token spans that are targeted purely by descendant selector (`.m-head`, `.g-hash`, `.tk-k`, …) **do** need a module class on the `<span>` if the TSX currently sets that class — apply the rename table to them too.
5. **Verify:** `pnpm typecheck && pnpm build`, then `pnpm dev` and visually confirm the section group renders unchanged at desktop + 768px. Commit per the task's commit line.

> **`@keyframes` note:** keyframes defined in `_sections.css` (`barpulse`) move into the owning module; the name stays `barpulse`. The undefined `blink` keyframe referenced by `.perf-foot .live-dot` is preserved verbatim (Key Mechanics §5).

---

### Task 8: Readme, ManPage, Now section modules

**Files — create:**
- `components/sections/ReadmeSection.module.css`
- `components/sections/ManPageSection.module.css`
- `components/sections/NowSection.module.css`

**Files — modify:** the `.tsx` files found via grep (step 3 above) for each section.

#### 8a. ReadmeSection

**Source:** `_sections.css` lines 268–381 (`.readme*`, `.pill`, `.codesample*`, `.tk-*`). **Responsive add:** `_layout.css` lines 89–92 (`.readme` 768px: `grid-template-columns: 28px 1fr; font-size: var(--fs-sm)`).

The `_sections.css` 768px block (309–316) sets `.readme { font-size: var(--fs-sm) }` and `.readme-codesample { display: none }`. Merge both 768px fragments into one block in the module:
```css
@media (max-width: 768px) {
  .root {
    grid-template-columns: 28px 1fr;
    font-size: var(--fs-sm);
  }
  .codeSampleWrap {
    display: none;
  }
}
```

**Rename table:**
| Legacy | Key | | Legacy | Key |
|---|---|---|---|---|
| `.readme` | `.root` | | `.codesample` | `.codeSample` |
| `.readme__gutter` | `.gutter` | | `.codesample__bar` | `.codeSampleBar` |
| `.readme__code` | `.code` | | `.codesample__pre` | `.codeSamplePre` |
| `.readme__row` | `.row` | | `.readme-codesample` | `.codeSampleWrap` |
| `.readme__row--h1` | `.rowH1` | | `.tk-c` | `.tkC` |
| `.readme__row--h2` | `.rowH2` | | `.tk-k` | `.tkK` |
| `.pill` | `.pill` | | `.tk-t` | `.tkT` |
| | | | `.tk-f` | `.tkF` |
| | | | `.tk-p` | `.tkP` |

> `.readme-codesample` and `.codesample` are **different** elements (a wrapper and the styled block) — keep the two distinct keys `.codeSampleWrap` / `.codeSample`. Descendant rule `.codesample__bar a` → `.codeSampleBar a` (the `<a>` needs no class).

#### 8b. ManPageSection

**Source:** `_sections.css` lines 8–124 (`.manpage*`, `.manpage--desktop`, `.manpage--mobile`, `.mp-*`).
**Cross-cutting add:** `_layout.css` lines 814–816 — `#sec-man-page .module__body { min-height: 300px }`. Module's `<div className={styles.body}>` carries `id="sec-man-page-body"`. Add to this module:
```css
:global(#sec-man-page-body) {
  min-height: 300px;
}
```

**Rename table:**
| Legacy | Key | | Legacy | Key |
|---|---|---|---|---|
| `.manpage` | `.root` | | `.mp-sec` | `.mpSec` |
| `.manpage--desktop` | `.desktop` | | `.mp-name` | `.mpName` |
| `.manpage--mobile` | `.mobile` | | `.mp-body` | `.mpBody` |
| `.m-head` | `.mHead` | | `.mp-opts` | `.mpOpts` |
| `.m-sec` | `.mSec` | | `.mp-flag` | `.mpFlag` |
| `.m-erik` | `.mErik` | | `.mp-desc` | `.mpDesc` |
| `.m-mute` | `.mMute` | | `.mp-examples` | `.mpExamples` |
| `.m-dim` | `.mDim` | | `.mp-ex-line` | `.mpExLine` |
| `.mp-head` | `.mpHead` | | `.mp-mute` | `.mpMute` |
| | | | `.mp-bugs` | `.mpBugs` |

> Compound desktop/mobile classes in the variant files (`manpage manpage--desktop`) → `` `${styles.root} ${styles.desktop}` ``.

#### 8c. NowSection

**Source:** `_sections.css` lines 383–408 (`.nowblock`, `.nrow`, `.nk`, `.nv`, incl. the 900px block).
**Responsive add:** `_sections.css` line 1312–1314 — inside the HottestTakes-area 768px block: `.nowblock { font-size: var(--fs-sm) }`. Add that as a `@media (max-width: 768px)` block in this module.

**Rename table:**
| Legacy | Key |
|---|---|
| `.nowblock` | `.root` |
| `.nrow` | `.row` |
| `.nk` | `.k` |
| `.nv` | `.v` |

> Descendant rules `.nowblock .nrow` → `.root .row`; `.nowblock .nk` → `.root .k`; etc.

- [ ] **Step 1:** Create `ReadmeSection.module.css` per 8a.
- [ ] **Step 2:** Create `ManPageSection.module.css` per 8b.
- [ ] **Step 3:** Create `NowSection.module.css` per 8c.
- [ ] **Step 4:** Update each section's `.tsx` files (grep per shared-procedure step 3). ManPage is dual-variant — update `ManPageSection.tsx`, `ManPageDesktop.tsx`, `ManPageMobile.tsx`.
- [ ] **Step 5:** Verify — `pnpm typecheck && pnpm build`; `pnpm dev` confirm Readme (editor gutter + code rows + codesample), ManPage (desktop pre + mobile variant, min-height holds the Suspense swap), and Now (k/v grid) render unchanged at desktop + 768px.
- [ ] **Step 6:** Commit:
```bash
git add components/sections/ReadmeSection.module.css components/sections/ManPageSection.module.css components/sections/NowSection.module.css components/sections/ReadmeSection.tsx components/sections/ManPage*.tsx components/sections/NowSection.tsx
git commit -m "refactor(css): migrate readme, manpage, now sections to CSS modules"
```

---

### Task 9: Projects, GitLog, NpmStack section modules

**Files — create:**
- `components/sections/ProjectsSection.module.css`
- `components/sections/GitLogSection.module.css`
- `components/sections/NpmStackSection.module.css`

#### 9a. ProjectsSection

**Source:** `_sections.css` lines 689–837 (`.projects`, `.project*` desktop tiles, `.proj*` mobile cards, `.mrow/.mk/.mv`).
**Responsive add:** `_layout.css` lines 229–242 — 768px: `.project { padding: 14px }`, `.project__folder { width:32px; height:26px }`, `.project__name { font-size: var(--fs-base) }`, `.project__desc { font-size: var(--fs-sm) }`.

**Rename table:**
| Legacy | Key | | Legacy | Key |
|---|---|---|---|---|
| `.projects` | `.root` | | `.proj` | `.card` |
| `.project` | `.project` | | `.proj-top` | `.cardTop` |
| `.project__top` | `.projectTop` | | `.proj-folder` | `.cardFolder` |
| `.project__folder` | `.projectFolder` | | `.proj-perm` | `.cardPerm` |
| `.project__perm` | `.projectPerm` | | `.proj-name` | `.cardName` |
| `.project__name` | `.projectName` | | `.proj-desc` | `.cardDesc` |
| `.project__desc` | `.projectDesc` | | `.proj-meta` | `.cardMeta` |
| `.project__stats` | `.projectStats` | | `.mrow` | `.mrow` |
| | | | `.mk` | `.mk` |
| | | | `.mv` | `.mv` |

> `.projects` (desktop grid) and `.proj` (mobile card) are distinct element families — keep `.root` for the desktop grid, `.card` for a mobile card. The selector `span.proj-folder svg` → `span.cardFolder svg` (or just `.cardFolder svg`).

#### 9b. GitLogSection

**Source:** `_sections.css` lines 839–928 (`.gitfuller`, `.gf-*`, `.g-*`, `.gitfuller--mobile`).

**Rename table:**
| Legacy | Key | | Legacy | Key |
|---|---|---|---|---|
| `.gitfuller` | `.root` | | `.g-graph` | `.gGraph` |
| `.gitfuller--mobile` | `.mobile` | | `.g-hash` | `.gHash` |
| `.gf-cmdbar` | `.cmdbar` | | `.g-deco` | `.gDeco` |
| `.gf-prompt` | `.prompt` | | `.g-label` | `.gLabel` |
| `.gf-end` | `.end` | | `.g-author` | `.gAuthor` |
| | | | `.g-date` | `.gDate` |
| | | | `.g-branch` | `.gBranch` |
| | | | `.g-msg` | `.gMsg` |
| | | | `.g-emp` | `.gEmp` |
| | | | `.g-body` | `.gBody` |

> Descendant rules `.gitfuller .gf-cmdbar` → `.root .cmdbar`, `.gitfuller pre` → `.root pre`, `.gitfuller--mobile pre` → `.mobile pre`, etc. Compound `gitfuller gitfuller--mobile` → `` `${styles.root} ${styles.mobile}` ``.

#### 9c. NpmStackSection

**Source:** `_sections.css` lines 624–687 (`.npm-stack`, incl. 900px / 768px / 340px blocks).
**Responsive add:** `_layout.css` lines 94–98 — 768px: `.npm-stack li { aspect-ratio: 1/1; font-size: var(--fs-2xs) }`. The `_sections.css` 768px block (672–681) already sets `.npm-stack { grid-template-columns: repeat(3,1fr); gap:8px }` and `.npm-stack li { aspect-ratio:1/1; font-size: var(--fs-2xs) }` — the `_layout.css` `li` rule duplicates it. Keep one merged 768px block (identical values).

**Rename table:**
| Legacy | Key |
|---|---|
| `.npm-stack` | `.root` |

> Only one class; tiles are styled by `.root li` / `.root li svg` / `.root li:hover` descendant selectors — `<li>`/`<svg>` need no class.

- [ ] **Step 1:** Create `ProjectsSection.module.css` per 9a.
- [ ] **Step 2:** Create `GitLogSection.module.css` per 9b.
- [ ] **Step 3:** Create `NpmStackSection.module.css` per 9c.
- [ ] **Step 4:** Update each section's `.tsx` files (grep). Projects + GitLog are dual-variant — update their `XDesktop.tsx` / `XMobile.tsx` too.
- [ ] **Step 5:** Verify — `pnpm typecheck && pnpm build`; `pnpm dev` confirm Projects (3-up tiles desktop / stacked cards mobile), GitLog (syntax-colored log), NpmStack (6-up → 3-up → 2-up grid) render unchanged.
- [ ] **Step 6:** Commit:
```bash
git add components/sections/ProjectsSection.module.css components/sections/GitLogSection.module.css components/sections/NpmStackSection.module.css components/sections/Projects*.tsx components/sections/GitLog*.tsx components/sections/NpmStackSection.tsx
git commit -m "refactor(css): migrate projects, gitlog, npm-stack sections to CSS modules"
```

---

### Task 10: SysHealth, LivePerf, AiMetrics, PerfReceipts section modules

**Files — create:**
- `components/sections/SysHealthSection.module.css`
- `components/sections/LivePerfSection.module.css`
- `components/sections/AiMetricsSection.module.css`
- `components/sections/PerfReceiptsSection.module.css`

#### 10a. SysHealthSection

**Source:** `_sections.css` lines 410–467 (`.stats`, `.stat`, `.bar`, `@keyframes barpulse`, incl. 900px block).
**Motion-reduction (from `_crt.css` 138–156):** `.bar.pulse > i` was grouped in the CRT motion blocks. Add its own motion rule to this module:
```css
@media (prefers-reduced-motion: reduce) {
  .bar.pulse > i {
    animation: none;
    opacity: 0;
  }
}

body[data-motion="reduce"] .bar.pulse > i {
  animation: none;
  opacity: 0;
}
```

**Rename table:**
| Legacy | Key |
|---|---|
| `.stats` | `.root` |
| `.stat` | `.stat` |
| `.slbl` | `.label` |
| `.sval` | `.value` |
| `.bar` | `.bar` |
| `.bar.pulse` | `.bar.pulse` (compound) |

> `.pulse` is emitted as a standalone module class. `.stat .slbl` → `.stat .label`. `@keyframes barpulse` moves here; name unchanged.

#### 10b. LivePerfSection

**Source:** `_sections.css` lines 469–538 (`.perf-row`, `.perf-cell*`, `.perf-foot`, `.live-dot`, incl. 900px block).
**Responsive add:** `_layout.css` lines 152–177 — 768px: `.perf-row { gap:10px }`, `.perf-cell .pk`, `.perf-cell .pv`, `.perf-cell .pv .of`, `.perf-cell .pbar`, `.perf-foot`, `.perf-foot .live-dot`.
**Motion-reduction (from `_crt.css` 138–156):** `.perf-foot .live-dot` was grouped in CRT motion blocks. Add:
```css
@media (prefers-reduced-motion: reduce) {
  .foot .liveDot {
    animation: none;
    opacity: 0;
  }
}

body[data-motion="reduce"] .foot .liveDot {
  animation: none;
  opacity: 0;
}
```

**Rename table:**
| Legacy | Key |
|---|---|
| `.perf-row` | `.root` |
| `.perf-cell` | `.cell` |
| `.pk` | `.pk` |
| `.pv` | `.pv` |
| `.of` | `.of` |
| `.pbar` | `.pbar` |
| `.perf-foot` | `.foot` |
| `.live-dot` | `.liveDot` |

> `.live-dot` keeps `animation: blink 1.6s steps(2, start) infinite;` verbatim — `blink` is the undefined keyframe (Key Mechanics §5). Descendant selectors: `.perf-cell .pk` → `.cell .pk`, `.perf-foot .live-dot` → `.foot .liveDot`.

#### 10c. AiMetricsSection

**Source:** `_sections.css` lines 540–622 (`.aimetrics*`, `.aimetric*`, incl. 900px + 768px blocks).

**Rename table:**
| Legacy | Key |
|---|---|
| `.aimetrics` | `.root` |
| `.aimetrics__grid` | `.grid` |
| `.aimetrics__foot` | `.foot` |
| `.aimetrics__gt` | `.gt` |
| `.aimetrics__pending` | `.pending` |
| `.aimetric` | `.metric` |
| `.aimetric__label` | `.label` |
| `.aimetric__value` | `.value` |
| `.aimetric__note` | `.note` |

> `.aimetrics__pending code` → `.pending code` (the `<code>` needs no class).

#### 10d. PerfReceiptsSection

**Source:** `_sections.css` lines 930–1052 (`.receipts`, `.receipt*`, incl. the 900px blocks and the 768px block 1036–1052).
**⚠️ Mixed 768px block:** the `_sections.css` 768px block at lines 1036–1052 contains a `.visa-foot` rule (1047–1051) that belongs to **VisaSection**, not here. **Exclude `.visa-foot` from this module** — it is handled in Task 11 (Visa).
**Responsive add:** `_layout.css` lines 204–227 — 768px: `.receipts`, `.receipt`, `.receipt__metric`, `.receipt__note`, `.receipt.receipt--desktop-only { display:none }`, `.receipt__metric-mobile { display:inline }`, `.receipt__metric-desktop { display:none }`.

**Rename table:**
| Legacy | Key |
|---|---|
| `.receipts` | `.root` |
| `.receipt` | `.receipt` |
| `.receipt--hero` | `.receiptHero` |
| `.receipt--desktop-only` | `.receiptDesktopOnly` |
| `.receipt__metric` | `.metric` |
| `.receipt__metric-mobile` | `.metricMobile` |
| `.receipt__metric-desktop` | `.metricDesktop` |
| `.receipt__delta` | `.delta` |
| `.receipt__delta--hero` | `.deltaHero` |
| `.receipt__company` | `.company` |
| `.receipt__note` | `.note` |

> Compound selectors: `.receipt.receipt--desktop-only` → `.receipt.receiptDesktopOnly`; `.receipt--hero .receipt__note` → `.receiptHero .note`; `.receipt--hero .receipt__delta--hero` → `.receiptHero .deltaHero`. In TSX, `receipt receipt--hero` → `` `${styles.receipt} ${styles.receiptHero}` ``.

- [ ] **Step 1:** Create `SysHealthSection.module.css` per 10a.
- [ ] **Step 2:** Create `LivePerfSection.module.css` per 10b.
- [ ] **Step 3:** Create `AiMetricsSection.module.css` per 10c.
- [ ] **Step 4:** Create `PerfReceiptsSection.module.css` per 10d.
- [ ] **Step 5:** Update each section's `.tsx` files (grep).
- [ ] **Step 6:** Verify — `pnpm typecheck && pnpm build`; `pnpm dev` confirm SysHealth (4-up stat tiles, pulsing bars; bars freeze under MOTION off), LivePerf (Lighthouse scores, live dot), AiMetrics (eval tiles), PerfReceipts (4-col grid, hero tile spans 2x2) render unchanged at desktop + 768px.
- [ ] **Step 7:** Commit:
```bash
git add components/sections/SysHealthSection.module.css components/sections/LivePerfSection.module.css components/sections/AiMetricsSection.module.css components/sections/PerfReceiptsSection.module.css components/sections/SysHealth*.tsx components/sections/LivePerf*.tsx components/sections/AiMetrics*.tsx components/sections/PerfReceipts*.tsx
git commit -m "refactor(css): migrate sys-health, live-perf, ai-metrics, perf-receipts sections to CSS modules"
```

---

### Task 11: Guitar, Visa, Credentials section modules

**Files — create:**
- `components/sections/GuitarSection.module.css`
- `components/sections/VisaSection.module.css`
- `components/sections/CredentialsSection.module.css`

**Shared container `.visa`:** `_sections.css` lines 126–129 document that `.visa` (`{ overflow-x: auto }` + `.visa pre { ... }`, lines 130–140) is a **pre-container shared by all three sections**. CSS Modules cannot share a scoped class across files, so **replicate** the container as `.root` (and `.root pre`) in **each** of the three modules that renders it. First grep each component (`grep -ln "className=\"visa\"" components/sections/`) to confirm which sections render the `.visa` wrapper; replicate `.root` only into those.

#### 11a. GuitarSection

**Source:** `_sections.css` lines 250–266 (`.gr-*`), line 189–191 (`pre.guitar-mobile`), plus the shared `.visa` container (130–140) replicated as `.root` if Guitar renders it.

**Rename table:**
| Legacy | Key |
|---|---|
| `.visa` (container) | `.root` |
| `.gr-label` | `.grLabel` |
| `.gr-val` | `.grVal` |
| `.gr-comment` | `.grComment` |
| `.gr-num` | `.grNum` |
| `.gr-name` | `.grName` |
| `pre.guitar-mobile` | `pre.guitarMobile` |

#### 11b. VisaSection

**Source:** `_sections.css` lines 130–198 (`.visa` container + `.vh/.vrule/.vjur/.vstat/.vev`, `.visa-foot`, `.vm-grid/.vm-row/.vm-right`, `.visa .cmd-line`).
**Responsive add:**
- `_layout.css` lines 194–202 — 768px: `.visa pre { font-size: var(--fs-xs); line-height:1.7; white-space:pre-wrap; overflow-wrap:break-word }`, `.visa-foot { font-size: var(--fs-xs) }`.
- `_sections.css` lines 1047–1051 — the `.visa-foot` rule embedded in the PerfReceipts 768px block (excluded from Task 10): `.visa-foot { font-size: var(--fs-2xs); white-space:nowrap; overflow:hidden }`. Both 768px `.visa-foot` fragments target the same breakpoint; place the `_sections.css` fragment **after** the `_layout.css` fragment (it previously won via the later `sections` layer) so `font-size: var(--fs-2xs)` is the effective value.

**Rename table:**
| Legacy | Key | | Legacy | Key |
|---|---|---|---|---|
| `.visa` (container) | `.root` | | `.vm-grid` | `.vmGrid` |
| `.vh` | `.vh` | | `.vm-row` | `.vmRow` |
| `.vrule` | `.vrule` | | `.vm-right` | `.vmRight` |
| `.vjur` | `.vjur` | | `.cmd-line` | `.cmdLine` |
| `.vstat` | `.vstat` | | `.pr` | `.pr` |
| `.vev` | `.vev` | | `.visa-foot` | `.foot` |

> `.visa .cmd-line` → `.root .cmdLine`; `.visa .cmd-line .pr` → `.root .cmdLine .pr`; `.vm-row .vjur` → `.vmRow .vjur`.

#### 11c. CredentialsSection

**Source:** `_sections.css` lines 199–248 (`.cr-table/.cr-row/.cr-label/.cr-badge/.cr-val`, incl. the 768px block 229–248), plus the shared `.visa` container replicated as `.root` if Credentials renders it.

**Rename table:**
| Legacy | Key |
|---|---|
| `.visa` (container) | `.root` |
| `.cr-table` | `.table` |
| `.cr-row` | `.row` |
| `.cr-label` | `.label` |
| `.cr-badge` | `.badge` |
| `.cr-val` | `.val` |

- [ ] **Step 1:** Create `GuitarSection.module.css` per 11a.
- [ ] **Step 2:** Create `VisaSection.module.css` per 11b.
- [ ] **Step 3:** Create `CredentialsSection.module.css` per 11c.
- [ ] **Step 4:** Update each section's `.tsx` files (grep). Guitar + Visa are dual-variant — update their `XDesktop.tsx` / `XMobile.tsx` too.
- [ ] **Step 5:** Verify — `pnpm typecheck && pnpm build`; `pnpm dev` confirm Guitar rig, Visa timeline (desktop pre + mobile `vm-grid`, footer truncates on mobile), Credentials table render unchanged at desktop + 768px.
- [ ] **Step 6:** Commit:
```bash
git add components/sections/GuitarSection.module.css components/sections/VisaSection.module.css components/sections/CredentialsSection.module.css components/sections/Guitar*.tsx components/sections/Visa*.tsx components/sections/CredentialsSection.tsx
git commit -m "refactor(css): migrate guitar, visa, credentials sections to CSS modules"
```

---

### Task 12: Community, HottestTakes, Responsibilities, Unknowns section modules

**Files — create:**
- `components/sections/CommunitySection.module.css`
- `components/sections/HottestTakesSection.module.css`
- `components/sections/ResponsibilitiesSection.module.css`
- `components/sections/UnknownsSection.module.css`

#### 12a. CommunitySection

**Source:** `_sections.css` lines 1054–1096 (`.community*`).
**Responsive add:** `_layout.css` lines 121–130 — 768px: `.community { font-size: var(--fs-sm) }`, `.community .ctitle { font-size: var(--fs-base) }`, `.community .cstatus { font-size: var(--fs-xs) }`. The `_sections.css` 768px fragment (1306–1308) also sets `.community { font-size: var(--fs-sm) }` — identical, merge into one block.

**Rename table:**
| Legacy | Key |
|---|---|
| `.community` | `.root` |
| `.ctitle` | `.title` |
| `.cstatus` | `.status` |
| `.gt` | `.gt` |

> Descendant rules `.community .ctitle` → `.root .title`; `.community li::before` → `.root li::before` (`<ul>`/`<li>` need no class); `.community .cstatus .gt` → `.root .status .gt`.

#### 12b. HottestTakesSection

**Source:** `_sections.css` lines 1198–1304 (`.takes*`, `.take*`, incl. the 900px block 1298–1303). Plus the `.take__body` rule from the 768px block at line 1315–1317.
**⚠️ Drop the `.module__body` ancestor:** `_sections.css` lines 1218–1221 and 1232–1235 are `.module__body .takes__preamble .gt { ... }` and `.module__body .takes__footer .gt { ... }`. `.module__body` is now a scoped class in `Module.module.css` and cannot be referenced cross-module. HottestTakes owns `.preamble`/`.footer` exclusively, so **drop the `.module__body` qualifier**:
```css
.preamble .gt {
  color: var(--signal);
  margin-right: 6px;
}
.footer .gt {
  color: var(--signal);
  margin-right: 6px;
}
```
**Responsive add:** `_layout.css` lines 100–119 — 768px: `.take { grid-template-columns: 28px 1fr; padding: 10px 0 }`, `.take__num`, `.take__thesis`, `.take__body`, `.take__category`, `.takes__footer`. Plus `_sections.css` line 1315–1317 — 768px `.take__body { font-size: var(--fs-sm) }`. Merge all 768px `.take*` fragments into one block.

**Rename table:**
| Legacy | Key |
|---|---|
| `.takes` | `.root` |
| `.takes__preamble` | `.preamble` |
| `.takes__footer` | `.footer` |
| `.take` | `.take` |
| `.take__num` | `.num` |
| `.take__content` | `.content` |
| `.take__category` | `.category` |
| `.take__thesis` | `.thesis` |
| `.take__body` | `.body` |
| `.gt` | `.gt` |

> `.take:last-child` / `.take:first-of-type` → `.take:last-child` / `.take:first-of-type`.

#### 12c. ResponsibilitiesSection

**Source:** `_sections.css` lines 1098–1162 (`.permatrix*`, incl. 900px block).
**Responsive add:** `_layout.css` lines 132–143 — 768px: `.permatrix pre { font-size: var(--fs-xs); white-space:pre-wrap; overflow-wrap:break-word }`, `.permatrix .pm-cmd { font-size: var(--fs-xs) }`, `.permatrix .pm-foot { font-size: var(--fs-xs) }`. The `_sections.css` 900px block (1155–1162) already sets `.permatrix pre` / `.permatrix .pm-foot` — keep both, distinct breakpoints.

**Rename table:**
| Legacy | Key |
|---|---|
| `.permatrix` | `.root` |
| `.pm-cmd` | `.cmd` |
| `.pm-perm` | `.perm` |
| `.pm-user` | `.user` |
| `.pm-group` | `.group` |
| `.pm-file` | `.file` |
| `.pm-foot` | `.foot` |
| `.pm-k` | `.k` |
| `.gt` | `.gt` |

> Compound `.pm-file.crit` → `.file.crit` (emit `.crit` as a standalone class). `.permatrix .pm-cmd .gt` → `.root .cmd .gt`; `.permatrix .pm-foot .pm-k` → `.root .foot .k`.

#### 12d. UnknownsSection

**Source:** `_sections.css` lines 1164–1196 (`.unknowns*`).
**Responsive add:** `_layout.css` lines 145–150 — 768px: `.unknowns pre { font-size: var(--fs-xs); white-space:pre-wrap; overflow-wrap:break-word }`. The `_sections.css` 768px fragment (1309–1311) sets `.unknowns pre { font-size: var(--fs-sm) }` — both target 768px `.unknowns pre`; place the `_sections.css` fragment **after** the `_layout.css` one (later `sections` layer won previously), so `font-size: var(--fs-sm)` is effective and `white-space`/`overflow-wrap` from the `_layout.css` fragment still apply.

**Rename table:**
| Legacy | Key |
|---|---|
| `.unknowns` | `.root` |
| `.uk-cmd` | `.cmd` |
| `.uk-h` | `.h` |
| `.uk-mute` | `.mute` |
| `.uk-bul` | `.bul` |
| `.uk-open` | `.open` |
| `.gt` | `.gt` |

> `.unknowns pre` → `.root pre`; `.unknowns .uk-cmd .gt` → `.root .cmd .gt`.

- [ ] **Step 1:** Create `CommunitySection.module.css` per 12a.
- [ ] **Step 2:** Create `HottestTakesSection.module.css` per 12b.
- [ ] **Step 3:** Create `ResponsibilitiesSection.module.css` per 12c.
- [ ] **Step 4:** Create `UnknownsSection.module.css` per 12d.
- [ ] **Step 5:** Update each section's `.tsx` files (grep).
- [ ] **Step 6:** Verify — `pnpm typecheck && pnpm build`; `pnpm dev` confirm Community (bullet list), HottestTakes (numbered claims, `.gt` markers in preamble/footer still lime), Responsibilities (permissions matrix), Unknowns (pre panel) render unchanged at desktop + 768px.
- [ ] **Step 7:** Commit:
```bash
git add components/sections/CommunitySection.module.css components/sections/HottestTakesSection.module.css components/sections/ResponsibilitiesSection.module.css components/sections/UnknownsSection.module.css components/sections/CommunitySection.tsx components/sections/HottestTakesSection.tsx components/sections/ResponsibilitiesSection.tsx components/sections/UnknownsSection.tsx
git commit -m "refactor(css): migrate community, hottest-takes, responsibilities, unknowns sections to CSS modules"
```

---

### Task 13: Chrome component modules

**Files — create:**
- `components/responsive/DesktopTopbar.module.css`
- `components/responsive/StatusBar.module.css`
- `components/responsive/Dock.module.css`
- `components/responsive/MobileTitleBar.module.css`
- `components/client/ToTopButton.module.css`

**Files — modify:** `DesktopTopbar.client.tsx`, `StatusBar.client.tsx`, `Dock.client.tsx`, `MobileTitleBar.client.tsx`, `ToTopButton.tsx` (confirm exact paths via `grep -rln "topbar\|statusbar\|window-chrome\|\\bdock\\b\|totop" components/`).

Same procedure as the section tasks: transplant the cited source range, drop the `@layer` wrapper, apply the rename table, attribute selectors (`[data-motion="off"]`) and element/child selectors stay intact.

#### 13a. DesktopTopbar

**Source:** `_chrome.css` lines 5–162 (drop `@layer chrome { }`). Keep the `@media (max-width: 1080px)` and `@media (max-width: 768px)` blocks.

**Rename table:**
| Legacy | Key | | Legacy | Key |
|---|---|---|---|---|
| `.topbar` | `.root` | | `.topbar__nav` | `.nav` |
| `.topbar-inner` | `.inner` | | `.topbar__navlink` | `.navlink` |
| `.topbar__dots` | `.dots` | | `.topbar__motion` | `.motion` |
| `.topbar__dot` | `.dot` | | `.topbar__mdot` | `.mdot` |
| `.topbar__dot--red` | `.dotRed` | | `.topbar__btn-primary` | `.btnPrimary` |
| `.topbar__dot--yellow` | `.dotYellow` | | `.topbar__btn-outline` | `.btnOutline` |
| `.topbar__dot--green` | `.dotGreen` | | `.topbar__tabs` | `.tabs` |
| `.topbar__tab` | `.tab` | | `.topbar__tab--active` | `.tabActive` |
| `.topbar__tab-close` | `.tabClose` | | | |

> `.topbar__motion[data-motion="off"] .topbar__mdot` → `.motion[data-motion="off"] .mdot`.

#### 13b. StatusBar

**Source:** `_chrome.css` lines 167–261.

**Rename table:**
| Legacy | Key | | Legacy | Key |
|---|---|---|---|---|
| `.statusbar` | `.root` | | `.statusbar__signal` | `.signal` |
| `.statusbar__left` | `.left` | | `.statusbar__cell` | `.cell` |
| `.statusbar__time` | `.time` | | `.statusbar__battery` | `.battery` |
| `.statusbar__carrier` | `.carrier` | | `.statusbar__battery-num` | `.batteryNum` |
| `.statusbar__right` | `.right` | | `.statusbar__battery-box` | `.batteryBox` |

> `.statusbar__signal i`, `.statusbar__battery-box::after`, `.statusbar__battery-box i` keep their element/pseudo part: `.signal i`, `.batteryBox::after`, `.batteryBox i`.

#### 13c. Dock

**Source:** `_chrome.css` lines 263–308.

**Rename table:**
| Legacy | Key |
|---|---|
| `.dock` | `.root` |
| `.dock a.active` (the `active` class) | `.active` |

> Dock links are styled purely by descendant selectors — `.dock a` → `.root a`, `.dock a svg` → `.root a svg`, `.dock a:active` → `.root a:active`. The active-link rule `.dock a.active` → `.root a.active`; in TSX the active `<a>` gets `className={isActive ? styles.active : undefined}`.

#### 13d. MobileTitleBar

**Source:** `_responsive.css` lines 90–131 (`.window-chrome*` — note this is in `_responsive.css`, not `_chrome.css`).

**Rename table:**
| Legacy | Key |
|---|---|
| `.window-chrome` | `.root` |
| `.window-chrome__dots` | `.dots` |
| `.window-chrome__dot` | `.dot` |
| `.window-chrome__dot--red` | `.dotRed` |
| `.window-chrome__dot--yellow` | `.dotYellow` |
| `.window-chrome__dot--green` | `.dotGreen` |
| `.window-chrome__title` | `.title` |

#### 13e. ToTopButton

**Source:** `_chrome.css` lines 313–352 (`.totop`, the `@media (max-width: 768px)` block with `.totop.show` and `button.totop svg`).

**Rename table:**
| Legacy | Key |
|---|---|
| `.totop` | `.root` |
| `.totop.show` (the `show` class) | `.show` |

> `.totop` (base) `display: none`; the 768px block shows it. `.totop.show` → `.root.show`; `button.totop svg` → `.root svg`. In TSX the button gets `className={visible ? `${styles.root} ${styles.show}` : styles.root}`.

- [ ] **Step 1–5:** Create the five module files per 13a–13e.
- [ ] **Step 6:** Update the five `.client.tsx` / `.tsx` files — add `import styles from './X.module.css'`, apply rename tables.
- [ ] **Step 7:** Verify — `pnpm typecheck && pnpm build`; `pnpm dev` confirm at desktop width: topbar (dots, tabs, nav, MOTION toggle, buttons); at ≤768px: status bar, mobile title bar, dock (active state), and the back-to-top button (scroll to reveal it).
- [ ] **Step 8:** Commit:
```bash
git add components/responsive/DesktopTopbar.module.css components/responsive/StatusBar.module.css components/responsive/Dock.module.css components/responsive/MobileTitleBar.module.css components/client/ToTopButton.module.css components/responsive/DesktopTopbar.client.tsx components/responsive/StatusBar.client.tsx components/responsive/Dock.client.tsx components/responsive/MobileTitleBar.client.tsx components/client/ToTopButton.tsx
git commit -m "refactor(css): migrate chrome components to CSS modules"
```

---

### Task 14: InteractiveShell, ContactForm, Footer modules

**Files — create:**
- `components/client/InteractiveShell.module.css`
- `components/client/ContactForm.module.css`
- `components/sections/Footer.module.css`

**Files — modify:** `InteractiveShell.tsx`, `ContactForm.tsx`, `Footer.client.tsx`, and `__tests__/css-paint-cost.test.ts`. `ContactSection.tsx` renders only `<Module>` + `<ContactFormLazy>` with no custom classes — **no module file, no change**. Likewise `ShellSection.tsx` is a thin `<Module>` wrapper — no change.

#### 14a. InteractiveShell

**Source:** `_shell.css` entire file (drop `@layer shell { }`). Keep `@keyframes shell-blink` (name unchanged) and the two `@media (max-width: 768px)` blocks.
**Responsive add:** `_layout.css` lines 179–182 — 768px: `.shell__bar { font-size: var(--fs-2xs) }`. `_shell.css` itself has no `.shell__bar` 768px rule, so add this as a new fragment in the module's 768px block.

**Rename table:**
| Legacy | Key | | Legacy | Key |
|---|---|---|---|---|
| `.shell` | `.root` | | `.shell__input` | `.input` |
| `.shell__bar` | `.bar` | | `.shell__placeholder-anim` | `.placeholderAnim` |
| `.shell__bar-dots` | `.barDots` | | `.shell__cursor` | `.cursor` |
| `.shell__bar-dot` | `.barDot` | | `.shell__chips` | `.chips` |
| `.shell__bar-dot--red` | `.barDotRed` | | `.shell__chip` | `.chip` |
| `.shell__bar-dot--yellow` | `.barDotYellow` | | `.shell__commands` | `.commands` |
| `.shell__bar-dot--green` | `.barDotGreen` | | `.shell__cmd-hint` | `.cmdHint` |
| `.shell__bar-title` | `.barTitle` | | `.shell__privacy-notice` | `.privacyNotice` |
| `.shell__feed` | `.feed` | | `.shell__line` | `.line` |
| `.shell__form` | `.form` | | `.shell__line--prompt` | `.linePrompt` |
| `.shell__prompt` | `.prompt` | | `.shell__line--output` | `.lineOutput` |
| `.shell__input-wrap` | `.inputWrap` | | `.shell__line--error` | `.lineError` |
| | | | `.shell__line--info` | `.lineInfo` |
| | | | `.shell__line--loading` | `.lineLoading` |

> Add `data-testid="shell-commands"` to the `<div>` carrying `styles.commands` (the desktop command-hint row) — `css-paint-cost.test.ts` selects it. `.shell__privacy-notice code` / ` a` keep their element part: `.privacyNotice code`, `.privacyNotice a`.

#### 14b. ContactForm

**Source:** `_contact.css` entire file (drop `@layer contact { }`).
**Responsive add:** `_layout.css` lines 184–191 — 768px: `.contact__input { font-size: var(--fs-sm); min-height: 44px }`, `.contact__input--area { min-height: 100px }`.

**Rename table:**
| Legacy | Key |
|---|---|
| `.contact` | `.root` |
| `.contact__field` | `.field` |
| `.contact__prompt` | `.prompt` |
| `.contact__prompt-user` | `.promptUser` |
| `.contact__prompt-cmd` | `.promptCmd` |
| `.contact__submitrow` | `.submitrow` |
| `.contact__input` | `.input` |
| `.contact__input--area` | `.inputArea` |
| `.contact__send` | `.send` |
| `.contact__cursor` | `.cursor` |
| `.contact__error` | `.error` |
| `.contact--success` | `.success` |

> `.contact__input--area` is a modifier — TSX: `` className={`${styles.input} ${styles.inputArea}`} `` on the `<textarea>`. `.contact__input:focus`, `::placeholder` keep their pseudo part.

#### 14c. Footer

**Source:** `_footer.css` entire file (drop `@layer footer { }`). Keep `@keyframes dmesg-reveal`, `sd-halt-reveal`, `sd-halt-hint-reveal` (names unchanged) and the `@media (max-width: 900px)` / `(max-width: 560px)` blocks and the `body[data-motion="reduce"]` blocks.
**Responsive add:** `_layout.css` lines 244–278 — the footer 768px block: `footer.shutdown`, `.sd-banner`, `.sd-init`, `.sd-stamp`, `.sd-panel`, `.sp-head`, `.sp-row`, `.sd-dmesg .dm-line`, `.sd-netstat pre`.

**Rename table:**
| Legacy | Key | | Legacy | Key |
|---|---|---|---|---|
| `footer.shutdown` | `.root` | | `.sd-netstat` | `.netstat` |
| `.shutdown-inner` | `.inner` | | `.ns-hdr` | `.nsHdr` |
| `.sd-banner` | `.banner` | | `.ns-est` | `.nsEst` |
| `.sd-init` | `.init` | | `.ns-listen` | `.nsListen` |
| `.sd-stamp` | `.stamp` | | `.ns-grid` | `.nsGrid` |
| `.sd-cmdline` | `.cmdline` | | `.ns-hdr-cell` | `.nsHdrCell` |
| `.sd-prompt` | `.sdPrompt` | | `.ns-proto` | `.nsProto` |
| `.sd-cmd` | `.sdCmd` | | `.sd-dmesg` | `.dmesg` |
| `.sd-rule` | `.rule` | | `.dm-line` | `.dmLine` |
| `.sd-grid` | `.grid` | | `.dm-t` | `.dmT` |
| `.sd-panel` | `.panel` | | `.dm-msg` | `.dmMsg` |
| `.sp-head` | `.spHead` | | `.dm-ok` | `.dmOk` |
| `.sp-bar` | `.spBar` | | `.sd-end` | `.end` |
| `.sp-row` | `.spRow` | | `.sd-halt` | `.halt` |
| `.sp-k` | `.spK` | | `.sd-halt-hint` | `.haltHint` |
| `.sp-v` | `.spV` | | `.shutdown-copy` | `.copy` |
| `.sp-bar2` | `.spBar2` | | `.booted` | `.booted` |

> `footer.shutdown` → `.root` (TSX: `<footer className={styles.root}>`). `.booted` is a state class added by `Footer.client.tsx` — emit as standalone; `.sd-dmesg.booted .dm-line` → `.dmesg.booted .dmLine`. `body[data-motion="reduce"] .sd-dmesg .dm-line` → `body[data-motion="reduce"] .dmesg .dmLine` (no `:global()` needed — `body` is an element selector). `.sd-halt-hint kbd` → `.haltHint kbd`. The inline per-line `animation-delay` set by `Footer.client.tsx` is a style prop, not CSS — unaffected.

#### 14d. css-paint-cost.test.ts (the `.shell__commands` selector only)

In `__tests__/css-paint-cost.test.ts`, the test `does not list "ask <question>" as a command` queries `container.querySelector('.shell__commands')`. After 14a that element no longer has that class. Update the selector:
```ts
    const hint = container.querySelector('[data-testid="shell-commands"]');
```
Leave the `paint cost CSS` describe block (the `_base.css` / `_crt.css` reads) **unchanged** — `_base.css` and `_crt.css` still exist until Task 15.

- [ ] **Step 1:** Create `InteractiveShell.module.css` per 14a.
- [ ] **Step 2:** Create `ContactForm.module.css` per 14b.
- [ ] **Step 3:** Create `Footer.module.css` per 14c.
- [ ] **Step 4:** Update `InteractiveShell.tsx`, `ContactForm.tsx`, `Footer.client.tsx` — add module imports, apply rename tables; add `data-testid="shell-commands"` in `InteractiveShell.tsx`.
- [ ] **Step 5:** Update `__tests__/css-paint-cost.test.ts` per 14d.
- [ ] **Step 6:** Verify — `pnpm typecheck && pnpm build && pnpm test -- css-paint-cost`. Expected: the `shell command hint` test PASSES; the two `paint cost CSS` tests PASS (files still present). `pnpm dev` confirm the interactive shell (feed, input, chips, command hints), contact form (fields, submit, success state), and footer (dmesg reveal, halt plate) render unchanged at desktop + 768px.
- [ ] **Step 7:** Commit:
```bash
git add components/client/InteractiveShell.module.css components/client/ContactForm.module.css components/sections/Footer.module.css components/client/InteractiveShell.tsx components/client/ContactForm.tsx components/sections/Footer.client.tsx __tests__/css-paint-cost.test.ts
git commit -m "refactor(css): migrate interactive shell, contact form, footer to CSS modules"
```

---

### Task 15: Slim globals, delete legacy files, finalize tests, verify

**Files:**
- Modify: `app/globals.css`, `app/css/_tokens.css`, `app/css/_base.css`
- Delete: `app/css/_crt.css`, `_layout.css`, `_sections.css`, `_chrome.css`, `_shell.css`, `_contact.css`, `_footer.css`, `_responsive.css`
- Modify: `__tests__/css-paint-cost.test.ts`

**Context:** Every component now has its module. The 8 legacy files are fully dead (no element carries their global classes). This task removes them, slims `globals.css` to tokens + base, unwraps the `@layer` wrappers (cascade layers are unnecessary once the only global CSS is two non-conflicting files), folds the remaining global rules from `_responsive.css` into `_base.css`, and runs full verification.

- [ ] **Step 1: Slim `app/globals.css`**

Replace the entire file with:
```css
/* app/globals.css — truly-global styles only: design tokens + element-level
   base resets. Every component owns its styles in a colocated *.module.css.
   See docs/superpowers/specs/2026-05-22-css-modules-migration/design.md */

@import "./css/_tokens.css";
@import "./css/_base.css";
```

- [ ] **Step 2: Unwrap `@layer` from `app/css/_tokens.css`**

Remove the `@layer tokens {` opening line and its matching closing `}`. Dedent the `:root { … }` block by 2 spaces. Keep the file header comment. Result is the header comment followed by a top-level `:root { … }`.

- [ ] **Step 3: Unwrap `@layer` from `app/css/_base.css` and append the global `_responsive.css` rules**

Remove the `@layer base {` opening line and its matching closing `}`; dedent the body by 2 spaces. Then **append** at the end of the file:
```css

/* ─── Global responsive token overrides (migrated from _responsive.css) ───────
   Placed AFTER the (max-width: 768px) :root block above. At viewports ≤768px
   both blocks match; later source order wins — this reproduces the cascade the
   old @layer responsive provided (responsive layer beat the base layer). */
@media (max-width: 900px) {
  :root {
    --vrhythm: 40px;
    --pad: 18px;
  }
  body {
    font-size: var(--fs-base);
  }
}

/* ─── Viewport-scoped visibility utilities (migrated from _responsive.css) ─────
   AppShell renders both viewport variants of the nav chrome; CSS picks which is
   visible at the 768px breakpoint. Global because AppShell sets these as plain
   string classNames. */
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
```

> The append order is load-bearing: the existing `@media (max-width: 768px) { :root { --vrhythm: 18px; --pad: 14px } }` block must stay **before** the new 900px block so the 900px values win ≤768px, exactly as `@layer responsive` did. Do not reorder.

- [ ] **Step 4: Delete the 8 legacy CSS files**

```bash
git rm app/css/_crt.css app/css/_layout.css app/css/_sections.css app/css/_chrome.css app/css/_shell.css app/css/_contact.css app/css/_footer.css app/css/_responsive.css
```

- [ ] **Step 5: Update `__tests__/css-paint-cost.test.ts` — the `_crt.css` read**

The `crt-flicker animation runs at >= 3s` test reads `_crt.css` (now deleted). Repoint it to the CRT module and update the class regex (`.crt-flicker` → `.flicker`); the animation **name** is still `crt-flicker`:
```ts
  it('the crt-flicker animation runs at >= 3s (cheap, not jittery)', () => {
    // behavioral-test-allow: reads the shipped stylesheet build asset; jsdom cannot evaluate @keyframes timing
    const crt = readFileSync(
      path.resolve(__dirname, '../components/responsive/CRTOverlay.module.css'),
      'utf-8',
    );
    const flicker = crt.match(/\.flicker\s*\{[^}]+\}/)?.[0] ?? '';
    const dur = flicker.match(/animation:\s*crt-flicker\s+([\d.]+)s/)?.[1];
    expect(Number(dur)).toBeGreaterThanOrEqual(3);
  });
```
Leave the `body rule carries no text-shadow` test unchanged — it reads `_base.css`, which survives; its regex `/^\s*html,\s*\n\s*body\s*\{[^}]+\}/m` still matches after the `@layer` unwrap (the `^\s*` tolerates the now-zero indent).

- [ ] **Step 6: Confirm no dangling references to deleted files**

Run: `grep -rn "_crt\|_layout\|_sections\|_chrome\|_shell\|_contact\|_footer\|_responsive" app components lib __tests__ tests`
Expected: no matches pointing at `app/css/_*.css` (other than possibly historical comment text — there should be none in code/imports). `globals.css` now references only `_tokens` and `_base`.

- [ ] **Step 7: Full local verification**

Run: `pnpm ci:local`
Expected: lint, typecheck, content-validate, client-naming, and the full unit suite all PASS. Pay attention to `content-visibility.test.ts` and `css-paint-cost.test.ts` — both must be green.

Run: `pnpm build`
Expected: PASS. Inspect the build output — `globals.css` is now small; component styles are emitted as CSS Modules. Confirm no render-blocking warning for component CSS.

Run: `pnpm test:e2e`
Expected: observability smoke, a11y scan, contact + ask journeys PASS. The **visual regression** project will FAIL — baselines were captured against the old DOM class names. This is expected (see Step 9).

- [ ] **Step 8: Playwright local visual check (golden path)**

Start `pnpm dev`; with Playwright MCP, load the site at 1280×720 and 375×812. Walk all ~18 sections plus header/footer chrome. Confirm pixel-level appearance is unchanged from `main` — the migration renames classes only, never alters styles. Spot-check: CRT overlay, hero (both variants), every section panel, mobile dock + ordering, motion-reduce toggle.

- [ ] **Step 9: Lighthouse gate**

Run: `pnpm lhci`
Expected: Performance ≥ 95, Accessibility = 100, Best Practices ≥ 95, SEO = 100; LCP < 1.8s, CLS < 0.05. Critical CSS is now handled by Next's CSS-Module SSR inlining — confirm there is no render-blocking stylesheet regression versus `main`.

- [ ] **Step 10: Commit**

```bash
git add app/globals.css app/css/_tokens.css app/css/_base.css __tests__/css-paint-cost.test.ts
git commit -m "refactor(css): slim globals to tokens+base, drop legacy CSS files and @layer"
```

- [ ] **Step 11: Post-merge follow-up (do NOT do during the PR — record in the PR description)**

After the PR merges to `main`, regenerate the visual-regression baselines via the `workflow_dispatch` trigger on the visual snapshot workflow. The appearance is unchanged but every DOM `class` attribute changed, so the committed baselines must be refreshed against the migrated output. Until then the visual-regression CI project will report diffs.

---

## Plan Self-Review

**Spec coverage:**
- ✅ `globals.css` slimmed to tokens + base (Task 15) — spec "What Changes §1"
- ✅ 8 of 10 CSS files deleted (Task 15) — spec "§2"
- ✅ `lib/inline-css.ts` + `__tests__/inline-css.test.ts` deleted, `layout.tsx` rewired (Task 1) — spec "§3, §4"
- ✅ ~33 module files created, one per component (Tasks 2–14) — spec "CSS Module Inventory"
- ✅ Naming convention (`.root`, camelCase, standalone modifiers) — applied in every rename table
- ✅ Three `:global()` cases: CRT motion `body[data-motion]` (Task 5), section ordering `#sec-*` (Task 4), body padding (Task 4) — spec "Cross-Cutting Selectors". Note: `body[data-motion="reduce"]` needs no `:global()` wrapper (element selector); `#sec-*` and `html.sysfail-on` do (class/id selectors).
- ✅ `@layer` removed from `globals.css`, `_tokens.css`, `_base.css` (Task 15) — spec "@layer Removal"
- ✅ Responsive styles distributed into each component module (every section/chrome task cites its `_layout.css` 768px + `_sections.css` fragments)
- ✅ Tests updated: `inline-css.test.ts` deleted (T1), `HeroStats.test.ts` → data-testid (T7), `content-visibility.test.ts` (T3, see note below), `css-paint-cost.test.ts` (T14 + T15) — spec "Testing Impact"
- ✅ Visual baseline regeneration recorded as post-merge follow-up (T15 Step 11)
- ✅ Single PR — all 15 tasks on one branch

**Spec deviations (intentional, documented):**
- The spec's migration sequence slims `globals.css` first (step 1). This plan keeps `globals.css` importing all 10 legacy files until Task 15, so the site stays continuously styled and every task is independently verifiable. Same end state; strictly safer for task-by-task execution.
- Spec maps `.page` to `AppShell.module.css`; `.page` is actually on `<main>` in `page.tsx`, so it goes to `app/page.module.css` (Task 2). `AppShell.module.css` holds only the `:global()` section-ordering + body-padding rules (Task 4).
- Spec inventory omits `ToTopButton` — added (Task 13e). `ContactSection`/`ShellSection` need no module (thin `<Module>` wrappers) — noted (Task 14).

**Open item for Task 3:** `content-visibility.test.ts` references `cv-defer` (jsdom markup assertion) and reads `_layout.css`. Task 3 must update **both**: change the markup assertion to `cvDefer` and repoint the file read to `components/responsive/Module.module.css` (checking `.cvDefer`). This keeps the test green from Task 3 onward. **This is folded into Task 3 below — see the added step.**

**Type/naming consistency:** rename tables are self-contained per module; `@keyframes` names (`crt-flicker`, `barpulse`, `status-pulse`, `boot-blink`, `shell-blink`, `dmesg-reveal`, `sd-halt-reveal`, `sd-halt-hint-reveal`, `crt-noise-shift`, `crt-scan-beam`) are preserved unchanged everywhere. The undefined `blink` keyframe is preserved unchanged (Key Mechanics §5).

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-22-css-modules-migration.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — dispatch a fresh subagent per task, two-stage review (spec compliance, then code quality) between tasks, fast iteration.

**2. Inline Execution** — execute tasks in this session via `superpowers:executing-plans`, batch execution with checkpoints for review.

**Which approach?**
