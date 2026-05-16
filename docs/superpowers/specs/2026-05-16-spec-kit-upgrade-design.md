# Spec-Kit Upgrade — Design Spec

**Date:** 2026-05-16
**Status:** Approved

---

## Goal

Improve the spec-driven agentic flow for this portfolio project by adding portfolio-aware agents, hardening local gates, and wiring skill dispatch triggers so the brainstorm → spec → plan → implement loop is enforced rather than aspirational.

---

## Architecture

Three layers, each independently useful, together forming a closed loop:

```
brainstorm → spec → [spec-gate] → plan → implement → [local-gate] → CI
                         ↑                    ↑
                    agents consulted     pre-commit catches
                    for constraints      80% of CI failures
```

- **Project agents** give specialized intelligence keyed to portfolio constraints without re-deriving context every session.
- **Spec-gate** (CLAUDE.md rule) makes the brainstorm→plan transition structurally sound before any code is written.
- **Local gate** (pre-commit hook) moves fast feedback from ~12-minute CI to ~15-second local check.

---

## Section 1: Project agents

Three agents live in `.claude/agents/` at project root (not user-level `~/.claude/agents/`). Each agent is scoped to one concern, can be dispatched individually, and is listed in the CLAUDE.md dispatch table.

### `section-auditor`

**File:** `.claude/agents/section-auditor.md`

**Triggered by:** edits to `components/sections/*.tsx` or `content/*.ts`

**Checks:**

