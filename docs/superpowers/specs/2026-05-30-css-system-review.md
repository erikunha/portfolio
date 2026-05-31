# CSS System Review — erikunha.dev

> Date: 2026-05-30 · HEAD at review: `fc4ad88` · Branch: `refactor/data-attr-variants`
> Method: foundation pass (load-bearing files + gate scripts read directly) + 3 parallel
> read-only dimension reviewers (breakpoints / tokens+cascade / spacing+duplication+a11y+perf)
> over the ~50 source CSS files in `app/`, `components/`, `design-system/`. Worktrees, coverage,
> and build artifacts excluded.

## Thesis

The design system has a well-named token vocabulary and genuinely excellent perf/motion
engineering. The systemic weakness is **enforcement inversion**: where a token exists, code
mostly bypasses it, and the mechanical gates were widened to bless the bypass instead of the
code being snapped to the system. The result is a *documented* system sitting over an *ad-hoc*
reality, with green gates. This contradicts the project's own STANDARDS rule "fix the measured
property, not the gate."

Concretely, four token categories are effectively ungoverned (spacing, z-index, duration,
breakpoints), one a11y rule is violated once, and one structural primitive (the bordered panel)
is hand-rolled in 27 files instead of shared.

The evidence is strongest in spacing: **raw-step tokens `--ds-space-1..16` have zero `var()`
consumers anywhere**; only the 7 semantic aliases are used (~48 times) against **~328 raw-px
spacing declarations** — and the semantic tokens themselves resolve off-grid at mobile, so even
"using the token" emits off-scale values.

---

## Severity-ranked findings

Severity is calibrated to the "reference system" bar (architecture is the artifact): Critical =
the system's stated invariant is false; Important = real defect or systemic gap another team
would inherit; Minor = hygiene.

### CRITICAL

#### C1 — The 4px spacing scale is unenforced; the allowlist neutered its gate
- **Property that fails:** "token palette only, no magic values" (STANDARDS ch.7) for spacing.
- **Evidence:**
  - Raw-step tokens `var(--ds-space-1..16)` used **0 times**. Only semantic aliases consumed:
    `--ds-space-pad` ×20, `rhythm-tight` ×8, `pad-tight` ×8, `gap` ×5, `nano` ×4, `rhythm` ×2,
    `section` ×1. Against ~328 raw-px spacing declarations.
  - `scripts/lint-no-magic-values.allowlist.json` allowlists ~60 px values blessing nearly the
    entire 0–32px range (`12/13/14/16/18/20/22/24/26/28/30/32px`) plus dozens of layout
    constants up to 740px. The reasons openly concede defeat: `"14px — ds-space-3.5 equivalent;
    used as micro-layout across many components pre-token"`, `"12px — ds-space-3 = 12px,
    equivalent token exists but files migrated to module CSS retain numeric form"`.
  - **The semantic tokens leak off-grid at mobile** (`app/css/_base.css`): `:164`
    `--ds-space-rhythm: 18px` (≤768; desktop is 64px), `:166` `--ds-space-pad: 14px` (≤768),
    `:208` `--ds-space-pad: 18px` (769–900). So `--ds-space-pad` resolves to **24/18/14** across
    three viewports — two off the 4px grid. Using the token still produces off-scale output.
  - Off-scale raw px by frequency: `6px ×52, 10px ×45, 14px ×41, 18px ×24, 5px ×10, 3px ×9,
    22px ×5, 7px ×4, 9px ×3, 11px ×3, 13px ×2, 26px ×1`.
  - Card padding has **7+ competing values** for the same concept (`16px 16px 18px`,
    `18px 16px 16px`, `24px 22px 22px`, `12px 12px 10px`, `20px`, `18px 18px 20px`,
    `12px 18px`…), none using a card-padding token.
- **Root cause:** a bulk CSS-Modules migration (the recurring `Sourced from _sections.css`
  comments) preserved raw values verbatim, and the allowlist was expanded to keep CI green
  rather than the values being snapped to scale.
