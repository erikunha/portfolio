# CSS System Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the CSS system from documented-but-unenforced tokens to an enforced system — single-source breakpoints, a real spacing scale, a z-index scale, literal alpha tokens, a shared panel primitive, tokenized durations, and a fixed focus indicator — with zero visual or perf-budget regression.

**Architecture:** Token-first, gate-backed. New tokens are minted in `design-system/tokens/*.json` (Style Dictionary source), built to `dist/tokens.css`, and consumed via `var()`/`@custom-media`. Each category's enforcement gate is tightened in the same milestone so debt cannot re-accumulate. Work is ordered by regression risk: build spikes → pure-addition tokens → snapshot-gated extractions → breakpoint migration → spacing snap.

**Tech Stack:** Next.js 16 (Turbopack), Lightning CSS, CSS Modules, Style Dictionary, Vitest, Playwright (4-project visual matrix), LHCI, axe-core, Biome.

**Source spec:** `docs/superpowers/specs/2026-05-30-css-system-review.md` (HEAD `18636aa`). Read it first — it cites every file:line this plan acts on.

**Execution constraints (all milestones):**
- Work in an isolated git worktree (`superpowers:using-git-worktrees`) — a parallel session has swapped HEAD mid-task before.
- Stage with `git add <specific files>` — never `git add .`/`-A`.
- Every token-minting commit runs `pnpm tokens:build` and stages `design-system/dist/tokens.css` in the SAME commit (`tokens:check` does `git diff --exit-code dist/`).
- Before editing any test: run `pnpm dev` + Playwright MCP visual check (desktop 1280×720 + mobile 375×812) on the affected sections. Tests assert observed behavior.
- Before any push: full 5-agent battery (`pr-review-toolkit:review-pr`, `accessibility-tester`, `security-auditor`, `performance-engineer`, `dependency-manager`) + `pnpm ci:local` + `pnpm gates:runtime`, then `pnpm review:stamp`.
- Split PRs by milestone; run `pnpm pr-size` after each commit block.

---

## File structure

| File | Responsibility | Milestone |
|---|---|---|
| `design-system/tokens/layer.json` (new) | z-index scale source | M1 |
| `design-system/tokens/motion.json` (modify) | add emphasized cubic-bezier easing tokens | M1 |
| `design-system/tokens/typography.json` (modify) | add `--ds-font-size-micro` | M1 |
| `design-system/tokens/color.json` (modify) | add `--ds-overlay-*` / `--ds-glow-*` alpha tokens | M2 |
| `design-system/dist/tokens.css` (generated) | build output, committed with each token change | M1, M2 |
| `app/css/_breakpoints.css` (new) | `@custom-media` breakpoint definitions OR generated `@media` source | M3 |
| `scripts/lint-breakpoints.mjs` (new) | net-new gate: ban raw width `@media` outside `_breakpoints.css` | M3 |
| `scripts/check-tokens-resolve.mjs` (new, spike) | build-output assertion that `@custom-media` resolved | M0 |
| `next.config.ts` (modify) | `experimental.lightningCssFeatures: ['custom-media-queries']` | M0 |
| `scripts/lint-no-magic-values.allowlist.json` (modify) | allowlist diet after spacing snap | M4 |
| `components/**/*.module.css`, `design-system/components/**/*.module.css` | per-site token migrations | M1–M4 |
| `design-system/components/WindowChrome/` (new) | shared traffic-light primitive | M2 |
| `DECISIONS.md` (modify) | one ADR bullet per milestone | all |

---

## Milestone 0 — Build-capability spikes (BLOCKS M3 and M4)

Two unvalidated assumptions from architect-review. Resolve before writing any migration code. Pure investigation; no production CSS changes except the config + a throwaway probe reverted at the end.

### Task 0.1: Enable Lightning CSS custom-media feature

**Files:**
- Modify: `next.config.ts`

- [ ] **Step 1: Read current config**

Run: `cat next.config.ts` — confirm there is no existing `experimental.lightningCssFeatures` key.

- [ ] **Step 2: Add the feature flag**

Add to the Next config object:

```ts
experimental: {
  lightningCssFeatures: ['custom-media-queries'],
},
```

- [ ] **Step 3: Verify dev + build boot**

