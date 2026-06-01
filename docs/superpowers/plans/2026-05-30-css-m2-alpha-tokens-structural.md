> **Status: Superseded by PR #80** — Tailwind v4 migration replaces the CSS module + Style Dictionary system described here. See `docs/superpowers/specs/2026-05-31-tailwind-v4-migration-design.md` and `DECISIONS.md` (2026-05-31 entry).

# CSS System M2 — Alpha Tokens + Structural Extractions

> **Source spec:** `docs/superpowers/specs/2026-05-30-css-system-review.md`
> **Parent plan:** `docs/superpowers/plans/2026-05-30-css-system-hardening.md` §Milestone 2
> **Prerequisite:** M1 merged (feat/css-system-m1 → PR #77)
> **For agentic workers:** Use `superpowers:using-git-worktrees` — work in an isolated worktree. Stage with `git add <specific files>` — never `git add .` or `-A`.

**Goal:** Mint literal alpha tokens (`--ds-overlay-*`, `--ds-glow-*`) to replace raw `rgba()` literals in CSS modules; extract the repeated bordered-panel pattern into a shared `TerminalPanel` design-system primitive; extract the three traffic-light window-chrome call sites into a shared `WindowChrome` RSC primitive. Zero visual regression.

**Risk level:** Medium — snapshot-gated. Sub-pixel anti-aliasing may shift on extraction; eyeball every changed snapshot before blind-accepting.

---

## Execution constraints

- Work in an isolated git worktree (`superpowers:using-git-worktrees`).
- Stage with `git add <specific files>` — never `git add .`, `git add -A`.
- Every token-minting commit runs `pnpm tokens:build` and stages `design-system/dist/tokens.css` in the SAME commit (`tokens:check` does `git diff --exit-code dist/`).
- Before editing any test: run `pnpm dev` + Playwright MCP visual check (desktop 1280×720 + mobile 375×812) on the affected sections. Tests assert observed behavior.
- Split PRs by milestone; run `pnpm pr-size` after each commit block.

---

## Task 2.1 — Mint literal alpha tokens

**Files:**
- Modify: `design-system/tokens/color.json`
- Generated: `design-system/dist/tokens.css`

### Subtask 2.1.1 — Enumerate alpha families

- [ ] **Step 1: Collect all rgba() declarations across CSS modules**

  Run:
  ```bash
  grep -rn "rgba(" components/ app/css/ design-system/components/ --include="*.css" | grep -v "node_modules"
  ```

  Classify results into two families:
  - **Scrim blacks** (overlays, backdrops): `rgba(0,0,0,X)`
  - **Glow greens** (signal glow effects): `rgba(0,255,65,X)` or similar

  List each distinct alpha value per family in a scratch note. Do NOT proceed until every site is enumerated.

- [ ] **Step 2: Identify the 3 exact-match violations that overlap existing tokens**

  From the spec: `InteractiveShell:195`, `Dock:41`, `Footer:326` use values already covered by `--ds-color-signal-quiet` or `--ds-color-signal-faint`. These migrate to existing tokens — no new token needed for them.

### Subtask 2.1.2 — Write failing tests

- [ ] **Step 3: Write token assertion tests before minting**

  In `design-system/tokens/__tests__/alpha.test.ts`:
  ```ts
  import tokens from '../../dist/tokens.json';

  test('--ds-overlay-* tokens resolve to rgba(0,0,0,X)', () => {
    // assert each overlay token value matches the expected rgba literal
    // e.g. expect(tokens['--ds-overlay-40']).toBe('rgba(0,0,0,0.4)');
  });

  test('--ds-glow-* tokens resolve to expected rgba(0,255,65,X)', () => {
    // assert each glow token
  });
  ```

  Run: `pnpm test --run alpha.test 2>&1 | tail -5`
  Expected: FAIL (tokens not yet minted).

### Subtask 2.1.3 — Mint tokens

- [ ] **Step 4: Add overlay and glow tokens to color.json**

  Use static `rgba()` literals — NOT `color-mix()` (browserslist floor is below `color-mix` support).

  Add to `design-system/tokens/color.json` under a new `overlay` and `glow` group:
  ```json
  "overlay": {
    "05": { "value": "rgba(0,0,0,0.05)" },
    "10": { "value": "rgba(0,0,0,0.10)" },
    ...
  },
  "glow": {
    "01": { "value": "rgba(0,255,65,0.015)" },
    ...
  }
  ```

  Name tokens based on the alpha percentage (e.g. `--ds-overlay-40` for 0.4). Only mint values that actually appear in the codebase (from Step 1) — no speculative tokens.

- [ ] **Step 5: Build and test**

  Run: `pnpm tokens:build && pnpm test --run alpha.test 2>&1 | tail -5`
  Expected: PASS.

### Subtask 2.1.4 — Migrate sites

- [ ] **Step 6: Migrate exact-match violations to existing tokens first**

  `InteractiveShell:195`, `Dock:41`, `Footer:326` → `var(--ds-color-signal-quiet)` or `--ds-color-signal-faint` as applicable.

- [ ] **Step 7: Migrate remaining scrim/glow literals to new tokens**

  For each `rgba()` site (except CRT sub-pixel mask — see Step 8): replace with `var(--ds-overlay-XX)` or `var(--ds-glow-XX)`.

  Verify byte-identical: the rgba literal in the token must EXACTLY match the original (no rounding, no interpolation drift).

- [ ] **Step 8: Keep CRT mask values raw and documented**

  `CRTOverlay.module.css` lines 41-46 are an effect-layer exception. Do NOT migrate these. Add or update their allowlist entry in `scripts/lint-no-magic-values.allowlist.json`:
  ```json
  { "value": "rgba(0,0,0,0.22)", "reason": "CRT sub-pixel mask — effect layer exception, not a UI overlay" }
  ```

### Subtask 2.1.5 — Tighten gate + commit

- [ ] **Step 9: Tighten lint-token-boundary/allowlist**

  Update `scripts/lint-no-magic-values.allowlist.json` to cover module-CSS color function exceptions. Remove any `rgba()` entries that are now tokenized.

- [ ] **Step 10: Visual diff**

  Run `pnpm dev` and Playwright MCP: spot-check every section that had a migrated `rgba()`. Overlays and glows should be visually identical.

- [ ] **Step 11: Commit per logical group**

  ```bash
  # Group 1: token minting + tests
  git add design-system/tokens/color.json design-system/dist/tokens.css design-system/tokens/__tests__/alpha.test.ts
  git commit -m "feat(tokens): add --ds-overlay-* and --ds-glow-* literal alpha tokens"

  # Group 2: site migrations
  git add components/client/InteractiveShell/InteractiveShell.module.css components/responsive/Dock/Dock.module.css app/css/_base.css scripts/lint-no-magic-values.allowlist.json
  git commit -m "refactor(css): migrate rgba literals to --ds-overlay-* / --ds-glow-* tokens"
  ```

**Failure modes:**
- Token rgba value must be byte-identical to original — even `rgba(0,0,0,.4)` vs `rgba(0,0,0,0.4)` may differ in some preprocessors; use full precision
- Do NOT migrate CRT mask values
- contrast-check must still pass after migration
- No `color-mix()` — static `rgba()` literals only

---

## Task 2.2 — TerminalPanel shared primitive (I3)

**Files:**
- New: `design-system/components/TerminalPanel/TerminalPanel.tsx`
- New: `design-system/components/TerminalPanel/TerminalPanel.module.css`
- New: `design-system/components/TerminalPanel/TerminalPanel.test.tsx`
- Modify: `design-system/tokens/color.json` (add `--ds-color-surface-panel`)
- Modify: the consuming section modules that use the bordered-panel pattern

### Subtask 2.2.1 — Audit the 27 sites

- [ ] **Step 1: Enumerate all bordered-panel sites**

  Run:
  ```bash
  grep -rn "1px solid var(--ds-color-signal" components/ app/ --include="*.css" | grep -v node_modules
  grep -rn "border.*signal" components/ app/ --include="*.css" | grep -v node_modules
  ```

  Classify each hit into:
  - **A** — `1px solid var(--ds-color-signal-subtle)` → TerminalPanel convention
  - **B** — `1px solid var(--ds-color-border-default)` → different color, intentionally different, leave alone
  - **C** — other, evaluate case by case

  Only Group A is a TerminalPanel extraction candidate.

- [ ] **Step 2: Run DS component pre-mortem**

  Per CLAUDE.md pre-implementation checklist:
  1. Which attrs does the consumer control? (`id`, `className`, `aria-*`) — passthrough via `...rest`, never override.
  2. Any `outline: none` on `:focus`? Must be `:focus-visible` scoped.
  3. `querySelector` returns `null` — use `.not.toBeNull()` in tests.
  4. Can this render twice? No hardcoded `id`.

### Subtask 2.2.2 — Mint surface-panel token

- [ ] **Step 3: Add `--ds-color-surface-panel` to color.json**

  This is the translucent fill for panels (currently raw `rgba()` or absent). Value: the dominant translucent background used in panel-like sections (check `InteractiveShell`, `DawMixer`, `Footer` for the common value).

  Build: `pnpm tokens:build`.

### Subtask 2.2.3 — Write tests first (TDD)

- [ ] **Step 4: Write failing behavioral tests**

  `TerminalPanel.test.tsx`:
  ```ts
  test('renders children inside a bordered container', () => { ... });
  test('forwards className to the root element', () => { ... });
  test('forwards ref to the root element', () => { ... });
  test('renders twice without id collision', () => { ... });
  test('does not render a visible outline on focus (only focus-visible ring)', () => { ... });
  ```

  Run: `pnpm test --run TerminalPanel 2>&1 | tail -5` — Expected: FAIL.

### Subtask 2.2.4 — Implement the primitive

- [ ] **Step 5: Build the RSC component**

  `TerminalPanel.tsx` — pure RSC, NO `'use client'`. Props: `children`, `className`, `style`, `...rest` (full attr passthrough). No hardcoded `id`. CSS module only.

- [ ] **Step 6: CSS module**

  `.root`: `border: 1px solid var(--ds-color-signal-subtle); background: var(--ds-color-surface-panel);` — no other layout, consumers own their padding/margin.

  Focus: `outline: none` on `.root` is only acceptable if there is a visible companion `:focus-visible` ring. No bare `outline: none`.

- [ ] **Step 7: Tests pass**

  Run: `pnpm test --run TerminalPanel 2>&1 | tail -5` — Expected: PASS.

### Subtask 2.2.5 — Migrate Group A sites, one per commit

- [ ] **Step 8: Per-site extraction**

  For each Group A site:
  1. Verify the existing markup/descendant-chain selectors survive the primitive (descendant selectors like `.root .header` must still resolve after wrapping in TerminalPanel).
  2. Run `pnpm dev` + Playwright MCP: visual diff the section.
  3. If visually equivalent, update the section's markup to use `<TerminalPanel>`.
  4. Commit: `refactor(css): extract <SectionName> panel border to TerminalPanel primitive`.

  **Do NOT batch multiple sections into one commit** — each section is a separate commit so regressions are bisectable.

- [ ] **Step 9: Commit the primitive + token**

  ```bash
  git add design-system/components/TerminalPanel/ design-system/tokens/color.json design-system/dist/tokens.css
  git commit -m "feat(design-system): add TerminalPanel primitive + --ds-color-surface-panel token"
  ```

**Failure modes:**
- DOM change breaks `.root X Y` descendant selectors — verify each site before committing
- Group B (`border-default`) sites must stay untouched — they are a different color intentionally
- Do not force-unify the two border conventions
- TerminalPanel must be RSC-only — any client import triggers the bundle gate

---

## Task 2.3 — WindowChrome shared primitive (I4)

**Files:**
- New: `design-system/components/WindowChrome/WindowChrome.tsx`
- New: `design-system/components/WindowChrome/WindowChrome.module.css`
- New: `design-system/components/WindowChrome/WindowChrome.test.tsx`
- Modify: `components/responsive/MobileTitleBar/MobileTitleBar.tsx`
- Modify: `components/client/InteractiveShell/InteractiveShell.client.tsx`
- Modify: `components/responsive/DesktopTopbar/DesktopTopbar.tsx`

### Subtask 2.3.1 — Audit divergent sizes

- [ ] **Step 1: Check current dot sizes at the three call sites**

  ```bash
  grep -n "ds-chrome\|chrome-dot\|traffic" components/responsive/MobileTitleBar/ components/client/InteractiveShell/ components/responsive/DesktopTopbar/ -r --include="*.css"
  ```

  Record each dot size (9px vs 10px). Determine whether the size difference is intentional (different context = different size) or accidental drift. If intentional, expose a `size` prop. If drift, pick canonical.

- [ ] **Step 2: Consolidate `--ds-chrome-*` declarations**

  Three files each declare their own `--ds-chrome-dot-size` etc. After understanding intent from Step 1, decide: move to shared token in `design-system/tokens/`, or keep as local CSS vars with the prop-based override.

### Subtask 2.3.2 — Write tests first (TDD)

- [ ] **Step 3: Write failing behavioral tests**

  ```ts
  test('renders three dots', () => { ... });
  test('accepts size prop and applies it to dot dimensions', () => { ... });
  test('is a server component — no useEffect, no useState', () => { ... });
  test('renders twice without id collision', () => { ... });
  ```

  Run: `pnpm test --run WindowChrome 2>&1 | tail -5` — Expected: FAIL.

### Subtask 2.3.3 — Implement the primitive

- [ ] **Step 4: Build RSC component**

  Pure RSC, NO `'use client'`. Size prop defaults to canonical value. Dots are `aria-hidden="true"` (decorative). No hardcoded `id`.

- [ ] **Step 5: Tests pass**

  Run: `pnpm test --run WindowChrome 2>&1 | tail -5` — Expected: PASS.

### Subtask 2.3.4 — Migrate call sites

- [ ] **Step 6: Replace each call site with `<WindowChrome size={...} />`**

  Per site: Playwright MCP visual check before + after. If visually equivalent, commit.

  ```bash
  git add design-system/components/WindowChrome/ components/responsive/MobileTitleBar/ components/client/InteractiveShell/ components/responsive/DesktopTopbar/
  git commit -m "feat(design-system): add WindowChrome primitive; migrate 3 traffic-light sites"
  ```

**Failure modes:**
- Must not become a client island — any `'use client'` triggers the JS bundle gate
- Size differences may be intentional — expose as prop, don't force-unify
- Dots are decorative — `aria-hidden="true"`, no focus management needed

---

## Verification

- [ ] `pnpm ci:local` passes (all 711+ tests)
- [ ] `pnpm tokens:check` — dist is committed, no dirty diff
- [ ] `node scripts/lint-no-magic-values.mjs` — allowlist only contains genuinely unreplaceable geometry
- [ ] `node scripts/lint-token-boundary.mjs` — clean
- [ ] `pnpm check` (Biome) — clean
- [ ] `pnpm typecheck` — clean
- [ ] Playwright MCP: all migrated sections visually identical on desktop + mobile
- [ ] axe-core: no new violations

## PR scope

One PR for all of M2: token minting + TerminalPanel + WindowChrome. Run `pnpm pr-size` — if it hits yellow before all three tasks are done, split at the last clean task boundary.