- **Why Critical:** the headline architectural claim ("token palette only") is false at scale,
  and the gate that should catch it has been turned into a permission slip. Debt re-accumulates
  every migration because nothing pushes back.
- **Note:** `20px` is *on*-scale (`--ds-space-5`); it is a violation only of "write it as a
  token," not of the grid. Correcting an earlier mis-call.

#### C2 — No breakpoint single-source-of-truth
- **Evidence:** 54 dimension media queries hardcode **7 distinct values** (`768 ×28`, `769 ×4`,
  `900 ×16`, plus orphans `1080`, `560`, `359`, `340` ×1 each). No `@custom-media`, no `--bp-*`,
  no breakpoint constant anywhere — confirmed across `app/css/` and `design-system/`.
  Lightning CSS (the build engine) supports `@custom-media`; the mechanism exists and is unused.
- **Fragility:**
  - The 768/769 boundary is a manual pairing kept in sync **by hand across 32 sites**. A single
    off-by-one (`min-width: 768px` instead of `769px`) creates a silent 1px dead-zone/overlap
    that no test catches.
  - Direction is inconsistent: ~85% desktop-first (`max-width`), with mobile-first islands
    (`StatTile`, parts of `PerfReceipts`, `ContactForm`, `Module`), and **3 files mix both
    strategies internally** (`Module`, `PerfReceipts`, `ContactForm`).
  - `NpmStackSection` reconfigures one grid **non-monotonically** (6→3→4→2 columns across
    900/768/340) — breakpoints chosen per-symptom, not from a layout model.
  - 4 orphans are undocumented one-offs each patching a single component's overflow.
- **Why Critical:** "another team could adopt this verbatim" fails — there is no contract to
  adopt, only a convention held together by copy-paste, and the primary boundary is one typo
  away from a layout bug CI won't see.

### IMPORTANT

#### I1 — No z-index scale, and a live collision
- `--ds-z-*` / `--ds-layer-*` does **not exist** (the `lint-no-magic-values` error message
  references `var(--ds-layer-*)`, a token that was never created). All 20 z-indices are raw
  magic numbers governed only by an allowlist.
- **Collision:** `DesktopTopbar.module.css:6` and `StatusBar.module.css:4` both use `110`;
  skip-link uses `9999` (`_base.css:109`); the allowlist itself notes `"115 — above Dock (120
  is wrong…)"`, an admitted inconsistency. No documented stacking contract → every new layer is
  guesswork against a collision-prone stack.

#### I2 — Focus suppressed on bare `:focus` (a11y rule violation)
- `components/client/InteractiveShell/InteractiveShell.module.css:115-117` sets `outline: none`
  on `.input:focus, .input:focus-visible`, leaving only a block caret (`caret-shape: block`) as
  the focus affordance. Violates the project rule ("`outline: none` only on `:focus-visible`")
  and is WCAG 2.4.7 borderline — a block caret is a weak sole indicator. Everywhere else in the
  codebase `:focus-visible` is honored correctly.

#### I3 — The bordered panel is hand-rolled in 27 files
- `border: 1px solid var(--ds-color-signal-subtle)` appears in **27 files / ~45 occurrences**
  (`Module:72`, `TerminalPanel:2`, `Footer ×3`, `HeroStats ×3`, `Sidebar ×3`, `DesktopTopbar ×2`,
  `Projects ×2`, `InteractiveShell ×2`, +17 more). `TerminalPanel` already exists as the intended
  shared primitive but most sections re-roll the border by hand.
- A **competing** border convention `1px solid var(--ds-color-border-default)` is used in 8 files
  (`DawMixer ×4`, `Guitar ×4`) — two panel-border idioms with no rule for which to use.
- Translucent panel fill `rgba(0,0,0,0.55|0.5|0.4…)` is repeated with no surface token (tokens
  define only opaque `--ds-color-surface-shell`).

#### I4 — Window chrome ("traffic lights") re-implemented 3× with divergent sizes
- `MobileTitleBar:22-36` (9px dots), `InteractiveShell:31-48` (10px), `DesktopTopbar:30-43` —
  three copies, each re-declaring the same `--ds-chrome-close/minimize/maximize` background
  rules at different sizes. Should be one primitive with size as a prop/var.