Run: `pnpm build 2>&1 | grep -E 'error|Error|Compiled|✓' | tail -10`
Expected: build completes, no config error.

- [ ] **Step 4: Commit**

```bash
git add next.config.ts
git commit -m "build(css): enable Lightning CSS custom-media-queries feature"
```

### Task 0.2: Gate-zero spike — does `@custom-media` resolve inside a `.module.css`?

This is the load-bearing question. `@custom-media` substitutes per CSS-processing unit at compile time; a definition imported into the global graph may not be visible inside a separately-compiled CSS Module.

**Files:**
- Create (throwaway): `app/css/_breakpoints.probe.css`, a probe class in any existing `*.module.css`
- Create: `scripts/check-tokens-resolve.mjs`

- [ ] **Step 1: Define a probe custom-media in a globally-imported file**

Create `app/css/_breakpoints.probe.css`:

```css
@custom-media --probe-bp (max-width: 768px);
```

Add `@import "./css/_breakpoints.probe.css";` to `app/globals.css` (after tokens import).

- [ ] **Step 2: Use the probe inside an existing CSS Module**

In `components/responsive/Module/Module.module.css`, temporarily add at end:

```css
@media (--probe-bp) {
  .root { outline: 3px solid magenta; }
}
```

- [ ] **Step 3: Build and inspect the emitted CSS**

Run: `pnpm build 2>&1 | tail -5` then locate the Module chunk in `.next/` and grep for the probe:

Run: `grep -rl "magenta" .next/static/chunks/*.css | head` and inspect whether the rule emitted as `@media (max-width: 768px)` (RESOLVED) or `@media (--probe-bp)` / dropped (NOT RESOLVED).

- [ ] **Step 4: Record the verdict in the spec-gate record**

If RESOLVED: M3 uses `@custom-media` as designed.
If NOT RESOLVED: M3 falls back to a generated `@media` snippet (Task 3.1b) — a single breakpoint source emitted into each module via a Style Dictionary custom format or a codegen step. Document which branch in `DECISIONS.md`.

- [ ] **Step 5: Revert the probe, keep the verdict**

```bash
git checkout app/globals.css components/responsive/Module/Module.module.css
rm app/css/_breakpoints.probe.css
```

Add the verdict to `DECISIONS.md`:

```bash
git add DECISIONS.md
git commit -m "docs(css): record @custom-media cross-module resolution spike result"
```

### Task 0.3: Grid decision — 4px snap vs 2px sub-grid (BLOCKS M4)

**Files:**
- Modify: `DECISIONS.md`

- [ ] **Step 1: Tally the off-scale dominants**

From the spec C1: `6px ×52, 10px ×45, 14px ×41, 18px ×24`. These four are 162 of the off-scale declarations. On a 4px grid they snap to `4/8`, `8/12`, `12/16`, `16/20`. The question: are 6/10/14/18 load-bearing (chosen to fit content) or arbitrary?

- [ ] **Step 2: Spot-check 5 representative sites for load-bearing intent**

Visually inspect (Playwright MCP) `GuitarSection` (`11px 13px`), `Footer` (`gap: 18px`), `page.module.css` (`14px`), a card padding (`16px 16px 18px`), `DawMixer` (`5px 4px 6px`). Decide per-value whether snapping changes the intended look.

- [ ] **Step 3: Record the decision**

Recommended default: **keep 4px, snap off-scale values, mint NO half-steps** (half-steps re-legitimize drift). Treat 6/10/14/18 as snap-to-nearest with per-site visual confirmation in M4. Exception: genuine icon/hairline geometry stays raw and allowlisted.

```bash
git add DECISIONS.md
git commit -m "docs(css): adopt 4px grid — snap off-scale spacing, no half-step tokens"
```

---

## Milestone 1 — Pure-addition tokens (no visual change)

z-index scale, duration/easing tokens, micro-font token, and the focus fix. None changes layout; all are mechanical `var()` swaps where the literal equals the token, plus one a11y fix. Visual baselines should NOT move (a moved baseline here = a real regression to investigate).

### Task 1.1: Mint the z-index scale

