# Mobile LCP Perf-Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the three fixes from `docs/superpowers/specs/2026-05-18-mobile-lcp-perf-fix-design.md` (font preload tuning, critical-CSS inline, Hero RSC conversion) so post-merge `pnpm lhci:mobile` returns LCP p50 < 1800ms — unblocking Spec 1.5 (mobile LHCI gate ship).

**Architecture:** Four tasks, one commit each. Order matches spec §10: Fix A first with an audit-count abort gate (drop if scope balloons), Fix C second (Hero RSC conversion enables clean Fix B extraction), Fix B third (inline critical CSS using stable RSC markup as the source), then a calibration step that runs `pnpm lhci:mobile` 3x and decides ship vs. Perf-Fix #2. Tests follow the project's source-grep pattern (read source, assert on text content).

**Tech Stack:** Next.js 16 (App Router) · React 19 RSC · TypeScript strict · `next/font/local` · Vitest · @lhci/cli mobile config · Husky pre-commit gates

---

## Branch setup

Before starting Task 1, the implementer creates a new feature branch from `main`:

```bash
git checkout main
git pull origin main
git checkout -b feat/mobile-lcp-perf-fix
```

All commits land on this branch. Do NOT push during implementation — `superpowers:finishing-a-development-branch` handles push + PR creation after Task 4.

---

## File map

| File | Operation | Task |
|---|---|---|
| `app/css/_tokens.css` | Modify — add `--font-mono-bold-stack` variable | 1 (if not aborted) |
| Various CSS files in `app/css/` | Modify — append `font-family: var(--font-mono-bold-stack)` to weight-500/700 selectors (count gated by abort criterion) | 1 (if not aborted) |
| `app/layout.tsx` | Modify — split `mono` into `monoBody` + `monoBold`; update `<html>` className | 1 |
| `__tests__/font-preload-split.test.ts` | **Create** | 1 |
| `components/client/HeroBootAnimation.tsx` | **Create** | 2 |
| `components/client/HeroSystemFailure.tsx` | **Create** | 2 |
| `components/sections/Hero.tsx` | Modify — drop `'use client'`, strip hooks, render both variants with island slots | 2 |
| `app/css/_layout.css` | Modify — append `.hero--desktop` / `.hero--mobile` media-query toggle | 2 |
| `__tests__/hero-rsc.test.ts` | **Create** | 2 |
| `app/layout.tsx` | Modify — add `CRITICAL_CSS` constant + `<style>{CRITICAL_CSS}</style>` in `<head>` | 3 |
| `__tests__/critical-css-drift.test.ts` | **Create** | 3 |
| (none — calibration is a verification step) | — | 4 |

---

## Task 1 — Fix A: Font preload tuning + CSS audit

**Files (final, if not aborted):**
- Modify: `app/layout.tsx` (lines 7-24)
- Modify: `app/css/_tokens.css` (add `--font-mono-bold-stack`)
- Modify: any CSS files containing `font-weight: 500` or `font-weight: 700` selectors
- Create: `__tests__/font-preload-split.test.ts`

**Spec ref:** §4 (Fix A — Font preload tuning)

### Step 1.1: Read the current font setup

```bash
sed -n '7,24p' app/layout.tsx
```

Expected: see the current `mono` declaration with three weights (400, 500, 700), `preload: true`, `variable: '--font-mono'`. Note the line numbers.

### Step 1.2: Audit count — count affected selectors and files (ABORT GATE)

Per spec §4 "Abort criterion": count selectors using `font-weight: 500`, `font-weight: 700`, or `font-weight: bold` across all CSS files in `app/css/`.

```bash
grep -nE 'font-weight:\s*(500|700|bold)' app/css/*.css | tee /tmp/font-weight-audit.txt
echo "---"
echo "Total occurrences: $(wc -l < /tmp/font-weight-audit.txt)"
echo "Distinct files: $(awk -F: '{print $1}' /tmp/font-weight-audit.txt | sort -u | wc -l)"
```

**ABORT DECISION:**
- If total occurrences ≤ 10 AND distinct files ≤ 2: **proceed to Step 1.3.**
- If total occurrences > 10 OR distinct files > 2: **abort Fix A.** Skip directly to Task 2 (Fix C). In your task report, include the audit count and the abort decision verbatim. Add a one-line note to `DECISIONS.md` dated 2026-05-18: "Spec 1.5 perf-fix Fix A deferred — CSS audit count <N> selectors across <M> files exceeded abort criterion (10/2). Fix A will return in a focused sub-spec if mobile LCP doesn't close from Fixes B + C alone."

### Step 1.3: Write the failing test (only if not aborted)

Create `__tests__/font-preload-split.test.ts` with this exact content:

