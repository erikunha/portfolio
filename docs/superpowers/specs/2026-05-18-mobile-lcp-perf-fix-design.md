# Mobile LCP Perf-Fix — Under 1800ms

> **Perf-fix spec** blocking Spec 1.5 (mobile LHCI workflow ship).
> Triggered by Spec 1 Task 4 calibration finding: observed mobile LCP 3071ms vs 1800ms target (70% over).
> Sibling to the 8-pillar harness trilogy (`2026-05-18-gates-and-harness-hardening-design.md` Spec 1; Specs 2 + 3 still pending).
>
> **Author:** Erik Henrique Alves Cunha
> **Date:** 2026-05-18
> **Status:** Draft (pending architect-reviewer four-gate)
> **Source:** calibration evidence in `docs/superpowers/plans/2026-05-18-gates-and-harness-hardening.md` (pre-perf-fix snapshot)

---

## 1. Purpose

Close the 1271ms LCP gap discovered by Spec 1 Task 4 calibration so the mobile LHCI gate can ship at its target threshold (`< 1800ms`) without the "turn off the gate to merge" anti-pattern explicitly forbidden in CLAUDE.md.

Three coordinated fixes target the three measured contributors:

- **Font preload competition** — currently preloading 3 woff2 weights (64KB) when only weight 400 is on the LCP critical path
- **Render-blocking CSS** — single 47KB raw / ~9.7KB gzip chunk blocks render-tree construction before LCP element paints (~303ms penalty measured)
- **Hero hydration delay** — entire Hero component is `'use client'`, so the LCP element (`p.hero__tagline`, static SSR text inside Hero) carries hydration cost

Single PR, three commits (one per fix), one post-merge calibration confirms success.

**On the per-fix LCP-impact estimates (architect-review-required framing):** every per-fix LCP delta cited in this spec is an *upper-bound guide*, not a measurement or a prediction. The 303ms render-block penalty is measured (Lighthouse calibration evidence); the per-fix recovery numbers (0-100ms, 200-400ms, 200-500ms) are author-estimated bounds informed by typical LCP attribution patterns, not empirical claims about THIS site. The only truth signal is the post-merge `pnpm lhci:mobile` 3-run pass (§8). If the cumulative estimates don't close to 1800ms in practice, the spec's failure path in §8 takes over — open Perf-Fix #2.

---

## 2. Scope

### In scope (three fixes)

| # | Fix | Primary target | Surface |
|---|---|---|---|
| A | Font preload tuning — split `localFont()` into per-weight instances; preload only weight 400 (`monoBody`); defer 500+700 (`monoBold`) | Slow-4G bandwidth contention | `app/layout.tsx` (~10 lines) + CSS audit for weight-500/700 selectors |
| B | Critical-CSS inline — extract Hero-essential rules from `_tokens.css` + `_base.css` + `_layout.css` + `_sections.css` into a `<style>` block in `layout.tsx` `<head>`; full chunk continues loading normally | Render-block on LCP critical path | `app/layout.tsx` (~50-100 lines inlined) + vitest drift test |
| C | Hero RSC conversion — extract boot animation + sysfail headline into client islands; main Hero becomes RSC; CSS media-query toggles between `.hero--desktop` and `.hero--mobile` variants | Hydration-blocked LCP paint | `components/sections/Hero.tsx` (444 → ~250 RSC) + 2 new tiny client islands + CSS toggle rules |

### Out of scope