**Files:**
- Create: `design-system/tokens/layer.json`
- Generated: `design-system/dist/tokens.css`
- Test: `design-system/tokens/__tests__/layer.test.ts` (or existing token test harness)

- [ ] **Step 1: Write the failing token test**

```ts
import tokens from '../../dist/tokens.json';
test('z-index scale is defined and strictly ordered', () => {
  const z = (k: string) => Number(tokens[`--ds-z-${k}`]);
  expect(z('base')).toBeLessThan(z('content'));
  expect(z('content')).toBeLessThan(z('chrome'));
  expect(z('chrome')).toBeLessThan(z('dock'));
  expect(z('dock')).toBeLessThan(z('skiplink'));
});
```

- [ ] **Step 2: Run, verify it fails**

Run: `pnpm test --run layer.test 2>&1 | tail -5`
Expected: FAIL (tokens undefined).

- [ ] **Step 3: Create the token source**

`design-system/tokens/layer.json`:

```json
{
  "z": {
    "base":     { "value": 0 },
    "content":  { "value": 10 },
    "chrome":   { "value": 110 },
    "dock":     { "value": 120 },
    "skiplink": { "value": 9999 }
  }
}
```

Map the existing stack: CRT 1–5 stay as a local (non-token) effect stack documented in `CRTOverlay.module.css`; `MobileTitleBar` (109) → resolve relative to chrome (see Task 1.2); `ToTopButton` (115) → between chrome and dock.

- [ ] **Step 4: Build tokens, run test**

Run: `pnpm tokens:build && pnpm test --run layer.test 2>&1 | tail -5`
Expected: PASS.

- [ ] **Step 5: Commit (with built dist)**

```bash
git add design-system/tokens/layer.json design-system/dist/tokens.css design-system/tokens/__tests__/layer.test.ts
git commit -m "feat(tokens): add --ds-z-* layer scale"
```

### Task 1.2: Migrate z-index usages + resolve the 110 collision

**Files:**
- Modify: `components/responsive/DesktopTopbar/DesktopTopbar.module.css:6`, `components/responsive/StatusBar/StatusBar.module.css:4`, `components/responsive/MobileTitleBar/MobileTitleBar.module.css:4`, `components/responsive/Dock/Dock.module.css:6`, `components/client/ToTopButton/ToTopButton.module.css:13`, `components/sections/Hero/Hero.module.css:232`, `app/page.module.css:5`, `app/css/_base.css:109`

- [ ] **Step 1: Decide the DesktopTopbar/StatusBar co-planarity**

Both are 110. They never render at the same viewport (DesktopTopbar is desktop, StatusBar is mobile chrome). Confirm via the responsive visibility rules, then assign both `var(--ds-z-chrome)` deliberately (documented co-planar) OR split if they ever co-exist. Document the finding.

- [ ] **Step 2: Replace each raw z-index with the token**

Example (`Dock.module.css:6`): `z-index: 120;` → `z-index: var(--ds-z-dock);`. Repeat per file. MobileTitleBar 109 → `calc(var(--ds-z-chrome) - 1)`; ToTopButton 115 → document as `var(--ds-z-chrome)` + stacking-context note or a dedicated mid token if needed.

- [ ] **Step 3: Verify no stacking-context trap**

Playwright MCP: confirm dock sits above content, skip-link above all, to-top above content, on both viewports. A token cannot rescue a z-index trapped under a `will-change`/`transform` ancestor — verify visually, not just by value.

- [ ] **Step 4: Tighten the gate**

Update `scripts/lint-no-magic-values.mjs` z-index error message to reference the real `--ds-z-*` token; keep the allowlist z-index entries only for the documented CRT 1–5 effect stack.

- [ ] **Step 5: Run gates + commit**

Run: `pnpm check && pnpm typecheck && node scripts/lint-no-magic-values.mjs 2>&1 | tail -5`

```bash
git add components/responsive/DesktopTopbar/DesktopTopbar.module.css components/responsive/StatusBar/StatusBar.module.css components/responsive/MobileTitleBar/MobileTitleBar.module.css components/responsive/Dock/Dock.module.css components/client/ToTopButton/ToTopButton.module.css components/sections/Hero/Hero.module.css app/page.module.css app/css/_base.css scripts/lint-no-magic-values.mjs
git commit -m "refactor(css): migrate z-index to --ds-z-* scale; resolve 110 collision"
```