```ts
// __tests__/font-preload-split.test.ts
// Source-grep test: verifies the per-weight font split in app/layout.tsx
// per spec docs/superpowers/specs/2026-05-18-mobile-lcp-perf-fix-design.md §4.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const LAYOUT_SOURCE = readFileSync(
  path.resolve(__dirname, '../app/layout.tsx'),
  'utf-8',
);
const TOKENS_SOURCE = readFileSync(
  path.resolve(__dirname, '../app/css/_tokens.css'),
  'utf-8',
);

describe('font preload split', () => {
  it('declares monoBody with weight 400 and preload: true', () => {
    expect(LAYOUT_SOURCE).toMatch(/const monoBody = localFont\(/);
    expect(LAYOUT_SOURCE).toMatch(/jetbrains-mono-400\.woff2/);
    expect(LAYOUT_SOURCE).toMatch(/monoBody[\s\S]*?preload:\s*true/);
  });

  it('declares monoBold with weights 500 + 700 and preload: false', () => {
    expect(LAYOUT_SOURCE).toMatch(/const monoBold = localFont\(/);
    expect(LAYOUT_SOURCE).toMatch(/monoBold[\s\S]*?jetbrains-mono-500\.woff2/);
    expect(LAYOUT_SOURCE).toMatch(/monoBold[\s\S]*?jetbrains-mono-700\.woff2/);
    expect(LAYOUT_SOURCE).toMatch(/monoBold[\s\S]*?preload:\s*false/);
  });

  it('applies both font variables in the html className', () => {
    expect(LAYOUT_SOURCE).toMatch(/className=\{`\$\{monoBody\.variable\}.*?\$\{monoBold\.variable\}/);
  });

  it('defines --font-mono-bold-stack in _tokens.css', () => {
    expect(TOKENS_SOURCE).toMatch(/--font-mono-bold-stack:\s*var\(--font-mono-bold\)/);
  });
});
```

### Step 1.4: Run the new test to verify it FAILS

```bash
pnpm vitest run __tests__/font-preload-split.test.ts
```

Expected: 4 tests FAIL — `monoBody` / `monoBold` don't exist yet, className doesn't reference them, `--font-mono-bold-stack` not defined.

### Step 1.5: Update `app/layout.tsx` — split the font

In `app/layout.tsx`, find the existing block (around lines 7-16):

```ts
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
```

Replace with:

```ts
// Weight 400 is the LCP-critical weight (Hero tagline, body copy throughout).
// Preload eagerly so it downloads in parallel with the CSS chunk.
const monoBody = localFont({
  src: [{ path: '../public/fonts/jetbrains-mono-400.woff2', weight: '400', style: 'normal' }],
  variable: '--font-mono',
  display: 'swap',
  preload: true,
});