- New perf budgets or threshold changes (the 1800ms target stays; goal is to meet it, not move it)
- Touching anything outside the Hero LCP critical path (Matrix rain, CRT overlay, other 17 sections)
- Adding new dependencies (no Beasties, Critters, or similar build-time tools — would contradict DECISIONS.md 2026-05-18 "no extra PostCSS plugins beyond what Lightning CSS provides natively")
- Modifying `lighthouserc.mobile.json` thresholds
- Changes to the harness-hardening branch (PR #9) — that ships independently
- Spec 2 (Observability) and Spec 3 (LLM provider abstraction) — separate trilogy specs

### Anti-goals (explicit non-goals)

- Will **not** use `font-display: optional` — suppresses fallback paint, hurts perceived perf even if it games LCP metric
- Will **not** inline ALL CSS into HTML — defeats cacheability, grows HTML by ~10KB per page load every visit
- Will **not** split Hero into separate desktop/mobile bundles — over-engineering for a single-page composition
- Will **not** redesign Hero's visual appearance — preserving the aesthetic is non-negotiable
- Will **not** introduce CSS Modules / CSS-in-JS to scope Hero styles — contradicts the CSS architecture lock-in from DECISIONS.md 2026-05-18
- Will **not** use the `media="print"` + `onload` swap trick for CSS — FOUC, CSP widening, React friction

---

## 3. Reversibility profile

Each fix is single-commit-revertable. Aggregate reversal: revert the three commits.

| Fix | Reversal |
|---|---|
| A | Revert layout.tsx to single `localFont()` call; CSS audit changes are mechanical reverts |
| B | Delete the inlined `<style>` block from layout.tsx; delete the drift test |
| C | Revert Hero.tsx to monolithic `'use client'`; delete the two new island files; revert CSS toggle rules |

---

## 4. Fix A — Font preload tuning

**Outcome:** Only the LCP-critical font weight competes for Slow-4G bandwidth at first paint.

### Honest LCP-impact assessment

This fix has **marginal direct LCP impact** because `font-display: swap` is already in place. The LCP element paints with the fallback font; woff2 swap happens later (which can update the LCP timestamp if metrics change, but only marginally). Preloading fewer weights saves ~215ms of parallel bandwidth contention but doesn't directly unblock the LCP element from painting.

It's worth doing as a "free" infrastructure tune (no good reason to preload weights not used in viewport-zero), but expect the dominant LCP wins to come from Fixes B and C.

### What

Two `localFont()` calls instead of one:
- `monoBody` — weight 400 only, `preload: true`, variable `--font-mono`
- `monoBold` — weights 500 + 700, `preload: false`, variable `--font-mono-bold`

### Where

**`app/layout.tsx`** — replace the single `mono` declaration:

```ts
// Weight 400 is the LCP-critical weight (Hero tagline, body copy throughout).
// Preload eagerly so it's downloading in parallel with the CSS chunk.
const monoBody = localFont({
  src: [{ path: '../public/fonts/jetbrains-mono-400.woff2', weight: '400', style: 'normal' }],
  variable: '--font-mono',
  display: 'swap',
  preload: true,
});

// Weights 500 + 700 are used for headings + emphasis throughout the page but
// not on the LCP critical path. Defer their preload — they load lazily on
// first use (when a 500/700-weight element first paints). Saves ~43KB of
// parallel bandwidth contention on Slow 4G.
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

Apply both variables in the `<html>` className:
```tsx
<html lang="en" className={`${monoBody.variable} ${monoBold.variable} ${display.variable}`} suppressHydrationWarning>
```

**CSS audit** — every selector currently relying on weight 500/700 with `font-family: var(--font-mono-stack)` needs to reference the bold variable instead. Approach:

1. Update `_tokens.css` to define `--font-mono-bold-stack`:
   ```css
   --font-mono-bold-stack: var(--font-mono-bold), ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
   ```
2. Grep CSS for `font-weight: 500` and `font-weight: 700` (and `font-weight: bold`). For each selector, confirm or add `font-family: var(--font-mono-bold-stack)` so the bold font is requested when that element paints.

**Abort criterion (architect-review-required):** the implementer MUST count the affected selectors and files in Step 1 of the implementation. If the audit touches more than **10 selectors across more than 2 CSS files**, drop Fix A from this PR and defer to a separate sub-spec. Rationale: Fix A's direct LCP impact is acknowledged as marginal (see assessment above); if the CSS audit balloons, the regression risk (weight-500 elements rendering at weight 400) outweighs the bandwidth-contention saving. A 30-minute bounded audit is acceptable; a 3-hour audit with cross-file risk is not. The implementer's report MUST include the audit count so the abort decision is auditable.

### Failure mode

If a 500/700 selector is missed in the CSS audit, the affected element renders with weight 400 (visually identical due to JetBrains Mono's design but technically wrong weight). Drift test (see §7) catches this.

### Edge case

A `font-weight: 500/700` element appearing above the fold (visible at first paint) would request the bold font synchronously, partially defeating the deferred preload. Spot-check: review which `.hero__*` selectors use weight 500/700 in `_sections.css`. If any are above the fold, decide per-case whether to keep them at weight 400 (visually similar) or accept the load.

---

## 5. Fix B — Critical-CSS inline + drift test

**Outcome:** Hero-essential CSS rules paint without waiting for the full chunk's render-block.

### What

Extract the minimum CSS rules needed to paint the LCP element (`p.hero__tagline`) and the visible-on-load chrome around it. Inline as a `<style>` block in `layout.tsx`'s `<head>`. The full CSS chunk continues loading normally as `<link rel="stylesheet">` — still render-blocks but the inlined critical rules render LCP-relevant content without waiting.

### Where

**`app/layout.tsx`** — add a `<style>` block at the top of `<head>` (before any other resource hints).

The inlined CSS is a module-scope string constant. React 18+ renders string children inside a `<style>` element directly — no escape-hatch prop needed. The pattern is:

```tsx
const CRITICAL_CSS = `
  /* Inlined critical rules — see Fix B drift test for selector list */
  :root { --bg: #000000; --signal: #00ff41; /* ... */ }
  * , *::before, *::after { box-sizing: border-box; }
  body { background: var(--bg); color: var(--fg); /* ... */ }
  .page { /* ... */ }
  .hero { /* ... */ }
  .hero__tagline { /* ... */ }
  /* ... ~50-100 lines total */
`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" /* ...className... */ suppressHydrationWarning>
      <head>
        <style>{CRITICAL_CSS}</style>
        <script type="application/ld+json">{personJsonLd}</script>
      </head>
      <body suppressHydrationWarning>{/* ... */}</body>
    </html>
  );
}
```

Initial extraction set (estimate ~50-100 lines, ~3-4KB of CSS):

1. **From `_tokens.css`:** ALL `:root` CSS variables (needed for any rule referencing `var(--*)`)
2. **From `_base.css`:** body/html font-family + color + background reset, `*, *::before, *::after { box-sizing: border-box }`
3. **From `_layout.css`:** `.page` container rules, `.page > section.hero` rules
4. **From `_sections.css`:** Hero-specific rules — `.hero`, `.hero--desktop`, `.hero--mobile`, `.hero__left`, `.hero__bio`, `.hero__name`, `.hero__tagline` (especially), `.hero__meta`, `.hero__status`, `.hero__ctas` and their immediate dependents

### Drift test

**`__tests__/critical-css-drift.test.ts`** — new source-grep test that asserts:

1. `layout.tsx` exports a `CRITICAL_CSS` constant (string).
2. Selectors mentioned in `CRITICAL_CSS` (extracted via regex on `.classname` patterns) ALL exist in the source CSS files under `app/css/`. If a Hero selector is renamed in `_sections.css` without updating `CRITICAL_CSS`, this test fails.
3. CSS variables referenced in `CRITICAL_CSS` (extracted via regex on `--variable-name`) ALL exist in `_tokens.css`. Same drift protection for token renames.

**Drift test scope — documented limitation (architect-review-required):** this test is **selector-existence + variable-existence**, NOT **rule-body equivalence**. It catches structural drift (a selector renamed or removed in source) and token drift (a CSS variable deleted from `_tokens.css`). It does NOT catch stylistic drift — if `.hero__tagline { font-size: 18px }` in source CSS changes to `font-size: 22px`, the inlined `CRITICAL_CSS` with the old `18px` keeps the test green but causes a visible LCP-element regression. Rule-body equivalence would require AST-level CSS parsing + hash comparison, judged out of scope (significant new tooling for a single drift class). Mitigation layers:

- Visual smoke from CI's axe-core run will surface obvious paint regressions
- Post-merge LHCI continues to measure LCP; sustained regression triggers Perf-Fix #2
- Any update to `.hero__*` rules SHOULD be paired with a manual `CRITICAL_CSS` review in the PR description

The test file's docblock MUST document this limitation explicitly so future maintainers don't mistake it for full equivalence.

### Failure mode

If the inlined block contains a selector that no longer exists in source CSS, the rule has no effect (no markup matches it). Lighthouse may even flag the unused selector. Drift test catches this on the next PR.

### Edge case

CSS specificity differs when rules come from `<style>` vs `<link>`. Both are stylesheets; specificity is by selector, not source. Risk minimal as long as critical rules are byte-identical to source.

### Trade-off acknowledged

Maintenance burden: every change to Hero markup or core tokens requires reviewing `CRITICAL_CSS` for staleness. Drift test mitigates by failing fast. Spec author accepts this as the cost of avoiding new build-time tooling per the project's "no extra plugins" architecture decision.

### Note on React + `<style>`

React 18.3+ renders raw string children inside `<style>` elements directly without escaping (it's a documented exception for style content). This means `<style>{CRITICAL_CSS}</style>` is the idiomatic pattern; no `dangerouslySetInnerHTML` escape-hatch is needed. CSP `style-src 'unsafe-inline'` is already present in `proxy.ts` (per DECISIONS.md), so no policy widening either.

---

## 6. Fix C — Hero RSC conversion

**Outcome:** LCP element (`p.hero__tagline`) is static SSR markup; no hydration on the critical path.

### What

Restructure `components/sections/Hero.tsx` from 444 lines all `'use client'` into:
- **`Hero.tsx`** (RSC) — renders BOTH `.hero--desktop` and `.hero--mobile` variants in DOM with all static content (h1, tagline, meta, status, CTAs). CSS media query toggles visibility. No client-side state, no `useEffect`, no `useRef`, no `useBreakpoint`.
- **`HeroBootAnimation.client.tsx`** (new, ~80 lines extracted) — wraps the boot-sequence terminal animation (`runBoot()` + `bootRef`). Mounted inside Hero as a slot.
- **`HeroSystemFailure.client.tsx`** (new, ~30 lines extracted) — wraps the SYSTEM FAILURE animation (`sysfailRef` + visibility logic). Mounted inside Hero as a slot.
- **`RoleTyper.tsx`** — unchanged (already a tiny client island).

### Where

- **`components/sections/Hero.tsx`** — restructured per above
- **`components/client/HeroBootAnimation.tsx`** — new
- **`components/client/HeroSystemFailure.tsx`** — new
- **`_layout.css` or `_sections.css`** — add CSS media-query toggle:
  ```css
  .hero--desktop { display: block; }
  .hero--mobile { display: none; }
  @media (max-width: 768px) {
    .hero--desktop { display: none; }
    .hero--mobile { display: block; }
  }
  ```

### Boot animation DOM-target strategy

The boot animation targets a specific DOM element via `bootRef`. With both variants in DOM, only the *visible* variant should run the animation.

**Approach (architect-review-corrected):** each variant mounts its own `<HeroBootAnimation variant="desktop"|"mobile" />` instance. Each instance gates on `window.matchMedia('(max-width: 768px)').matches` to decide whether to run — desktop instance runs when `matches === false`, mobile instance runs when `matches === true`. Pseudo:

```ts
'use client';
export function HeroBootAnimation({ variant }: { variant: 'desktop' | 'mobile' }) {
  const bootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const isMobileVP = window.matchMedia('(max-width: 768px)').matches;
    const shouldRun = variant === 'mobile' ? isMobileVP : !isMobileVP;
    if (!shouldRun) return;
    // ...existing runBoot(bootRef.current, ...) call
  }, [variant]);
  return <div ref={bootRef} className="hero__boot" />;
}
```

**Why `matchMedia` and not `getComputedStyle`:** at mount time during hydration, the route-level `<link rel="stylesheet">` may not have applied to the DOM yet, so `getComputedStyle(...).display` could read default `block` for both variants, causing both animations to run. `matchMedia` evaluates the viewport against the registered media query deterministically, independent of stylesheet load order. It's also the same primitive `useBreakpoint` already uses, so the project has precedent. Earlier draft of this spec proposed the `getComputedStyle` check — rejected after architect-review for this race condition.

Alternative considered and rejected: single mount with a CSS-based `querySelector` (`.hero--desktop:not([style*="display: none"]) .hero__boot`). Couples DOM lookup to CSS structure; brittle against any rule rename.

### Removed dependency

Hero no longer imports `useBreakpoint`. The hook stays in AppShell (still used for chrome decisions). No change to `lib/use-breakpoint.tsx`.

### Failure mode

If both variants render but the CSS toggle is wrong (e.g., both visible, or both hidden), the Hero shows duplicated content or nothing. Vitest test (see §7) verifies the CSS contains the toggle rules. Visual smoke is the second line of defense.

### Edge case

People who resize their browser across the 768px breakpoint mid-session won't get the runtime variant switch they'd get today (CSS reapplies the toggle, but the boot animation's mount-time check doesn't re-evaluate). Acceptable trade-off: mid-session breakpoint switching is a niche case for a portfolio site.

---

## 7. Testing strategy

| Fix | Test surface | Test type | Location |
|---|---|---|---|
| A | Source-grep: `layout.tsx` declares `monoBody` (weight 400, preload: true) + `monoBold` (weights 500+700, preload: false); both variables appear in `<html>` className. CSS audit: `--font-mono-bold` is referenced where weight 500/700 selectors live. | Vitest unit | new `__tests__/font-preload-split.test.ts` |
| B | Source-grep: `layout.tsx` exports `CRITICAL_CSS` constant; `<head>` contains the `<style>{CRITICAL_CSS}</style>` block. **Drift test:** all class selectors in `CRITICAL_CSS` (regex `\.[a-zA-Z][\w-]+`) exist in the source CSS files. All CSS variables (regex `--[a-zA-Z][\w-]+`) exist in `_tokens.css`. | Vitest unit | new `__tests__/critical-css-drift.test.ts` |
| C | Source-grep: `Hero.tsx` does NOT contain `'use client'`; `HeroBootAnimation.client.tsx` + `HeroSystemFailure.client.tsx` exist; both contain `'use client'`. `_layout.css` OR `_sections.css` contains the `.hero--desktop` / `.hero--mobile` media-query toggle. | Vitest unit | new `__tests__/hero-rsc.test.ts` |
| All three | **Post-merge calibration:** `pnpm lhci:mobile` 3-run pass returns LCP p50 < 1800ms AND Performance score ≥ 0.95. | Manual + LHCI | `lighthouserc.mobile.json` |

**Explicit non-tests:**
- No font-loading behavior test (browser/font API mocks would be more work than they're worth; LHCI is the truth-teller)
- No render-timing assertion (Lighthouse owns this)
- No E2E for Hero variant switching (covered by existing visual smoke from CI's axe-core run)

---

## 8. Success criterion

**Single binary check:** post-implementation `pnpm lhci:mobile` 3-run pass returns:
- LCP p50 < 1800ms
- Performance score ≥ 0.95
- All other thresholds in `lighthouserc.mobile.json` continue to pass

**Failure paths:**
- LCP closes to <2200ms but not <1800ms → open Perf-Fix #2 (likely targeting CSS chunk size or further Hero micro-trimming)
- LCP stays >2200ms → restart brainstorm with deeper diagnostic (DevTools tracing of the actual critical path)

---

## 9. Risks + reversibility

| # | Risk | Likelihood | Severity | Mitigation | Reversal |
|---|---|---|---|---|---|
| R1 | Critical-CSS drift — Hero/layout selector changes leave inlined block stale | Medium | Medium | Vitest drift test (Fix B §7) selector-equivalence assertion on every PR | Trivial — re-extract from source |
| R2 | Hero RSC "render both variants" pattern doubles DOM size, regressing hydration slightly | Low | Medium | Both variants are pure markup, no JS hydration per hidden variant (RSC); DOM size grows by ~5KB, well within budget | Revert Hero.tsx + delete islands |
| R3 | Boot animation breaks because `bootRef` lacks a stable target with both variants mounted | Medium | Medium | Recommended approach (each variant mounts its own island instance, hidden one no-ops via display check) keeps DOM-lookup local | Revert client island; restore monolithic Hero |
| R4 | Font split A.1 misses a `font-weight: 500/700` CSS rule still relying on `var(--font-mono)` | Low | Low | CSS audit as part of A.1; vitest source-grep test confirms `monoBold` referenced in expected files | Update missed rule (no commit revert needed) |
| R5 | Post-merge calibration misses 1800ms target | Medium | Low (informational, by design) | Spec's §8 failure path captures this — open Perf-Fix #2 follow-up | Spec stays valid; fix work continues |
| R6 | CSP `style-src 'unsafe-inline'` still required because of the inlined `<style>` block | Low | Low | Project already has `style-src 'unsafe-inline'` (per proxy.ts) — no new policy widening | n/a — pre-existing |

**Aggregate reversibility:** single-commit-revertable per fix. No data migrations, no schema changes, no destructive operations.

---

## 10. Implementation order

Per Block C, three sequential commits in a single PR:

1. **Fix A — Font split.** Smallest scope, validates dual-localFont pattern, CSS audit is bounded one-time work.
2. **Fix C — Hero RSC conversion.** Larger refactor; lands before Fix B because Fix B's critical-CSS extraction needs Hero's RSC markup to be stable.
3. **Fix B — Critical-CSS inline + drift test.** Lands last; benefits from Fix C's stable Hero markup so extracted selectors are accurate.
4. **Calibration.** Re-run `pnpm lhci:mobile` against branch HEAD. Capture 3-run output. Compare against 1800ms target. Pass = open PR; fail per §8 failure paths.

---

## 11. References

- Calibration evidence (pre-perf-fix snapshot): `docs/superpowers/plans/2026-05-18-gates-and-harness-hardening.md` "## Calibration evidence" section
- Triggering spec: `docs/superpowers/specs/2026-05-18-gates-and-harness-hardening-design.md` §4 (status update subsection)
- Architecture lock-in (constrains Fix B options): `DECISIONS.md` 2026-05-18 (CSS architecture lock-in bullet; "no extra PostCSS plugins beyond Lightning CSS")
- CSP context (justifies inline `<style>` block): `proxy.ts` + `DECISIONS.md` 2026-05-18 (CSP cleanup section)
- Hero current state: `components/sections/Hero.tsx` (444 lines, all `'use client'`)
- Font setup current state: `app/layout.tsx` lines 7-24