#### I5 — Durations bypass tokens; easing token set is incomplete
- **6 hardcoded durations exactly equal an existing token** (`80ms`=fast, `200ms`=base,
  `300ms`=slow): `Module:143`, `Hero:20/236/241/376`, `ContactForm:31`. Pure bypass.
- The 4 custom `cubic-bezier()` curves the UI actually relies on (`Module:100/114/133/184`,
  `Footer:134`) have **no easing token** — a palette gap. Keyword eases used inline
  (`ease`, `ease-out`) also bypass the existing `--ds-ease-*` tokens.

#### I6 — Alpha-color palette gap (and 3 straight violations)
- ~55 `rgba()` literals. **3 exactly match existing tokens** and are straight violations:
  `rgba(0,255,65,0.1)` (`InteractiveShell:195` = `--ds-color-signal-quiet`),
  `rgba(0,255,65,0.12)` (`Dock:41`, `Footer:326` = `--ds-color-signal-faint`).
- The other ~52 (scrim blacks `rgba(0,0,0,*)`, glow greens, CRT sub-pixel mask) have **no token
  to map to** — a palette gap, not indiscipline. The allowlist already enumerates ~20
  `rgba(0,255,65,X)` opacity variants (0.015→0.6); these want one system, e.g.
  `color-mix(in srgb, var(--ds-color-signal) X%, transparent)` or `--ds-overlay-*` / `--ds-glow-*`
  alpha tokens, with the CRT mask values documented as an explicit effect-layer exception.

### MINOR

- **M1 — 3 unguarded hover/focus transitions** (not motion, low risk): `Button.module.css:12-14`,
  `Field.module.css:21`, `ComponentNav.module.css:17-19` lack a `prefers-reduced-motion` /
  `data-motion` guard. Every transform/position animation *is* guarded.
- **M2 — `9px` font-size recurs 5×** below the smallest token (10px): `LivePerf:105`,
  `NpmStack:58`, `AiMetrics:102`, `HottestTakes:111`, `InteractiveShell:290`. Promote to a
  `--ds-font-size-micro` token or round to 10px.
- **M3 — ~13 three-level descendant chains** in CSS Modules (`.root .cmd .gt`, `.root a svg`,
  `.dmesg .dmMsg b`, …) raise specificity unnecessarily and couple styling to tag structure.
  Low severity (scoped) but brittle.
- **M4 — token nits:** `--ds-radius-none: 0px` should be `0`; `--ds-text-size-2xs` and
  `--ds-text-size-xs` are both `10px` (duplicate token — collapse or differentiate).
- **M5 — rem/px mixed in single declarations:** `InteractiveShell:241` `padding: 0.5rem 16px`;
  `_base.css:194` `2rem`. Pick one unit per layout context.
- **M6 — `#000` literals where a token exists** (~15 sites, e.g. `_base.css:112`,
  `DesktopTopbar:134`, `Hero:246`): `--ds-color-highlight-fg` / `--ds-color-surface-base` both
  resolve to `#000000`. (Note: `#000` in `text-shadow`/CRT pixel math is allowlisted-legitimate.)

---

## What is already excellent (do NOT touch — via negativa)

These are correct, measurement-driven, and should be preserved as the model the rest is brought
up to:

- **Offscreen deferral:** `Module.module.css:49-57` applies `content-visibility: auto` +
  `contain-intrinsic-size: auto 520px` to the 14 below-fold sections (wired from `page.tsx`).
  The win is already captured; no further `content-visibility` opportunity exists.
- **CRT overlay perf:** scan beam animates `transform` not `top` (documents a fixed CLS
  0.075–0.083 regression), `will-change` set during animation and reset to `auto` under reduced
  motion, double reduced-motion guard (media query + `data-motion`), paused under
  `html.sysfail-on`. Exemplary; the 5-layer blend stack is intentional and contained.
- **Motion handling generally:** dual reduced-motion mechanism (CSS + pre-paint JS class) covers
  every animated section.
