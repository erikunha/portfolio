> **Status: Superseded by PR #80** — Tailwind v4 migration (`feat/tailwind-v4`) deletes all CSS modules and replaces the breakpoint lint gate with standard `md:`/`lg:` prefixes. See `docs/superpowers/specs/2026-05-31-tailwind-v4-migration-design.md`.

# CSS System M3 — Breakpoint Contract

> **Source spec:** `docs/superpowers/specs/2026-05-30-css-system-review.md` §C2
> **Parent plan:** `docs/superpowers/plans/2026-05-30-css-system-hardening.md` §Milestone 3
> **Prerequisite:** M1 merged. M0.2 spike (custom-media cross-module resolution) must complete FIRST — the implementation path forks on its result.
> **For agentic workers:** Use `superpowers:using-git-worktrees`. Stage with `git add <specific files>` only.

**Goal:** Eliminate the 54 hardcoded media-query width literals across 7 distinct values. Replace with a single source of truth (`--bp-mobile`, `--bp-mobile-up`, `--bp-tablet`, etc.). Add a CI gate that rejects new raw width `@media` outside the definition file. Zero visual regression — byte-identical values mean baselines must not move.

**Highest fragility:** the 768/769 manual boundary pair (kept in sync by hand across 32 sites). A single off-by-one creates a silent 1px dead-zone. The new system derives both from one value.

---

## Execution constraints

- Work in an isolated git worktree (`superpowers:using-git-worktrees`).
- Stage with `git add <specific files>` — never `git add .` or `-A`.
- Every media query migration must produce byte-identical output — a moved visual baseline is a migration bug, not a design intent.
- Run Playwright MCP visual check (desktop 1280×720 + mobile 375×812) after each section migration. Baselines should not move.

---

## Task M0.2 — Custom-media resolution spike (MUST RUN FIRST)

This spike gates the entire M3 path. Run it before any migration work.

- [ ] **Step 1: Enable Lightning CSS custom-media feature in next.config.ts**

  Check current config:
  ```bash
  grep -n "lightningCss\|lightningcss\|customMedia" next.config.ts
  ```

  If absent, add to the Next.js config object:
  ```ts
  experimental: {
    lightningCssFeatures: ['custom-media-queries'],
  },
  ```

  Commit: `build(css): enable Lightning CSS custom-media-queries feature`

- [ ] **Step 2: Create a probe custom-media definition**

  Create `app/css/_breakpoints.probe.css`:
  ```css
  @custom-media --probe-bp (max-width: 768px);
  ```

  Add `@import "./css/_breakpoints.probe.css";` to `app/globals.css` (after tokens import).

- [ ] **Step 3: Use the probe inside an existing CSS Module**

  In `components/responsive/Module/Module.module.css`, add at end:
  ```css
  @media (--probe-bp) {
    .root { outline: 3px solid magenta; }
  }
  ```

- [ ] **Step 4: Build and inspect emitted CSS**

  Run:
  ```bash
  pnpm build 2>&1 | tail -5
  grep -rl "magenta" .next/static/chunks/*.css 2>/dev/null | head -3
  ```

  If magenta chunk found, inspect it:
  ```bash
  grep "magenta\|probe-bp\|768" <chunk-file> | head -5
  ```

  **RESOLVED** = rule emitted as `@media (max-width: 768px) { ... outline: 3px solid magenta }` → proceed to Task 3.1a
  **NOT RESOLVED** = rule dropped or still `@media (--probe-bp)` → proceed to Task 3.1b

- [ ] **Step 5: Revert the probe, keep the verdict**

  ```bash
  git checkout app/globals.css components/responsive/Module/Module.module.css
  rm app/css/_breakpoints.probe.css
  ```

  Record verdict in `DECISIONS.md`:
  ```
  - 2026-05-30 CSS M3 custom-media spike: [RESOLVED|NOT RESOLVED]. [M3 uses @custom-media / M3 falls back to codegen]. Reversible: yes, it's a build config change.
  ```

  Commit: `docs(css): record @custom-media cross-module resolution spike result`

---

## Task 3.1a — `@custom-media` contract (if spike RESOLVED)

### Subtask 3.1a.1 — Create breakpoint definition file

- [ ] **Step 1: Enumerate all 7 breakpoint values in the codebase**

  Run:
  ```bash
  grep -rn "@media" components/ app/ --include="*.css" | grep -v "prefers-\|print\|hover\|color\|aspect" | grep -oP '\d{3,4}px' | sort | uniq -c | sort -rn
  ```

  Expected dominants: `768px ×28`, `769px ×4`, `900px ×16`, plus orphans `1080`, `560`, `359`, `340`.

- [ ] **Step 2: Create `app/css/_breakpoints.css`**

  ```css
  /* Single source of truth for all responsive breakpoints.
     WHY: 54 raw @media literals existed across 7 values; the 768/769 pair
     was kept in sync by hand. This file is the only place breakpoints are
     defined — lint-breakpoints.mjs rejects raw width @media elsewhere. */

  @custom-media --bp-mobile (max-width: 768px);
  @custom-media --bp-mobile-up (min-width: 769px);
  @custom-media --bp-tablet (max-width: 900px);
  @custom-media --bp-tablet-up (min-width: 901px);

  /* Orphan breakpoints — document the specific component each patches:
     1080px: [component name] — [reason]
     560px:  [component name] — [reason]
     359px:  [component name] — [reason]
     340px:  [component name] — [reason]
  */
  @custom-media --bp-wide (min-width: 1080px);
  @custom-media --bp-narrow (max-width: 560px);
  @custom-media --bp-xs (max-width: 359px);
  @custom-media --bp-xxs (max-width: 340px);
  ```

  **768/769 invariant:** Both are derived by reading this file — the off-by-one is NOT possible when both sides are defined here.

