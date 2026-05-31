# CSS System M4 — Spacing Snap

> **Source spec:** `docs/superpowers/specs/2026-05-30-css-system-review.md` §C1
> **Parent plan:** `docs/superpowers/plans/2026-05-30-css-system-hardening.md` §Milestone 4
> **Prerequisites:** M1 merged. M0.3 grid decision (4px vs 2px) must complete before any snap work.
> **For agentic workers:** Use `superpowers:using-git-worktrees`. Stage with `git add <specific files>` only.

**Goal:** Snap the ~328 raw-px spacing declarations to the 4px token scale. The semantic alias tokens (`--ds-space-pad`, `--ds-space-rhythm`) that currently resolve off-grid at mobile are fixed first. Then per-section raw-px sweeps. Finally, allowlist diet. Zero layout regression — any visual shift must be an intentional snap decision with a Playwright visual confirmation.

**Highest blast radius in the entire plan.** Task 4.1 (semantic token fix) touches EVERY consumer at once. Task 4.2 is per-section but the most mechanically tedious. Always one section per commit. Never blind-accept snapshots.

---

## Execution constraints

- Work in an isolated git worktree (`superpowers:using-git-worktrees`).
- Stage with `git add <specific files>` — never `git add .` or `-A`.
- Before each section commit: `pnpm dev` + Playwright MCP (desktop 1280×720 + mobile 375×812). Never blind-accept snapshot updates — eyeball each diff.
- One section per commit. The blast radius is smallest this way; regressions are bisectable.
- Watch `contain-intrinsic-size: auto 520px` on deferred sections — padding changes can shift CLS.

---

## Task M0.3 — Grid decision (MUST RUN FIRST)

This investigation gates what values are acceptable snaps in M4.

### Subtask M0.3.1 — Tally off-scale dominants

- [ ] **Step 1: Confirm the dominant off-scale values**

  From spec C1: `6px ×52, 10px ×45, 14px ×41, 18px ×24`. These four account for 162 of the off-scale declarations. On a 4px grid: `6→4 or 8`, `10→8 or 12`, `14→12 or 16`, `18→16 or 20`.

  Run:
  ```bash
  grep -rn "\b6px\b\|\b10px\b\|\b14px\b\|\b18px\b" components/ app/css/ --include="*.css" | grep -v "node_modules\|_breakpoints\|tokens" | wc -l
  ```

  Confirm the count is still in range.

### Subtask M0.3.2 — Visual spot-check of load-bearing values

- [ ] **Step 2: Run `pnpm dev` and open the site**

- [ ] **Step 3: Playwright MCP visual spot-check — 5 representative sites**

  1. `GuitarSection` — check `11px`/`13px` label spacing (tight inline, may wrap if snapped)
  2. `Footer` — check `gap: 18px` (if snapped to 16px, does the footer feel tighter?)
  3. `page.module.css` — check `14px` padding site
  4. `DawMixer` — check `5px`/`4px`/`6px` fine-grain knob/fader spacing
  5. Any card component — check `16px 16px 18px` padding (the 18 tail)

  For each: decide whether the snap changes the intended look. Capture notes.

### Subtask M0.3.3 — Record the decision

- [ ] **Step 4: Add grid ADR to `DECISIONS.md`**

  Recommended default:
  - Adopt 4px grid.
  - Snap off-scale values to nearest 4px multiple.
  - Mint NO half-step tokens (half-steps re-legitimize drift).
  - Treat 6/10/14/18 as snap candidates with per-site visual confirmation in M4.
  - Exception: genuine icon/hairline geometry (border-width, dot sizes, hairlines) stays raw and explicitly allowlisted with reason `"geometry"`.
  - Exception: WCAG touch-targets (44/48/52px) stay raw — they are semantic, not spatial.

  Commit: `docs(css): adopt 4px grid — snap off-scale spacing, no half-step tokens`

---

## Task 4.1 — Fix semantic token off-grid values (HIGHEST BLAST RADIUS)

Root cause from spec: `--ds-space-rhythm` and `--ds-space-pad` resolve to off-grid values at mobile/tablet (`18px`, `14px`, `18px` across the three `@media` breakpoints in `_base.css`). Every consumer of these aliases emits off-scale output even when using the token.

**Files:** `app/css/_base.css` — specifically lines 164, 166, 208.

### Subtask 4.1.1 — Understand blast radius before touching