// Weights 500 + 700 used for headings + emphasis throughout the page but NOT
// on the LCP critical path. Defer their preload — they load lazily on first
// use. Saves ~43KB of parallel Slow-4G bandwidth contention.
const monoBold = localFont({
  src: [
    { path: '../public/fonts/jetbrains-mono-500.woff2', weight: '500', style: 'normal' },
    { path: '../public/fonts/jetbrains-mono-700.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-mono-bold',
  display: 'swap',
  preload: false,
});
```

### Step 1.6: Update the `<html>` className to include both variables

In `app/layout.tsx`, find the existing `<html>` element (around line 107):

```tsx
<html lang="en" className={`${mono.variable} ${display.variable}`} suppressHydrationWarning>
```

Replace with:

```tsx
<html lang="en" className={`${monoBody.variable} ${monoBold.variable} ${display.variable}`} suppressHydrationWarning>
```

### Step 1.7: Add `--font-mono-bold-stack` to `_tokens.css`

In `app/css/_tokens.css`, find the existing `--font-mono-stack` line (around line 24):

```css
--font-mono-stack: var(--font-mono), ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
```

After it, add:

```css
--font-mono-bold-stack: var(--font-mono-bold), ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
```

### Step 1.8: Apply `--font-mono-bold-stack` to bold selectors

Open `/tmp/font-weight-audit.txt` (from Step 1.2). For each line, navigate to the file:line, find the enclosing CSS rule, and add `font-family: var(--font-mono-bold-stack);` if the rule doesn't already specify a font-family OR change the existing `font-family: var(--font-mono-stack)` to `var(--font-mono-bold-stack)`.

Example: if a rule has `font-weight: 700` but no `font-family`, add `font-family: var(--font-mono-bold-stack);` to that rule.

Skip any rule where `font-family` is already set to something else (system fonts, display fonts) — those don't need the bold variant.

### Step 1.9: Run the test to verify it PASSES

```bash
pnpm vitest run __tests__/font-preload-split.test.ts
```

Expected: 4/4 tests pass.

### Step 1.10: Run the full unit suite to confirm no regression

```bash
pnpm vitest run
```

Expected: 54 baseline + 4 new = 58 passing. No failures.

### Step 1.11: Run full pre-commit sequence

```bash
pnpm check && pnpm typecheck && pnpm validate-content && pnpm test
```

Expected: all green.

### Step 1.12: Commit

```bash
git add app/layout.tsx app/css/_tokens.css app/css/*.css __tests__/font-preload-split.test.ts
git commit -m "$(cat <<'EOF'
feat(perf): split font preload — weight 400 only for LCP critical path

next/font/local previously preloaded all 3 JetBrains Mono weights
(400, 500, 700 = 64KB) competing for Slow-4G bandwidth at first paint.
Splits into two instances:

- monoBody: weight 400 only, preload: true, variable --font-mono
- monoBold: weights 500 + 700, preload: false, variable --font-mono-bold

Saves ~43KB of parallel bandwidth contention. New
--font-mono-bold-stack token routes bold selectors to monoBold so they
load lazily on first use.

Honest about LCP impact: font-display: swap is already in place so LCP
element paints with fallback before woff2 swaps. Fix A is closer to
infrastructure cleanup than a primary LCP driver. Spec author accepted
the trade per spec §4 honest-assessment subsection.

CSS audit count: <N> selectors across <M> files (within the 10/2 abort
criterion).

Implements Fix A of spec docs/superpowers/specs/2026-05-18-mobile-lcp-
perf-fix-design.md.

Reversal: trivial — restore single localFont() call.
EOF
)"
```

Replace `<N>` and `<M>` with the actual audit count from Step 1.2.

---

## Task 2 — Fix C: Hero RSC conversion

**Files:**
- Create: `components/client/HeroBootAnimation.tsx`
- Create: `components/client/HeroSystemFailure.tsx`
- Modify: `components/sections/Hero.tsx` (drop `'use client'`, restructure)
- Modify: `app/css/_layout.css` (add `.hero--desktop` / `.hero--mobile` media-query toggle)
- Create: `__tests__/hero-rsc.test.ts`

**Spec ref:** §6 (Fix C — Hero RSC conversion)

### Step 2.1: Read the current Hero.tsx in full

```bash
wc -l components/sections/Hero.tsx
sed -n '1,30p' components/sections/Hero.tsx
echo "---"
sed -n '80,120p' components/sections/Hero.tsx  # runBoot function
echo "---"
sed -n '230,260p' components/sections/Hero.tsx  # Hero() function start
```

You'll be working with all 444 lines. Confirm the structure: imports → `runBoot()` function at line 81 → Hero component at line 235 → desktop variant JSX → mobile variant JSX.

### Step 2.2: Write the failing test

Create `__tests__/hero-rsc.test.ts` with this exact content:

```ts
// __tests__/hero-rsc.test.ts
// Source-grep test: verifies Hero RSC conversion per spec
// docs/superpowers/specs/2026-05-18-mobile-lcp-perf-fix-design.md §6.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const HERO_SOURCE = readFileSync(
  path.resolve(__dirname, '../components/sections/Hero.tsx'),
  'utf-8',
);
const LAYOUT_CSS = readFileSync(
  path.resolve(__dirname, '../app/css/_layout.css'),
  'utf-8',
);

describe('Hero RSC conversion', () => {
  it('Hero.tsx does NOT declare \'use client\'', () => {
    expect(HERO_SOURCE).not.toMatch(/^['"]use client['"]/m);
  });

  it('Hero.tsx no longer imports useBreakpoint', () => {
    expect(HERO_SOURCE).not.toMatch(/useBreakpoint/);
  });

  it('Hero.tsx no longer imports useEffect or useRef', () => {
    expect(HERO_SOURCE).not.toMatch(/import\s*\{[^}]*\b(useEffect|useRef)\b[^}]*\}\s*from\s*['"]react['"]/);
  });

  it('renders both .hero--desktop and .hero--mobile variants', () => {
    expect(HERO_SOURCE).toMatch(/hero hero--desktop/);
    expect(HERO_SOURCE).toMatch(/hero hero--mobile/);
  });

  it('imports HeroBootAnimation client island', () => {
    expect(HERO_SOURCE).toMatch(/from\s*['"](\.\.\/client\/HeroBootAnimation)['"]/);
  });

  it('imports HeroSystemFailure client island', () => {
    expect(HERO_SOURCE).toMatch(/from\s*['"](\.\.\/client\/HeroSystemFailure)['"]/);
  });

  it('HeroBootAnimation island exists with use client + matchMedia gate', () => {
    const island = readFileSync(
      path.resolve(__dirname, '../components/client/HeroBootAnimation.tsx'),
      'utf-8',
    );
    expect(island).toMatch(/^['"]use client['"]/m);
    expect(island).toMatch(/window\.matchMedia\(\s*['"]\(max-width:\s*768px\)['"]\s*\)/);
    expect(island).toMatch(/variant.*?['"]desktop['"]/);
    expect(island).toMatch(/variant.*?['"]mobile['"]/);
  });

  it('HeroSystemFailure island exists with use client', () => {
    const island = readFileSync(
      path.resolve(__dirname, '../components/client/HeroSystemFailure.tsx'),
      'utf-8',
    );
    expect(island).toMatch(/^['"]use client['"]/m);
  });

  it('_layout.css contains .hero--desktop / .hero--mobile media-query toggle', () => {
    expect(LAYOUT_CSS).toMatch(/\.hero--desktop\s*\{\s*display:\s*block/);
    expect(LAYOUT_CSS).toMatch(/\.hero--mobile\s*\{\s*display:\s*none/);
    expect(LAYOUT_CSS).toMatch(/@media\s*\(max-width:\s*768px\)/);
  });
});
```

### Step 2.3: Run the new test to verify it FAILS

```bash
pnpm vitest run __tests__/hero-rsc.test.ts
```

Expected: 9 FAILs — Hero still has `'use client'`, the islands don't exist, etc.

### Step 2.4: Create `HeroBootAnimation.tsx` island

Create `components/client/HeroBootAnimation.tsx`:

```tsx
'use client';

import { useEffect, useRef } from 'react';

// Type for the boot controller — extracted from the original Hero.tsx runBoot().
// The runBoot function itself is moved here in Step 2.5.
export type BootCtrl = { stop: () => void };

type Props = {
  variant: 'desktop' | 'mobile';
};

// Each variant mounts its own instance; only the one matching the viewport runs.
// matchMedia is deterministic regardless of stylesheet load order — picked over
// getComputedStyle to avoid the hydration race documented in spec §6.
export function HeroBootAnimation({ variant }: Props) {
  const bootRef = useRef<HTMLDivElement>(null);
  const bootCtrl = useRef<BootCtrl | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isMobileVP = window.matchMedia('(max-width: 768px)').matches;
    const shouldRun = variant === 'mobile' ? isMobileVP : !isMobileVP;
    if (!shouldRun) return;

    const el = bootRef.current;
    if (!el) return;
    // runBoot is moved from Hero.tsx in Step 2.5.
    bootCtrl.current = runBoot(el, { variant });
    return () => {
      bootCtrl.current?.stop();
      bootCtrl.current = null;
    };
  }, [variant]);

  return <div ref={bootRef} className="hero__boot" />;
}

// runBoot moved from original Hero.tsx — see Step 2.5 for the exact extraction.
function runBoot(_el: HTMLDivElement, _opts: { variant: 'desktop' | 'mobile' }): BootCtrl {
  // PLACEHOLDER — replaced in Step 2.5 with the actual runBoot implementation
  // extracted verbatim from the original Hero.tsx (around lines 81-233).
  return { stop: () => {} };
}
```

### Step 2.5: Move `runBoot` from `Hero.tsx` to `HeroBootAnimation.tsx`

Open `components/sections/Hero.tsx`. Find the `export function runBoot(...)` block (starting around line 81, ending where the next top-level function begins around line 235).

**Cut** the entire `runBoot` function (everything from `export function runBoot` to the closing `}` immediately before `export function Hero()`). Also cut any helper functions/types that `runBoot` uses and aren't used elsewhere in Hero.tsx — including the `BootCtrl` type if it's defined in Hero.tsx.

**Paste** into `components/client/HeroBootAnimation.tsx`, replacing the placeholder `runBoot` and `BootCtrl` at the bottom. Make `runBoot` a non-exported local function. Adjust the function signature if needed so the call site at the top of HeroBootAnimation.tsx (`runBoot(el, { variant })`) type-checks against the moved implementation.

If `runBoot` originally took different arguments, you may need to adapt either the call site OR the signature so the contract matches. Prefer adapting the call site (less risk to the boot logic itself).

### Step 2.6: Create `HeroSystemFailure.tsx` island

Find the SYSTEM FAILURE animation logic in Hero.tsx (sysfailRef + the useEffect that drives it; around lines 247-321 inside the Hero component body).

Create `components/client/HeroSystemFailure.tsx`:

```tsx
'use client';

import { useEffect, useRef } from 'react';

// The SYSTEM FAILURE headline animation, extracted from Hero.tsx.
// Activates on the 'sysfail:start' window event and ends on 'sysfail:end'
// (existing wiring from the original Hero implementation).
export function HeroSystemFailure() {
  const sysfailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Move the sysfail-specific useEffect body here from the original Hero.tsx.
    // The original useEffect at Hero.tsx ~line 247-321 contains both boot
    // animation setup AND sysfail wiring. Extract ONLY the sysfail event
    // listeners + DOM mutations of sysfailRef. The boot animation setup goes
    // into HeroBootAnimation.tsx (Step 2.5).
    //
    // Typical sysfail logic listens for window events 'sysfail:start' and
    // 'sysfail:end' (matrix-rain pause/resume events from elsewhere in
    // the app); when 'sysfail:start' fires, the sysfailRef element becomes
    // visible / its plate animates; on 'sysfail:end', it hides.
    //
    // Paste the relevant block here; remove from Hero.tsx in Step 2.7.
  }, []);

  return (
    <div ref={sysfailRef} className="hero__headline" aria-hidden="true" aria-live="off">
      <div className="hero__headline-plate">SYSTEM FAILURE</div>
    </div>
  );
}
```

**Important:** the original `useEffect` in Hero.tsx (lines ~247-321) handles BOTH the boot animation AND the sysfail wiring. Step 2.5 already moved the boot animation parts. This step moves ONLY the sysfail event listeners and DOM mutations of `sysfailRef`. The remaining sysfail-specific lines are extracted verbatim into the `useEffect` body above.

### Step 2.7: Restructure `Hero.tsx` as RSC

In `components/sections/Hero.tsx`:

1. **Remove the first line** (`'use client';`).
2. **Remove these imports** at the top:
   - `import { useEffect, useRef } from 'react';`
   - `import { useBreakpoint } from '@/lib/use-breakpoint';`
   - The `runBoot` function (moved in Step 2.5)
   - `BootCtrl` type if Hero.tsx defined it (moved in Step 2.5)
3. **Add these imports**:
   ```ts
   import { HeroBootAnimation } from '../client/HeroBootAnimation';
   import { HeroSystemFailure } from '../client/HeroSystemFailure';
   ```
4. **Restructure the `Hero()` function** to be a pure RSC that renders both variants:
   ```tsx
   export function Hero() {
     return (
       <>
         <section id="bio" className="hero hero--desktop">
           {/* All static markup that was inside the original desktop variant */}
           {/* Replace any `<div ref={bootRef} ... />` with: */}
           <HeroBootAnimation variant="desktop" />
           {/* Replace the sysfailRef JSX with: */}
           <HeroSystemFailure />
           {/* Rest of the static desktop markup (h1, tagline, meta, status, CTAs) */}
         </section>
         <section id="bio-mobile" className="hero hero--mobile">
           {/* All static markup that was inside the original mobile variant */}
           <HeroBootAnimation variant="mobile" />
           {/* Rest of the static mobile markup */}
         </section>
       </>
     );
   }
   ```

Two important details:
- Both `<section>` elements need a unique `id` if `id="bio"` is used as an anchor target elsewhere in the app. If only desktop has an `id="bio"` anchor target, the mobile variant can drop the id. Check by grepping: `grep -rn '#bio' app components` — if any link points to `#bio`, only the variant that's typically visible should have that id. Keep `id="bio"` on the desktop section and use `id="bio-mobile"` (or omit `id`) on the mobile section.
- `RoleTyper` is an existing client island (already imported in the original Hero.tsx). Keep its usage unchanged — it's invoked inside the desktop variant's tagline content per the original markup.