- **Specificity:** zero ID selectors; exactly one `!important` (`Module:108`), documented and
  justified against a Chrome 131 UA rule.
- **Contrast contract:** the two-token `--signal`/`--fg` discipline holds; `:focus-visible`
  honored everywhere except I2.

---

## Target CSS-system architecture (the design to approve)

The fixes converge on one principle: **make the system the path of least resistance, then let the
gates enforce it.** Eight moves, ordered by leverage.

1. **Breakpoint contract (fixes C2).** Add `@custom-media` definitions in a single source
   (`app/css/_breakpoints.css` imported first): `--bp-mobile (max-width: 768px)`,
   `--bp-mobile-up (min-width: 769px)`, `--bp-tablet (max-width: 900px)`. Migrate the 48 canonical
   sites to reference them. Explicitly justify-in-comment or eliminate the 4 orphans
   (`1080/560/359/340`). Add a **net-new** gate (NOT an extension of `lint-no-magic-values`, which
   deliberately strips `@media` conditions at `lint-no-magic-values.mjs:32`) that rejects raw
   `@media (max-width|min-width: …)` outside the breakpoints file.

   **REQUIRED PRE-TASKS (architect-review findings 1 & 2 — unvalidated stack assumptions):**
   - `@custom-media` is a Lightning CSS draft feature, **OFF by default**. Add
     `experimental: { lightningCssFeatures: ['custom-media-queries'] }` to `next.config.ts`
     (currently has no Lightning CSS config). Turbopack is the active bundler (Next 16 default;
     `dev` uses `--turbopack`), so the path exists.
   - **Gate-zero spike (blocks the whole move):** `@custom-media` is resolved *per CSS-processing
     unit* at compile time, not a runtime cascade like `var()`. A definition in a globally-imported
     `_breakpoints.css` is **not guaranteed visible inside a `.module.css`**. Prove in a real
     `next build` that a `@custom-media` defined in `_breakpoints.css` resolves inside one
     `.module.css` BEFORE migrating any of the 48 sites. If it does not resolve (likely), fall back
     to generating an `@media` snippet from a single breakpoint source (Style Dictionary or a build
     step) so the value still has one source of truth.
   - Derive `--bp-mobile-up` from the same source value as `--bp-mobile` (or assert the
     768/769 invariant in a test) so the off-by-one is not merely re-created in a new file.

2. **Spacing enforcement (fixes C1).** **First task (architect-review finding 5 — blocks the
   allowlist diet):** decide the grid explicitly: keep 4px and snap the
   off-scale dominants (6→4/8, 10→8/12, 14→12/16, 18→16/20), OR formally adopt a 2px sub-grid and
   mint the missing half-step tokens. Then: (a) fix the off-grid semantic-token overrides in
   `_base.css:164/166/208` so `--ds-space-pad`/`-rhythm` resolve to scale at every viewport;
   (b) introduce a canonical card-padding token to collapse the 7+ variants; (c) sweep raw px →
   tokens; (d) shrink the allowlist to genuine geometry-only values (icon sizes, hairlines, fixed
   grid columns) and document each remaining entry as geometry, not "pre-token."

3. **Z-index scale (fixes I1).** Mint `--ds-z-{base,content,chrome,dock,skiplink,overlay}` with a
   documented stacking contract; resolve the `110` collision; replace `9999` with
   `--ds-z-skiplink`. Update the lint message to match the real token name.

4. **Alpha-color system (fixes I6).** **Resolved (architect-review finding 3):** use **literal
   alpha tokens** `--ds-overlay-*` (scrim blacks) / `--ds-glow-*` (glow greens) in
   `design-system/tokens/color.json`, **NOT runtime `color-mix()`**. Rationale: the browserslist
   floor (Chrome 93 / Safari 15.4) is below `color-mix()` support (Chrome 111 / Safari 16.2), and
   Lightning CSS cannot statically lower a `color-mix()` that has a `var()` argument — it would
   ship unsupported syntax. The existing `--ds-green-100/150/300/400` already encode these alphas;
   extend that proven static-token model. Remove the 3 exact-match violations; keep the CRT
   sub-pixel mask values as an explicitly documented effect-layer exception.