### Task 1.3: Tokenize the 6 token-equal durations + add emphasized easing

**Files:**
- Modify: `design-system/tokens/motion.json`
- Modify: `components/responsive/Module/Module.module.css:143`, `components/sections/Hero/Hero.module.css:20,236,241,376`, `components/client/ContactForm/ContactForm.module.css:31`
- Generated: `design-system/dist/tokens.css`

- [ ] **Step 1: Add emphasized easing tokens** (the cubic-beziers already used in Module/Footer)

`motion.json` add: `ease-emphasized-out: cubic-bezier(0.33, 1, 0.68, 1)`, `ease-emphasized-in: cubic-bezier(0.32, 0, 0.67, 0)`.

- [ ] **Step 2: Build tokens**

Run: `pnpm tokens:build`

- [ ] **Step 3: Replace the 6 token-equal hardcodes**

`80ms`→`var(--ds-duration-fast)`, `200ms`→`var(--ds-duration-base)`, `300ms`→`var(--ds-duration-slow)` at the 6 cited sites ONLY. Do NOT touch off-scale animation timings (250/220/280ms etc.) — those stay allowlisted (animation feel, not a token).

- [ ] **Step 4: Visual check** — Playwright MCP: chevron rotate, hero shake, contact submit feel unchanged.

- [ ] **Step 5: Commit**

```bash
git add design-system/tokens/motion.json design-system/dist/tokens.css components/responsive/Module/Module.module.css components/sections/Hero/Hero.module.css components/client/ContactForm/ContactForm.module.css
git commit -m "refactor(css): tokenize token-equal durations; add emphasized easing tokens"
```

### Task 1.4: Add `--ds-font-size-micro` and migrate the 9px labels

**Files:**
- Modify: `design-system/tokens/typography.json`
- Modify: `LivePerfSection:105`, `NpmStackSection:58`, `AiMetricsSection:102`, `HottestTakesSection:111`, `InteractiveShell:290`
- Generated: `design-system/dist/tokens.css`

- [ ] **Step 1: Decide value** — `9px` recurs 5×; either promote to `--ds-font-size-micro: 9px` or round to the existing 10px (`--ds-font-size-xs`). Recommended: promote to `micro` (these are intentional CRT metadata labels per `_base.css:168` comment).
- [ ] **Step 2: Add token, build** — `pnpm tokens:build`.
- [ ] **Step 3: Migrate 5 sites** to `var(--ds-font-size-micro)`; remove `9px` from the allowlist.
- [ ] **Step 4: Visual + gate check** — labels render identically; `node scripts/lint-no-magic-values.mjs`.
- [ ] **Step 5: Commit** `refactor(css): add --ds-font-size-micro; migrate 9px labels`.

### Task 1.5: Fix the InteractiveShell focus indicator (I2 — a11y)

**Files:**
- Modify: `components/client/InteractiveShell/InteractiveShell.module.css:115-117`
- Test: `components/client/InteractiveShell/InteractiveShell.test.tsx`

- [ ] **Step 1: Write the failing a11y test** — assert the input has a visible focus indicator other than the caret (outline width > 0 on `:focus-visible`).

```ts
test('shell input shows a focus-visible outline', () => {
  // render, focus input, assert computed outline-style !== 'none' on :focus-visible
});
```

- [ ] **Step 2: Run, verify fail.**
- [ ] **Step 3: Replace the suppression** — remove `outline: none` on bare `.input:focus`; add `.input:focus-visible { outline: 2px solid var(--ds-color-signal); outline-offset: 2px; }` while keeping the block caret. Use `outline` (no layout shift), not `border`.
- [ ] **Step 4: Verify** — test passes; Playwright MCP: caret animation intact, ring visible on keyboard focus, no layout shift; axe-core clean.
- [ ] **Step 5: Commit** `fix(shell): restore focus-visible ring on input (WCAG 2.4.7)`.

### Task 1.6: Token nits (M4 findings)

- [ ] `--ds-radius-none: 0px` → `0` in `border.json`; rebuild; commit.
- [ ] Collapse or differentiate `--ds-text-size-2xs`/`-xs` (both 10px) in `typography.json` — decide if 2xs should be 9px (the micro case) or removed; rebuild; commit.