### Step 2.8: Add the CSS media-query toggle to `_layout.css`

In `app/css/_layout.css`, find a suitable section — append at the END of the file (or near other `.hero` rules if those exist there):

```css
/* ─────────────────────────────────────────────────────────────────────────────
   HERO RESPONSIVE TOGGLE
   Both variants are server-rendered (RSC). CSS media query swaps visibility so
   only the matching variant paints. Spec ref: 2026-05-18-mobile-lcp-perf-fix
   design §6.
   ───────────────────────────────────────────────────────────────────────── */
.hero--desktop {
  display: block;
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
```

### Step 2.9: Run the test to verify it PASSES

```bash
pnpm vitest run __tests__/hero-rsc.test.ts
```

Expected: 9/9 tests pass.

### Step 2.10: Run the full unit suite to confirm no regression

```bash
pnpm vitest run
```

Expected: 58 from Task 1 + 9 new = 67 passing. No failures.

### Step 2.11: Smoke-test the boot animation locally

```bash
pnpm dev
```

In a browser, open `http://localhost:3000`. Confirm:
- The boot animation runs (typing text in the Hero's left column on desktop, or top of the mobile variant)
- SYSTEM FAILURE animation still triggers correctly (it's tied to the sysfail event from the MatrixRain motion toggle)
- Mobile and desktop variants both render correctly when toggled via DevTools device emulation (resize across 768px)

If anything visually regresses, do NOT commit. Diagnose and fix.

### Step 2.12: Run full pre-commit sequence

```bash
pnpm check && pnpm typecheck && pnpm validate-content && pnpm test
```

Expected: all green.

### Step 2.13: Commit

```bash
git add components/sections/Hero.tsx components/client/HeroBootAnimation.tsx components/client/HeroSystemFailure.tsx app/css/_layout.css __tests__/hero-rsc.test.ts
git commit -m "$(cat <<'EOF'
refactor(hero): convert to RSC with client islands for animations

Restructures the 444-line all-'use client' Hero into:

- Hero.tsx (RSC): renders BOTH .hero--desktop and .hero--mobile
  variants with all static content. LCP element (p.hero__tagline) is
  now static SSR markup; no hydration on the critical path.
- HeroBootAnimation.client.tsx (new): wraps the bootRef + runBoot()
  call. Each variant mounts its own instance with a variant prop
  ('desktop' | 'mobile'); useEffect gates on
  window.matchMedia('(max-width: 768px)').matches and the hidden
  variant's instance no-ops. matchMedia is deterministic regardless
  of stylesheet load order — chosen over getComputedStyle to avoid
  the hydration race documented in spec §6.
- HeroSystemFailure.client.tsx (new): wraps the sysfailRef + event
  listeners. Mounted once inside the desktop variant (sysfail is
  desktop-only in the current design).
- _layout.css: new .hero--desktop / .hero--mobile media-query toggle
  hides the non-matching variant.

useBreakpoint is no longer imported by Hero (still used in AppShell
for chrome decisions). RoleTyper is unchanged.

Trade-offs: both variants in DOM doubles Hero markup bytes (~5KB to
~10KB HTML); acceptable since both are pure RSC (no hydration cost
per hidden variant). Mid-session breakpoint resize no longer
re-triggers the boot animation (acceptable trade per spec §6 edge
case).

Implements Fix C of spec docs/superpowers/specs/2026-05-18-mobile-
lcp-perf-fix-design.md.

Reversal: revert Hero.tsx; delete the two island files; revert the
_layout.css toggle.
EOF
)"
```

---

## Task 3 — Fix B: Critical-CSS inline + drift test

**Files:**
- Modify: `app/layout.tsx` (add `CRITICAL_CSS` constant + `<style>` block in `<head>`)
- Create: `__tests__/critical-css-drift.test.ts`

**Spec ref:** §5 (Fix B — Critical-CSS inline + drift test)

### Step 3.1: Identify critical-CSS selectors

The critical set is what the LCP element (`p.hero__tagline` inside `section.hero`) needs to paint correctly. From the spec §5:
1. ALL `:root` CSS variables in `_tokens.css`
2. `*, *::before, *::after { box-sizing: border-box }` and body/html font + color + background from `_base.css`
3. `.page` container rules from `_layout.css`
4. `.hero`, `.hero--desktop`, `.hero--mobile`, `.hero__left`, `.hero__bio`, `.hero__name`, `.hero__tagline`, `.hero__meta`, `.hero__status`, `.hero__ctas` and immediate dependents from `_sections.css`
5. The `.hero--desktop` / `.hero--mobile` toggle added in Task 2

Open each source CSS file and copy ONLY the rules matching the selectors above. Paste into a scratch buffer. Estimate: 50-100 lines, ~3-4KB.

### Step 3.2: Write the failing test

Create `__tests__/critical-css-drift.test.ts` with this exact content:

```ts
// __tests__/critical-css-drift.test.ts
//
// SCOPE LIMITATION (documented per spec §5 architect-review):
// This test is SELECTOR-EXISTENCE + VARIABLE-EXISTENCE, NOT
// rule-body equivalence. It catches structural drift (renamed selector,
// deleted variable) but NOT stylistic drift (e.g., font-size value
// changed in source CSS without updating CRITICAL_CSS). Mitigation
// layers for stylistic drift: axe-core visual smoke, post-merge LHCI,
// manual PR review of any .hero__* changes.

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const LAYOUT_SOURCE = readFileSync(
  path.resolve(__dirname, '../app/layout.tsx'),
  'utf-8',
);

const CSS_DIR = path.resolve(__dirname, '../app/css');
const ALL_CSS = readdirSync(CSS_DIR)
  .filter((f) => f.endsWith('.css'))
  .map((f) => readFileSync(path.join(CSS_DIR, f), 'utf-8'))
  .join('\n');

// Extract CRITICAL_CSS template-literal body from layout.tsx.
const criticalMatch = LAYOUT_SOURCE.match(/const CRITICAL_CSS = `([\s\S]*?)`;/);
const CRITICAL_CSS = criticalMatch?.[1] ?? '';

describe('critical CSS drift guard', () => {
  it('layout.tsx exports a CRITICAL_CSS constant', () => {
    expect(LAYOUT_SOURCE).toMatch(/const CRITICAL_CSS = `/);
    expect(CRITICAL_CSS.length).toBeGreaterThan(500);
  });

  it('renders <style>{CRITICAL_CSS}</style> in <head>', () => {
    expect(LAYOUT_SOURCE).toMatch(/<style>\{CRITICAL_CSS\}<\/style>/);
  });

  it('every class selector in CRITICAL_CSS exists in source CSS', () => {
    // Extract class selectors (.foo, .foo--bar, .foo__baz) — exclude
    // pseudo-selectors and combinators.
    const classMatches = CRITICAL_CSS.matchAll(/\.([a-zA-Z][a-zA-Z0-9_-]*)/g);
    const inlinedClasses = new Set(Array.from(classMatches, (m) => m[1]));
    const missing: string[] = [];
    for (const cls of inlinedClasses) {
      if (!ALL_CSS.includes(`.${cls}`)) missing.push(cls);
    }
    expect(missing).toEqual([]);
  });

  it('every CSS variable in CRITICAL_CSS is defined in _tokens.css', () => {
    const tokens = readFileSync(path.join(CSS_DIR, '_tokens.css'), 'utf-8');
    const varMatches = CRITICAL_CSS.matchAll(/var\(\s*(--[a-zA-Z][a-zA-Z0-9_-]*)/g);
    const inlinedVars = new Set(Array.from(varMatches, (m) => m[1]));
    const missing: string[] = [];
    for (const v of inlinedVars) {
      if (!tokens.includes(`${v}:`)) missing.push(v);
    }
    expect(missing).toEqual([]);
  });
});
```

### Step 3.3: Run the new test to verify it FAILS

```bash
pnpm vitest run __tests__/critical-css-drift.test.ts
```

Expected: 4 FAILs — `CRITICAL_CSS` doesn't exist yet; `<style>{CRITICAL_CSS}</style>` not present; other assertions fail because CRITICAL_CSS is empty.

### Step 3.4: Add the `CRITICAL_CSS` constant + `<style>` block to `layout.tsx`

In `app/layout.tsx`, add a module-scope constant after the imports + font declarations and BEFORE the `metadata` export:

```ts
// Critical CSS inlined to eliminate render-block on Hero LCP element.
// Drift-protected by __tests__/critical-css-drift.test.ts (selector +
// variable existence checks; NOT rule-body equivalence — see test docblock).
// Spec ref: docs/superpowers/specs/2026-05-18-mobile-lcp-perf-fix-design.md §5
const CRITICAL_CSS = `
/* Paste extracted rules from Step 3.1 here, organized in the order:
   1. :root tokens
   2. *, *::before, *::after reset + body/html base
   3. .page container
   4. .hero / .hero--desktop / .hero--mobile / .hero__left / .hero__bio /
      .hero__name / .hero__tagline / .hero__meta / .hero__status / .hero__ctas
      and immediate dependents
   5. .hero--desktop / .hero--mobile media-query toggle
   Format: minify-safe (preserve whitespace as in source). */
`;
```

Then in the `RootLayout` component, add the `<style>` block to `<head>` BEFORE the `<script type="application/ld+json">`:

```tsx
<head>
  <style>{CRITICAL_CSS}</style>
  <script type="application/ld+json">{personJsonLd}</script>