**Aesthetic compliance**
- Color tokens: only `--signal` (headings/accents/large text) and `--fg` (#E6FFE6, body text). No hardcoded hex/rgb colors.
- Never use `--signal` for paragraph-length text — fails WCAG AA contrast at small sizes.
- Font: JetBrains Mono everywhere except the "THE MATRIX HAS YOU." headline (Geist Black / Inter 900). No Google CDN font references.
- Borders: 1px only. No `border-radius` > 2px.
- Background: `#000000`. No off-black alternatives.

**Content discipline**
- No user-facing copy inlined in JSX. All copy must originate in `content/*.ts`.
- Exception: structural labels (aria-label, section headers like `"NETSTAT -AN"`) may be inline if not user-configurable content.

**RSC boundary**
- `'use client'` only where state, effects, or browser APIs are genuinely required.
- Client files must be named `*.client.tsx`.
- Flag any server component that gained `'use client'` without clear justification.

**Accessibility**
- Interactive elements have accessible names (aria-label or visible text).
- Semantic HTML: headings in logical order, lists for list content, buttons for actions.
- Color contrast: `--fg` on `#000000` passes (~13:1). `--signal` on `#000000` passes for large text only.

**CRT effects**
- Scanlines, grain, flicker, phosphor shadow: all must be disabled under `prefers-reduced-motion: reduce`.
- No new CSS animations without a `@media (prefers-reduced-motion: reduce) { animation: none }` counterpart.

**Hiring pitch signal**
- Does this section communicate value at the Staff/Principal hiring bar?
- Are numbers specific (€1B+ revenue, 40M+ tx/yr, PCI-DSS) rather than generic?
- Is the terminal aesthetic consistent (realistic-looking command output, not lorem ipsum)?

**Tools:** Read, Grep, Glob

---

### `perf-guardian`

**File:** `.claude/agents/perf-guardian.md`

**Triggered by:** changes to client island files, new dependencies added to `package.json`, or any change to `app/css/` with new animations/paint operations

**Checks:**

**RSC drift**
- Scan changed files for `'use client'` directives added since the last commit.
- For each new directive: is it justified? Could the component stay server-rendered?
- Existing client islands: `InteractiveShell.tsx`, `ContactForm.tsx`, `ToTopButton.tsx`, `MatrixRain.tsx`, `CRTOverlay.tsx`, `StatusBar.tsx`, `Dock.tsx`, `MobileTitleBar.tsx`, `AppShell.client.tsx`, `ErrorBoundary.client.tsx`.

**Client JS budget**
- Total client JS budget: 43KB gzipped across all islands.
- Per-route JS budget: 120KB gzipped.
- For new client islands: estimate size impact. Flag if approaching ceiling.
- Reference: `scripts/check-bundle-size.mjs` for exact thresholds.

**Dependency cost**
- New packages: check published gzip size (use bundlephobia heuristics).
- Flag any dep > 5KB gzipped unless it replaces something of equal or greater size.
- Re-export or tree-shaking available? Note it.

**CSS paint cost**
- New animations: are they GPU-composited (transform/opacity only)?
- CRT effects: existing `_crt.css` already has acceptable paint cost at current opacity. New additions must not increase repaints.
- All new animations gated by `prefers-reduced-motion`.

**Lighthouse budget**
- LCP < 1.8s, INP < 200ms, CLS < 0.05, Perf ≥ 95, A11y = 100, Best Practices ≥ 95, SEO = 100.
- Flag changes that are likely to regress any of these (large images without next/image, blocking scripts, layout-shifting content).

**Tools:** Read, Grep, Glob, Bash

---

### `content-checker`

**File:** `.claude/agents/content-checker.md`

**Triggered by:** edits to `content/*.ts` or `content/schemas.ts`

**Checks:**

**Schema validation**
- Run `node scripts/validate-content.mjs` and surface any Zod violations.
- New content files must have a matching schema in `content/schemas.ts`.

**Em-dash ban**
- Scan all changed content strings for the `—` character (U+2014).
- Portfolio-wide standing rule: no em dashes in any user-facing text.

**No fabricated data**
- Perf scores (Lighthouse numbers, LCP values) must be real measurements or display `—`.
- Career claims (employers, roles, revenue numbers) must match the source-of-truth documents — no invented or inflated figures.
- This rule is non-negotiable. See DECISIONS.md 2026-05-15 entry on `LIGHTHOUSE_FALLBACK`.

**Content key integrity**
- For each content export: verify it is imported and consumed by at least one component.
- Flag orphaned exports (defined but never used).

**Content freshness signals** (advisory, not blocking)
- `content/now.ts`: does it still reflect the current role and status?
- `content/employers.ts`: is the current employer still listed as active?

**Tools:** Read, Grep, Glob, Bash

---

## Section 2: Flow hardening

### CLAUDE.md — Project agent dispatch table

Add a new section to `CLAUDE.md` under **Operating role**:

```markdown
## Project agent dispatch

| Trigger | Agent |
|---|---|
| After editing any section component (`components/sections/*.tsx`) or content file (`content/*.ts`) | `section-auditor` |
| After touching client island files, adding deps, or writing new CSS animations | `perf-guardian` |
| After editing `content/*.ts` or `content/schemas.ts` | `content-checker` |
```

These agents must be dispatched **before** claiming a task complete. They are not optional review steps — they are part of the definition of done for any content or component change.

### CLAUDE.md — Spec-gate rule

Add to the `When in doubt` block in `CLAUDE.md`:

```markdown
- Before invoking `writing-plans`, the spec must clear three checks:
  1. No new client islands without a perf-budget justification (current: 43KB total client JS).
  2. No pattern listed in DECISIONS.md as rejected or superseded.
  3. No item from the "Out of scope" section of this CLAUDE.md.
  If a spec violates any of these, surface the conflict and resolve it before proceeding to planning.
```

### settings.local.json — Expand allowed skills

Add all skills referenced in the CLAUDE.md dispatch table that are not yet in the allow list:

```json
"Skill(superpowers:verification-before-completion)",
"Skill(superpowers:systematic-debugging)",
"Skill(code-review:code-review)",
"Skill(commit-commands:commit-push-pr)",
"Skill(security-review)",
"Skill(thinking-pre-mortem)",
"Skill(thinking-opportunity-cost)",
"Skill(thinking-second-order)",
"Skill(thinking-reversibility)",
"Skill(thinking-inversion)",
"Skill(thinking-leverage-points)",
"Skill(thinking-model-router)",
"Skill(pr-review-toolkit:review-pr)"
```

---

## Section 3: Pre-commit gate hardening

### `.husky/pre-commit`

Replace the current single-command hook:

```sh
# BEFORE
pnpm test
```

With the full fast-gate chain:

```sh
# AFTER
pnpm check && pnpm typecheck && pnpm validate-content && pnpm test
```

**Execution order rationale:** biome check first (fastest, ~1s), then tsc (~4s), then content validation (~1s), then vitest (~8s). First failure stops the chain — no waiting for downstream checks when lint already failed.

**What stays CI-only:** build, bundle-size gate, Lighthouse CI, axe E2E scan. These require environment secrets and take 10+ minutes; they cannot run pre-commit.

### `package.json` — `ci:local` script

Add to `scripts`:

```json
"ci:local": "pnpm check && pnpm typecheck && pnpm validate-content && pnpm test"
```

This mirrors the pre-commit exactly and can be run manually (`pnpm ci:local`) without triggering git hooks — useful when running only specific subsets of the suite.

---

## Files changed

| File | Change |
|---|---|
| `.claude/agents/section-auditor.md` | Create — section aesthetic + a11y + pitch review agent |
| `.claude/agents/perf-guardian.md` | Create — RSC drift + bundle budget + CRT motion agent |
| `.claude/agents/content-checker.md` | Create — schema + em-dash + no-fabrication agent |
| `CLAUDE.md` | Add project agent dispatch table + spec-gate rule |
| `.claude/settings.local.json` | Add 13 missing skill dispatch entries |
| `.husky/pre-commit` | Replace `pnpm test` with full fast-gate chain |
| `package.json` | Add `ci:local` script |

---

## Non-goals

- Visual regression testing (screenshot diffing) — not in scope; too much setup cost for current phase.
- Agent auto-invocation via Claude Code hooks — agents are dispatched manually via CLAUDE.md dispatch table rules, not wired to filesystem events.
- CI restructuring — the existing two-job CI (build-and-gate + e2e) stays as-is.
- Per-section Lighthouse tests — current Lighthouse CI runs once against the full page; per-section testing is premature.

---

## Spec self-review

**Placeholder scan:** No TBD or TODO. All agent checks are concrete. File paths are real.

**Internal consistency:** Agent triggers in Section 1 match the dispatch table in Section 2. Pre-commit chain in Section 3 matches `pnpm ci` (minus build/lhci/axe). `ci:local` script mirrors the pre-commit exactly.

**Scope check:** Seven files changed. Three new agent files, two config updates, one hook change, one script addition. Tractable in a single implementation plan.

**Ambiguity check:** "Hiring pitch signal" in section-auditor is advisory (no hard pass/fail). Clarified in agent description. Content freshness in content-checker is explicitly labeled advisory. All other checks are binary pass/fail.