- [ ] **Step 1: Count all consumers of the affected semantic aliases**

  ```bash
  grep -rn "ds-space-rhythm\|ds-space-pad\|ds-space-rhythm-tight\|ds-space-pad-tight" components/ app/ --include="*.css" | grep -v node_modules | wc -l
  ```

  This is how many sites will visually change if the mobile values shift.

- [ ] **Step 2: Playwright MCP — baseline capture before the change**

  Run `pnpm dev`. Take screenshots (desktop + mobile) of every section visible on the page. Save them mentally or note the timestamp. This is your before-state.

### Subtask 4.1.2 — Snap the off-grid values

- [ ] **Step 3: Edit `app/css/_base.css`**

  Find lines 164, 166, 208 (from spec):
  ```css
  /* Approximate current state: */
  --ds-space-rhythm: 18px;   /* ≤768 — off-grid: 18 → snap to 16 or 20 */
  --ds-space-pad: 14px;      /* ≤768 — off-grid: 14 → snap to 12 or 16 */
  --ds-space-pad: 18px;      /* 769–900 — off-grid: 18 → snap to 16 or 20 */
  ```

  Per the M0.3 decision:
  - `18px` → `16px` (snap down, maintains tight mobile feel) OR `20px` (snap up, looser)
  - `14px` → `12px` (snap down) OR `16px` (snap up, matches desktop)

  Recommendation: snap down (`18→16`, `14→12`) to preserve the tighter mobile feel. But verify visually — if `12px` causes unacceptable crowding, use `16px`.

- [ ] **Step 4: Playwright MCP — visual diff after the change**

  With `pnpm dev` running, check every section. This is the single change most likely to affect the whole layout. Confirm the snap looks intentional, not broken. Any section that looks wrong: investigate whether `14px` or `18px` was load-bearing before reverting.

- [ ] **Step 5: Commit with full blast-radius documentation**

  ```bash
  git add app/css/_base.css
  git commit -m "fix(css): snap --ds-space-rhythm/pad mobile overrides to 4px grid

  Before: --ds-space-rhythm 18px (≤768), --ds-space-pad 14px (≤768)/18px (769-900) — all off-grid.
  After:  --ds-space-rhythm 16px, --ds-space-pad 12px/16px — on-grid.
  Affects: all consumers of --ds-space-rhythm and --ds-space-pad at mobile/tablet viewports.
  Visual: confirmed via Playwright MCP — intentional snap, no crowding observed."
  ```

---

## Task 4.2 — Per-section raw-px → token sweep

**Off-scale raw px by frequency (from spec C1):**
`6px ×52, 10px ×45, 14px ×41, 18px ×24, 5px ×10, 3px ×9, 22px ×5, 7px ×4, 9px ×3, 11px ×3, 13px ×2, 26px ×1`

**Snap map (4px grid):**
| Raw | On-scale token | Note |
|-----|---------------|------|
| `3px` | `var(--ds-space-1)` (4px) | or allowlist as hairline geometry |
| `5px` | `var(--ds-space-1)` (4px) or `var(--ds-space-2)` (8px) | check context |
| `6px` | `var(--ds-space-2)` (8px) | snap up |
| `7px` | `var(--ds-space-2)` (8px) | snap up |
| `9px` | `var(--ds-space-2)` (8px) or `var(--ds-space-3)` (12px) | check context |
| `10px` | `var(--ds-space-3)` (12px) | snap up |
| `11px` | `var(--ds-space-3)` (12px) | snap up |
| `13px` | `var(--ds-space-3)` (12px) or `var(--ds-space-4)` (16px) | check |
| `14px` | `var(--ds-space-4)` (16px) | snap up |
| `18px` | `var(--ds-space-4)` (16px) or `var(--ds-space-5)` (20px) | check |
| `20px` | `var(--ds-space-5)` (20px) | already on-scale, write as token |
| `22px` | `var(--ds-space-6)` (24px) | snap up |
| `26px` | `var(--ds-space-6)` (24px) or `var(--ds-space-7)` (28px) | check |

**Exceptions (do NOT snap):**
- WCAG touch-targets: `44px`, `48px`, `52px` — semantic, allowlist with reason `"wcag-touch-target"`
- Icon/dot geometry: border sizes, hairlines, CRT mask values — allowlist with reason `"geometry"`
- `contain-intrinsic-size` values — layout hint, not spacing, allowlist with reason `"layout-hint"`
- `DawMixer` fine-grain knob/fader values (`4px/5px/6px`) — intentional audio-UI precision, allowlist with reason `"instrument-geometry"`