</head>
```

Paste the actual extracted CSS rules from Step 3.1 into the template literal body, replacing the placeholder comment.

### Step 3.5: Run the test to verify it PASSES

```bash
pnpm vitest run __tests__/critical-css-drift.test.ts
```

Expected: 4/4 tests pass. If a test fails because a class or variable is missing from source CSS, it means the extraction in Step 3.1 included a selector/variable that doesn't exist in source — re-check the extraction.

### Step 3.6: Smoke test the inlined critical CSS

```bash
pnpm build
pnpm start &
sleep 5
curl -s http://localhost:3000 | grep -c "<style>"
kill %1
```

Expected: prints `1` (one `<style>` block in the rendered HTML — the inlined critical CSS).

Open `http://localhost:3000` in a browser, disable the network stylesheet via DevTools (Network tab → block `*.css`), and reload. The Hero should still render with at least the inlined critical styles (colors, font, layout) — confirming the critical CSS is sufficient for above-fold rendering.

### Step 3.7: Run full pre-commit sequence

```bash
pnpm check && pnpm typecheck && pnpm validate-content && pnpm test
```

Expected: all green.

### Step 3.8: Commit

```bash
git add app/layout.tsx __tests__/critical-css-drift.test.ts
git commit -m "$(cat <<'EOF'
feat(perf): inline critical CSS in <head> to unblock LCP paint

Extracts the minimum CSS rules needed to paint the Hero (LCP element
p.hero__tagline + its visible-on-load chrome) from the four source
files (_tokens, _base, _layout, _sections) into a CRITICAL_CSS
constant. Renders as <style>{CRITICAL_CSS}</style> in the layout
<head>, before the route-level <link rel='stylesheet'> in the chunks
directory. The full CSS chunk continues loading normally — still
render-blocks but the inlined critical rules render LCP-relevant
content without waiting.

Uses React 18.3+ native <style> children pattern (no escape-hatch
needed for static build-time content). CSP style-src 'unsafe-inline'
is already in proxy.ts per DECISIONS.md 2026-05-18; no policy widening.

Drift protection: __tests__/critical-css-drift.test.ts is a
source-grep test asserting (a) every class selector in CRITICAL_CSS
exists in the source CSS files, (b) every CSS variable referenced is
defined in _tokens.css. SCOPE LIMITATION explicitly documented in
the test docblock: this catches structural drift (renamed selectors)
but NOT rule-body stylistic drift (e.g., font-size value change in
source without updating CRITICAL_CSS). Mitigation layers per spec §5:
axe-core visual smoke, post-merge LHCI continuous measurement, and
manual PR review of .hero__* changes.

Implements Fix B of spec docs/superpowers/specs/2026-05-18-mobile-
lcp-perf-fix-design.md.

Reversal: delete the CRITICAL_CSS constant + <style> block; delete
the drift test.
EOF
)"
```