---

## Milestone 2 — Alpha tokens + structural extractions (snapshot-gated)

Visual baselines MAY shift by sub-pixel anti-aliasing on extraction; eyeball every changed snapshot. No layout change intended.

### Task 2.1: Mint literal alpha tokens (`--ds-overlay-*`, `--ds-glow-*`)

**Files:** `design-system/tokens/color.json`, generated `dist/tokens.css`.

**Approach:** Enumerate the distinct alpha families from the spec/allowlist: scrim blacks (`rgba(0,0,0,0.22/0.4/0.5/0.55/0.6/0.65/0.7/0.85/0.92)`) → `--ds-overlay-{05..95}`; glow greens (`rgba(0,255,65,0.015..0.6)`) → `--ds-glow-*`. Use literal `rgba()` values (NOT `color-mix()` — browserslist floor is below `color-mix` support; static literals only).

- [ ] Test: assert each new token resolves to the expected rgba literal.
- [ ] Build + migrate the 3 exact-match violations (`InteractiveShell:195`, `Dock:41`, `Footer:326`) to existing `--ds-color-signal-quiet`/`-faint`.
- [ ] Migrate scrim/glow literals to the new tokens; keep CRT sub-pixel mask values (`CRTOverlay:41-46`) raw + documented as effect-layer exception in the allowlist.
- [ ] Tighten `lint-token-boundary`/allowlist to cover module-CSS color functions.
- [ ] Visual diff every affected section; commit per logical group.

**Failure modes to guard (inversion):** literal rgba must be byte-identical to the original (no interpolation drift); contrast-check must still pass; do not migrate the CRT mask.

### Task 2.2: Shared panel primitive (I3)

**Files:** `design-system/components/TerminalPanel/`, the 27 consuming `*.module.css`, `design-system/tokens/color.json` (add `--ds-color-surface-panel`).

**Approach:** Route sections through `TerminalPanel` (or compose a `.panel` token rule) instead of hand-rolling `1px solid var(--ds-color-signal-subtle)`. Add `--ds-color-surface-panel` for the translucent fill. Pick ONE border convention; document when `signal-subtle` vs `border-default` applies.

- [ ] Per-site: verify the existing markup/descendant-chain selectors survive the primitive (extraction must be opt-in per verified-equivalent site, NOT a blanket replace — the two border conventions are different colors, not redundant).
- [ ] Visual diff each migrated section before committing it.

**Failure modes:** DOM change breaks `.root X Y` descendant selectors; `border-default` sites are intentionally a different color — do not fold them into `signal-subtle`.

### Task 2.3: Window-chrome primitive (I4)

**Files:** `design-system/components/WindowChrome/` (new), `MobileTitleBar`, `InteractiveShell`, `DesktopTopbar`.

**Approach:** One presentational (RSC, NO `'use client'`) component for the traffic-light dots; size via prop/CSS var; the three call sites consume it. Consolidate the three `--ds-chrome-*` declarations.

- [ ] Reconcile the divergent sizes (9px vs 10px) — pick canonical, accept per-call-site size prop.
- [ ] Visual diff all three sites.

**Failure modes:** must not become a client island (budget); size differences may be intentional per context — expose as prop, don't force-unify.

---

## Milestone 3 — Breakpoint contract (gated on Task 0.2)

### Task 3.1a (if Task 0.2 RESOLVED): `@custom-media` contract

**Files:** `app/css/_breakpoints.css` (new), `app/globals.css`, the 48 canonical query sites, `scripts/lint-breakpoints.mjs` (new).