### Section order (lowest to highest blast radius)

Process sections in this order — more isolated sections first:

- [ ] **Step 1: CredentialsSection** — `git commit -m "refactor(css): snap CredentialsSection spacing to 4px grid"`
- [ ] **Step 2: VisaSection** — same pattern
- [ ] **Step 3: CommunitySection**
- [ ] **Step 4: NowSection**
- [ ] **Step 5: UnknownsSection**
- [ ] **Step 6: SysHealthSection**
- [ ] **Step 7: HottestTakesSection**
- [ ] **Step 8: PerfReceiptsSection**
- [ ] **Step 9: ProjectsSection**
- [ ] **Step 10: NpmStackSection** — has the non-monotonic grid ladder; document in comment if intentional
- [ ] **Step 11: GuitarSection** — `11px/13px` labels, check if snapping wraps content
- [ ] **Step 12: DawMixerSection** — fine-grain spacing, most exceptions expected
- [ ] **Step 13: InteractiveShell** — client island, verify no INP impact from layout shift
- [ ] **Step 14: Hero** — highest visibility; verify LCP not affected (padding changes can shift LCP element position)
- [ ] **Step 15: Footer** — `gap: 18px`, verify footer layout at mobile

**Per-section process:**
1. Run `pnpm dev` + Playwright MCP — capture before state.
2. Replace off-scale raw px with token refs per the snap map.
3. For each snap: ask "is this load-bearing?" If the value was deliberately chosen to fit content, note it.
4. Run `pnpm dev` + Playwright MCP — eyeball the diff. If it looks wrong, revert that value and allowlist it with reason `"load-bearing-geometry"` + a comment explaining why.
5. Run `node scripts/lint-no-magic-values.mjs` — must pass.
6. Commit the section.

---

## Task 4.3 — Allowlist diet

After all sections are swept, prune entries that are now covered by tokens.

**Files:** `scripts/lint-no-magic-values.allowlist.json`

- [ ] **Step 1: Run the gate before pruning**

  ```bash
  node scripts/lint-no-magic-values.mjs 2>&1 | grep "allowlisted" | wc -l
  ```

  Note the count.

- [ ] **Step 2: Remove tokenized entries**

  For every px value that is now expressed as a `var(--ds-space-*)` across the codebase, remove its allowlist entry. The gate must still pass after removal (proving the property, not just keeping CI green).

- [ ] **Step 3: Rewrite remaining reasons**

  Every surviving entry must have a reason that says WHY it cannot be a token:
  - `"geometry"` — icon sizing, hairlines, fixed grid columns
  - `"wcag-touch-target"` — WCAG 2.5.5 minimum
  - `"layout-hint"` — `contain-intrinsic-size`, `aspect-ratio` numerics
  - `"instrument-geometry"` — audio-UI precision values
  - `"crt-effect"` — CRT overlay sub-pixel mask

  Remove: `"pre-token"`, `"equivalent token exists but files migrated to module CSS retain numeric form"`, and other defeat-language reasons.

- [ ] **Step 4: Confirm gate still passes**

  ```bash
  node scripts/lint-no-magic-values.mjs 2>&1 | tail -5
  ```

  Must exit 0.

- [ ] **Step 5: Run full CI**

  ```bash
  pnpm ci:local 2>&1 | tail -10
  ```

  Commit: `chore(ci): slim allowlist after M4 sweep — only genuine geometry remains`

---

## Verification

- [ ] `pnpm ci:local` passes
- [ ] `node scripts/lint-no-magic-values.mjs` — clean
- [ ] `pnpm check` (Biome) — clean
- [ ] `pnpm typecheck` — clean
- [ ] Playwright MCP: all snapped sections visually intentional (no crowding, no wrapping text, no layout shift)
- [ ] CLS check: `pnpm gates:runtime` — CLS < 0.05 on desktop and mobile after spacing changes to deferred sections
- [ ] LCP check: Hero padding changes must not shift the LCP element — verify LCP < 1.8s desktop / < 3.5s mobile

## PR scope

M4 is the highest-risk milestone. Split into at minimum two PRs:
1. Task 4.1 (semantic token fix) — smallest file count, highest blast radius — standalone PR.
2. Tasks 4.2 + 4.3 (per-section sweep + allowlist diet) — one PR per 4-5 sections if `pnpm pr-size` hits yellow.

Run `pnpm pr-size` after every 3 section commits during Task 4.2.