5. **Shared panel primitive (fixes I3).** Route sections through `TerminalPanel` (or a token-
   composed `.panel` rule) instead of hand-rolling the border; add `--ds-color-surface-panel` for
   the translucent fill; pick ONE border convention (`signal-subtle` vs `border-default`) and
   document when each applies.

6. **Window-chrome primitive (fixes I4).** One component for the traffic-light dots, size via
   prop/var; the three call sites consume it. **Constraint (architect-review Gate 2):** must remain
   an RSC/presentational primitive — must NOT introduce a `'use client'` island (client-JS budget
   is <43KB total).

7. **Duration/easing tokens (fixes I5).** Replace the 6 token-equal hardcodes with `var()`; add
   `--ds-ease-emphasized-in`/`-out` (the cubic-beziers already in use); migrate inline keyword
   eases to tokens.

8. **Focus fix (fixes I2).** Give the InteractiveShell input a real `:focus-visible` ring
   alongside the block caret; remove the bare-`:focus` outline suppression.

Minors (M1–M6) fold into the relevant sweep above.

### Enforcement mapping (every change names its gate)

| Change | Enforced by |
|---|---|
| Breakpoint contract | new gate: ban raw width `@media` outside `_breakpoints.css` |
| Spacing → tokens + shrunk allowlist | `lint-no-magic-values` (allowlist diet) |
| Token-boundary (hex/rgba) | `lint-token-boundary` + `lint-no-magic-values` |
| Z-index scale | `lint-no-magic-values` z-index check + new token |
| Contrast unchanged | `contrast-check` |
| No regressions in CLS/paint | LHCI gates, bundle-size, axe |
| Token minting (z-index, alpha, easing, micro-font) | **every token task must `pnpm tokens:build` + commit `dist/tokens.css` in the SAME commit** — `tokens:check` runs `git diff --exit-code design-system/dist/` and fails otherwise |
| `@custom-media` resolves in `.module.css` | gate-zero build-output assertion (see Move 1 pre-tasks) |

### Sequencing & risk

- **Lowest risk, do first:** I1 (z-index tokens), I5 (duration tokens), I2 (focus), M4 — pure
  additions/local fixes, no visual change.
- **Medium:** C2 (breakpoints — mechanical migration, behavior-preserving if values are
  identical), I3/I4/I6 (extractions — visual-regression-snapshot-gated).
- **Highest risk, do last and incrementally:** C1 spacing snap — changes visible layout; must be
  per-section, each gated by the Playwright visual baselines (desktop 1280×720 + mobile 375×812)
  and the `thinking-inversion` failure list. The off-grid semantic-token override fix
  (`_base.css`) touches every consumer at once — treat as its own isolated change with full
  visual diff.

Every code change runs the full 5-agent review battery (`pr-review-toolkit:review-pr`,
`accessibility-tester`, `security-auditor`, `performance-engineer`, `dependency-manager`) +
`ci:local` + `gates:runtime` before any push, per project working agreement. Per architect-review
Gate 4, `performance-engineer` (LHCI/CLS surface) and `accessibility-tester` (focus + contrast
surface) are load-bearing for this work, not optional.

---

## Spec-gate record

- `thinking-inversion`: complete — bug-classes per fix enumerated and folded into Move pre-tasks
  and the sequencing section (build/tooling, correctness, visual/perf-regression, process traps).
- `architect-reviewer`: **`GATE_RESULT: PASS`** (HEAD `18636aa`), conditional on absorbing findings
  1–6, all now folded in above: (1) `lightningCssFeatures` config + gate-zero spike, (2) cross-
  module `@custom-media` scope spike, (3) literal alpha tokens over `color-mix()`, (4) net-new
  breakpoint gate, (5) grid decision first, (6) `tokens:build`/commit-dist per token task +
  `performance-engineer`/`accessibility-tester` dispatch + Move 6 no-client-island constraint.