- [ ] Create `_breakpoints.css` with `--bp-mobile`, `--bp-mobile-up`, `--bp-tablet`; import first in `globals.css`. Derive `--bp-mobile-up` from the same 768 source (or assert the 768/769 invariant in a test) so the off-by-one is not re-created.
- [ ] Migrate the 48 sites (spec §1 lists every file:line) to `@media (--bp-*)`. Values are byte-identical → visual baselines must NOT move (a moved baseline = a typo'd migration).
- [ ] Justify-in-comment or eliminate the 4 orphans (1080/560/359/340); fix the NpmStack non-monotonic ladder if the layout model allows.
- [ ] Write `scripts/lint-breakpoints.mjs` (net-new — `lint-no-magic-values` strips `@media` by design): reject raw width `@media` outside `_breakpoints.css`; allow `prefers-reduced-motion`/feature queries (guard against that false-positive). Add to `ci:local`.

### Task 3.1b (if Task 0.2 NOT RESOLVED): generated `@media` fallback

**Files:** a Style Dictionary custom format or codegen producing per-module `@media` snippets from one breakpoint source; same 48-site migration; same net-new gate.

- [ ] One breakpoint source of truth; emitted as literal `@media` into each module at build. Same migration + gate as 3.1a; the only difference is the substitution mechanism. Document the mechanism in `DECISIONS.md`.

**Failure modes (both branches):** the new gate must not flag `prefers-reduced-motion`; the 768/769 pair must derive from one value; identical values mean zero visual diff — any diff is a migration bug.

---

## Milestone 4 — Spacing snap (highest risk, gated on Task 0.3, per-section)

### Task 4.1: Fix the off-grid semantic-token overrides (isolated commit)

**Files:** `app/css/_base.css:164,166,208`.

- [ ] Snap `--ds-space-rhythm` (18px→16 or 20) and `--ds-space-pad` (14px→16, 18px→16 or 20) at mobile/tablet to scale values. This touches EVERY consumer at once — isolated commit, full visual diff on every section both viewports. This is the single highest-blast-radius change in the plan.

### Task 4.2: Per-section raw-px → token sweep

**Files:** the section/client modules (spec C1 enumerates every off-scale value + file).

**Approach:** ONE section per commit. For each: replace on-scale raw px with the matching `--ds-space-*` token (or semantic alias); snap off-scale per the Task 0.3 decision with a per-site visual check (off-scale values may be load-bearing — 6px gap sized to text → 8px may wrap). Do NOT tokenize WCAG touch-targets (44/48/52px) into the space scale — they are semantic, leave allowlisted. Watch `contain-intrinsic-size: auto 520px` on deferred sections — padding changes can shift CLS (<0.05 budget).

- [ ] Per section: edit → `pnpm dev` + Playwright MCP desktop+mobile diff → if intended, update baseline deliberately (never blind `--update-snapshots`) → `pnpm check` → commit.

### Task 4.3: Allowlist diet

**Files:** `scripts/lint-no-magic-values.allowlist.json`.

- [ ] After the sweep, remove every px entry that now has a token; keep ONLY genuine geometry (icon sizes, hairlines, fixed grid columns) with reasons rewritten as "geometry," not "pre-token." Run `node scripts/lint-no-magic-values.mjs` — it must pass with the slimmed allowlist, proving the property (real token adoption), not the gate.

**Failure modes:** blind snapshot acceptance masks regressions; touch-targets must stay raw; CLS budget on deferred sections; over-aggressive allowlist diet → CI red on legit geometry → resist re-widening.

---

## Self-review

- **Spec coverage:** C1→M0.3+M4; C2→M0.2+M3; I1→M1.1–1.2; I2→M1.5; I3→M2.2; I4→M2.3; I5→M1.3; I6→M2.1; M1(unguarded transitions)→fold into M2 review; M2(9px)→M1.4; M3(descendant chains)→addressed opportunistically during M2.2 extraction; M4(token nits)→M1.6; M5(rem/px)→M4 sweep; M6(#000)→M2.1. All spec findings mapped.
- **Placeholder scan:** M0/M1 carry full TDD code. M2–M4 are deliberately task-breakdowns (files + approach + per-task failure modes), because their exact per-site code is mechanical and depends on the M0 spike outcome (M3) and the grid decision (M4) — writing exact diffs now would be fabricated, not concrete. The spec's file:line index is the per-site source.
- **Type/name consistency:** token names consistent (`--ds-z-*`, `--ds-overlay-*`, `--ds-glow-*`, `--ds-font-size-micro`, `--ds-ease-emphasized-*`, `--ds-color-surface-panel`); gate script names consistent (`lint-breakpoints.mjs`, `check-tokens-resolve.mjs`).