---

## Task 4 — Calibration

**Files (none — this is a verification step):**
- Read: `lighthouserc.mobile.json` (already exists from harness-hardening branch — confirm or re-add if not present on this branch)
- Modify: `docs/superpowers/plans/2026-05-18-mobile-lcp-perf-fix.md` (this file — append calibration evidence)

### Step 4.1: Confirm `lighthouserc.mobile.json` exists on this branch

```bash
test -f lighthouserc.mobile.json && echo "OK: config exists" || echo "MISSING — see notes below"
```

Expected: `OK: config exists`. The file was committed on `feat/harness-hardening` (PR #9). Since this perf-fix branch is based on `main`, the file may NOT be present until PR #9 merges.

**If MISSING:** STOP. The calibration depends on the mobile LHCI config. Options:
- Merge PR #9 first, then rebase this branch and re-run from Step 4.1
- OR copy the `lighthouserc.mobile.json` + `lhci:mobile` script onto this branch as a temporary measure (will create a merge conflict against PR #9; not recommended)

Pick the first option in coordination with the controller.

### Step 4.2: Build

```bash
pnpm build
```

Expected: clean build. If build fails, diagnose — likely a TypeScript or import issue from the Hero RSC refactor in Task 2.

### Step 4.3: Run mobile LHCI calibration (3 runs)

```bash
pnpm lhci:mobile
```

Expected: 3 runs, ~60-180 seconds total. End-of-run output prints a table with median values per metric.

### Step 4.4: Capture observed p50 metrics

From the LHCI output, find the median values for:
- `largest-contentful-paint` (ms) — **the critical metric**
- `total-blocking-time` (ms)
- `interactive` (ms)
- `cumulative-layout-shift`
- `categories:performance` (0-1 score)

### Step 4.5: Apply the decision branch (per spec §8)

- **SUCCESS (ship-ready):** LCP p50 < 1800ms AND Performance score ≥ 0.95 AND no other threshold regressions in `lighthouserc.mobile.json`. Proceed to Step 4.6.
- **PARTIAL (Perf-Fix #2 needed):** LCP closes to <2200ms but not <1800ms. Document the result; open follow-up Perf-Fix #2 spec to address whichever metric remains. Do NOT commit a loosened threshold. Proceed to Step 4.6 to record the partial.
- **MISS (restart brainstorm):** LCP stays >2200ms. Document the result. Stop. The controller restarts brainstorming with a deeper diagnostic (DevTools tracing of the actual critical path).

### Step 4.6: Append calibration evidence to this plan file

Open `docs/superpowers/plans/2026-05-18-mobile-lcp-perf-fix.md` (this file). At the bottom, find the `## Calibration evidence` section (it currently says "Populated during Task 4 Step 4.6"). Replace that placeholder with:

```markdown
## Calibration evidence

Captured: <YYYY-MM-DD HH:MM local time>
Local machine: <e.g. macOS arm64, Node 22.x, pnpm 10.x>
LHCI version: <pnpm lhci --version>
Branch: feat/mobile-lcp-perf-fix at <commit SHA>

| Metric | Pre-fix (Spec 1 calibration) | Target (spec §8) | Observed p50 (this run) | Delta | Status |
|---|---|---|---|---|---|
| `largest-contentful-paint` | 3071ms | < 1800ms | <N>ms | <DELTA>ms | PASS / PARTIAL / MISS |
| `total-blocking-time` | 14ms | < 400ms | <N>ms | <DELTA>ms | PASS / PARTIAL / MISS |
| `interactive` | 3071ms | < 3500ms | <N>ms | <DELTA>ms | PASS / PARTIAL / MISS |
| `cumulative-layout-shift` | 0.0 | < 0.05 | <N> | <DELTA> | PASS / PARTIAL / MISS |
| `categories:performance` | 0.93 | ≥ 0.95 | <N> | <DELTA> | PASS / PARTIAL / MISS |

**Overall decision: SUCCESS / PARTIAL / MISS** (per spec §8 decision rule)

Notes: <any flake, surprising results, per-fix attribution observations>

Next step:
- SUCCESS → proceed to `superpowers:finishing-a-development-branch` for PR creation; Spec 1.5 unblocks
- PARTIAL → open `docs/superpowers/specs/2026-05-18-mobile-lcp-perf-fix-2-design.md` brainstorm
- MISS → controller restarts brainstorming with deeper diagnostic
```

Fill in every `<N>` and `<DELTA>` with actual numbers. Set the Status column per the decision rule. Set Overall decision explicitly.

### Step 4.7: Run full pre-commit sequence

```bash
pnpm check && pnpm typecheck && pnpm validate-content && pnpm test
```

Expected: all green.

### Step 4.8: Commit the calibration evidence

```bash
git add docs/superpowers/plans/2026-05-18-mobile-lcp-perf-fix.md
git commit -m "$(cat <<'EOF'
docs(plan): append mobile LCP calibration evidence — <SUCCESS|PARTIAL|MISS>

Per spec §8 calibration step. 3-run mobile LHCI pass against branch
HEAD with all three perf fixes (font split, critical-CSS inline, Hero
RSC conversion) applied.

Observed LCP p50: <N>ms (target < 1800ms; pre-fix baseline 3071ms).
Performance score: <N> (target >= 0.95; pre-fix 0.93).

Decision: <SUCCESS | PARTIAL | MISS> per spec §8.

<If SUCCESS:> Unblocks Spec 1.5 (mobile LHCI gate ship). Next: open
PR via superpowers:finishing-a-development-branch.

<If PARTIAL:> Opens Perf-Fix #2 spec for follow-up. The gate gap
remaining is <metric>: observed <N>, target <T>.

<If MISS:> Brainstorm restart required. Deeper diagnostic needed —
see plan calibration notes.
EOF
)"
```

Replace `<SUCCESS|PARTIAL|MISS>`, `<N>`, etc. with actual values.

---

## Calibration evidence

(This section is populated during Task 4 Step 4.6. Leave blank until then.)

---

## Self-review notes (writing-plans skill)

Cross-checked against the spec on 2026-05-18:

**Spec coverage:**
- Spec §4 (Fix A) → Task 1, including the abort criterion gating Step 1.2 and the audit count requirement in the commit message
- Spec §5 (Fix B) → Task 3, including the explicit drift-test scope-limitation docblock per the architect-review correction
- Spec §6 (Fix C) → Task 2, with the `matchMedia` boot-animation strategy and variant-prop pseudocode adopted in Step 2.4
- Spec §7 (testing strategy) → tests created in Steps 1.3, 2.2, 3.2 cover all source-grep assertions named in the spec
- Spec §8 (success criterion) → Task 4 Steps 4.4 + 4.5 + decision rule explicit
- Spec §9 risks → R3 (boot animation race) mitigated by Step 2.4 `matchMedia` approach; R1 (drift) mitigated by Step 3.2 test; R5 (calibration miss) handled by Task 4 Step 4.5 PARTIAL/MISS branches
- Spec §10 implementation order followed exactly (A → C → B → calibration)
- Spec §1 estimates-are-bounds framing reflected in Task 4 Step 4.5 decision rule (it's empirical, not predictive)

**Placeholder scan:**
- Audit count `<N>` and `<M>` in Task 1 Step 1.12 are intentional — implementer fills in actual values from Step 1.2
- Calibration `<N>` / `<DELTA>` in Task 4 Step 4.6 are intentional — implementer fills in measured values
- Hero.tsx code in Task 2 references existing markup the implementer reads from the file (Step 2.1 is the read step)
- Critical-CSS extraction (Step 3.1) is an extraction operation, not a placeholder — the implementer reads source CSS and copies matching rules

**Type consistency:**
- `BootCtrl` type declared in Step 2.4 (HeroBootAnimation.tsx) is the same name used in original Hero.tsx (Step 2.5 moves it verbatim)
- `monoBody` / `monoBold` identifiers consistent across Steps 1.5, 1.6, 1.7
- `CRITICAL_CSS` constant name consistent across Steps 3.2, 3.4, 3.5
- `--font-mono-bold` and `--font-mono-bold-stack` distinct (font variable vs. CSS-side stack ref) — both used per spec §4
- `variant: 'desktop' | 'mobile'` literal type consistent across Steps 2.4, 2.5, 2.7

If any reader finds a divergence between this plan and the spec, the spec wins; flag and fix.