- [ ] **Step 3: Import first in globals.css**

  Add `@import "./css/_breakpoints.css";` as the FIRST import in `app/globals.css` (before tokens, before base).

- [ ] **Step 4: Verify dev boot**

  Run: `pnpm dev` and open the site. No visual change expected at this point (breakpoints not yet used in modules).

### Subtask 3.1a.2 — Migrate the 48 canonical sites

- [ ] **Step 5: Get the full migration list**

  Run:
  ```bash
  grep -rn "@media.*768px\|@media.*769px\|@media.*900px" components/ app/ --include="*.css" | grep -v "_breakpoints.css" | grep -v node_modules
  ```

  For each hit: replace the raw value with the corresponding `--bp-*` token. Values are byte-identical — the output media query resolves to exactly the same pixel value. Baselines must NOT move.

  Migration map:
  - `(max-width: 768px)` → `(--bp-mobile)`
  - `(min-width: 769px)` → `(--bp-mobile-up)`
  - `(max-width: 900px)` → `(--bp-tablet)`
  - `(min-width: 901px)` → `(--bp-tablet-up)`

- [ ] **Step 6: Migrate section by section, visual check each**

  Group modules by section. Per group:
  1. Replace raw `@media` values.
  2. `pnpm dev` + Playwright MCP: confirm no visual change.
  3. Commit: `refactor(css): migrate <section> breakpoints to --bp-* tokens`

- [ ] **Step 7: Handle the orphan breakpoints**

  For each orphan (1080/560/359/340):
  - Identify the component it belongs to.
  - Migrate to the appropriate `--bp-wide/narrow/xs/xxs` token.
  - Document in `_breakpoints.css` comment what it patches.

- [ ] **Step 8: Justify or fix NpmStack non-monotonic ladder**

  `NpmStackSection` reconfigures grid `6→3→4→2` columns across `900/768/340`. This is non-monotonic — check if it was intentional (per the layout model) or accidental. If intentional, document in a comment. If accidental, fix.

### Subtask 3.1a.3 — Net-new lint gate

- [ ] **Step 9: Write `scripts/lint-breakpoints.mjs`**

  The gate rejects raw `@media (max-width: NNNpx)` or `@media (min-width: NNNpx)` width queries outside `_breakpoints.css`. Must NOT flag:
  - `@media (prefers-reduced-motion: ...)` — feature query
  - `@media (hover: ...)` — feature query
  - `@media print` — print query
  - `@media (prefers-color-scheme: ...)` — feature query

  ```js
  // scripts/lint-breakpoints.mjs
  // Rejects raw width @media outside _breakpoints.css
  // WHY: The 768/769 pair was manually synced across 32 sites — one off-by-one
  // creates a silent dead-zone. This gate prevents the pattern from re-accumulating.
  ```

  Test the gate against itself: run it on a file with a raw `@media (max-width: 768px)` outside `_breakpoints.css` — must exit 1.
  Run it against `_breakpoints.css` itself — must exit 0.
  Run it against a `prefers-reduced-motion` file — must exit 0 (no false positive).

- [ ] **Step 10: Add to `ci:local`**

  In `package.json`, add `node scripts/lint-breakpoints.mjs` to the `ci:local` chain.

  Run: `pnpm ci:local 2>&1 | tail -10` — must pass.

  Commit: `feat(ci): add lint-breakpoints gate — reject raw width @media outside _breakpoints.css`

---

## Task 3.1b — Codegen fallback (if spike NOT RESOLVED)

If custom-media does NOT resolve inside CSS Modules, use a Style Dictionary custom format to emit the `@media` literal into each consuming module at build time.

- [ ] **Step 1: Extend Style Dictionary config with a custom format**

  In `design-system/build.mjs` (or equivalent), add a format that reads the breakpoint tokens and emits:
  ```css
  /* Generated by Style Dictionary — do not edit */
  @media (max-width: 768px) { ... }
  ```

  The single source remains the token file; modules import the generated snippet.

- [ ] **Step 2: Define breakpoints in `design-system/tokens/breakpoints.json`**

  ```json
  {
    "bp": {
      "mobile":     { "value": "768px" },
      "mobile-up":  { "value": "769px" },
      "tablet":     { "value": "900px" },
      "tablet-up":  { "value": "901px" }
    }
  }
  ```

- [ ] **Step 3: Run `pnpm tokens:build`**

  Verify the generated file emits correct `@media` literals.

- [ ] **Step 4: Migrate the 48 sites to import and use the generated snippet**

  Same section-by-section approach as Task 3.1a.2. Visual check each.

- [ ] **Step 5: Add the same `lint-breakpoints.mjs` gate**

  Same as Task 3.1a.3 — the gate rejects raw width queries regardless of the substitution mechanism.

**Document in DECISIONS.md:** the chosen mechanism, SHA, and reversibility note.

---

## Verification

- [ ] `pnpm ci:local` passes including new `lint-breakpoints` gate
- [ ] `node scripts/lint-breakpoints.mjs` — clean (zero raw width queries outside definition file)
- [ ] Playwright MCP visual diff: ALL 54 migrated sites — desktop + mobile — baselines byte-identical. Any diff is a migration bug.
- [ ] `pnpm dev` boot: no console errors from unresolved custom-media
- [ ] `pnpm typecheck` — clean

## PR scope

One PR for M3: spike result doc + breakpoints file + 48-site migration + lint gate. Run `pnpm pr-size` after the spike commit. If the migration alone hits yellow, split the spike+definition into one PR and the site migrations into a second.
