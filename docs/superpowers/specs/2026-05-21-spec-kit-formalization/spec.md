# Spec-Kit Formalization — Design Spec

**Date:** 2026-05-21
**Status:** Approved
**Branch:** chore/p3-hardening (spec only — implementation deferred)

---

## Goal

Replace flat spec/plan files with a per-feature directory structure aligned to
spec-kit (github.com/github/spec-kit), add `CONSTITUTION.md` as a persistent
project governing document, and update CLAUDE.md output-path conventions so the
brainstorm → spec → plan → implement loop writes to the right place automatically.

---

## Architecture

Three artifacts, each independently useful:

```
CONSTITUTION.md              ← repo-root governing doc; read before any spec
docs/superpowers/specs/
  {YYYY-MM-DD-feature}/
    spec.md                  ← design decisions, architecture, trade-offs
    plan.md                  ← ordered implementation tasks
    [tasks.md]               ← optional; active-work only
    [contracts/]             ← optional; API specs / Zod schemas
docs/superpowers/README.md   ← layout guide for humans and agents
```

The `docs/superpowers/plans/` directory is eliminated; plan files move into their
feature directories.

---

## Section 1: Directory structure & naming convention

### Per-feature directory

```
docs/superpowers/specs/{YYYY-MM-DD-feature-name}/
  spec.md        ← what and why (design decisions, trade-offs)
  plan.md        ← how (ordered implementation tasks, verification steps)
  tasks.md       ← optional; only created during active implementation
  contracts/     ← optional; API specs or Zod schemas for complex features
```

### Naming rule

Directory name = spec basename with `-design` suffix stripped. For the one spec
without a `-design` suffix (`2026-05-16-clickable-chips-mobile-sync.md`), use
the basename as-is. For near-match pairs where spec and plan have different
filenames, see the explicit mapping table in Section 4.

| Existing spec file | Existing plan file | New directory |
|---|---|---|
| `2026-05-16-spec-kit-upgrade-design.md` | `2026-05-16-spec-kit-upgrade.md` | `2026-05-16-spec-kit-upgrade/` |
| `2026-05-16-clickable-chips-mobile-sync.md` | `2026-05-16-clickable-chips-mobile-sync.md` | `2026-05-16-clickable-chips-mobile-sync/` |
| `2026-05-21-2026-modernization-program-design.md` | `2026-05-21-2026-modernization-program.md` | `2026-05-21-2026-modernization-program/` |

### Orphan handling

**Plan without spec (7 cases):** create a stub `spec.md`:
```markdown
# {Title}
> Historical: implemented without a formal design doc.
```

**Spec without plan (1 case — `2026-05-19-mobile-lcp-strict-1800ms-campaign`):**
create a stub `plan.md`:
```markdown
# {Title} — Implementation Plan
> Historical: designed but not implemented, or plan not recorded.
```

---

## Section 2: CONSTITUTION.md

File: `CONSTITUTION.md` at repo root, alongside `CLAUDE.md`, `STANDARDS.md`, `DECISIONS.md`.

Purpose: one-sentence-per-principle distillation of the constraints every spec
must design inside. Agents and humans read it before proposing any change.

### Structure

```markdown
# CONSTITUTION.md

> Read before proposing any spec, architectural change, or new dependency.
> Details live in CLAUDE.md (commands, workflow), STANDARDS.md (11-chapter
> engineering bar), and DECISIONS.md (ADR log). This file is the summary layer.

## Identity
erikunha.dev is a hiring artifact for Staff/Principal Frontend + applied-AI roles.
Every architectural decision is evaluated against: does this raise or lower the
bar of the artifact?

## Governing constraints (non-negotiable)
- Performance: LCP < 1.8s, INP < 200ms, CLS < 0.05, JS gzipped < 120KB/route,
  client total < 43KB, Lighthouse Perf ≥ 95, A11y = 100, SEO = 100.
- Rendering: RSC by default; client islands by exception; all client files named
  `*.client.tsx`; zero client JS for static sections.
- Aesthetic: #000000 background, --signal (#00FF41) accents, --fg (#E6FFE6) body,
  JetBrains Mono everywhere, 1px borders, no border-radius > 2px.
- Stack: Next.js App Router, React 19, TypeScript strict, Biome, pnpm.
  No Tailwind, no CSS Modules, no CSS-in-JS. Lightning CSS via Next.js/Turbopack.
- Content: all user-facing copy lives in content/*.ts, Zod-validated at build time.

## Rejected patterns
See DECISIONS.md. Do not re-propose: GraphQL, Cloudflare Workers, multi-region
deploy, Sentry, CAPTCHA on contact form, per-section routing, state management
library, MDX, CMS, Tailwind, CSS Modules/CSS-in-JS, PostCSS plugins,
styled-components.

## Spec-driven workflow
brainstorm → spec → [architect-reviewer gate] → plan → implement → verify

Artifacts:
- Spec:  docs/superpowers/specs/YYYY-MM-DD-{feature}/spec.md
- Plan:  docs/superpowers/specs/YYYY-MM-DD-{feature}/plan.md
- Tasks: docs/superpowers/specs/YYYY-MM-DD-{feature}/tasks.md (active work only)

Skills:
- superpowers:brainstorming      → writes spec.md
- architect-reviewer (agent)     → gates spec before plan is written
- superpowers:writing-plans      → writes plan.md
- superpowers:executing-plans    → executes tasks from plan.md

## Quality bar
See STANDARDS.md (11 chapters). Summary:
1. Client JS: RSC-first, `*.client.tsx` naming; 43KB app-island design target, CI gates 220KB framework-inclusive total.
2. Tests: Vitest unit + Playwright E2E + axe a11y; no mocks on DB/Redis paths.
3. Security: CSP strict, rate-limit on all AI endpoints, no raw IP storage.
4. Performance: Lighthouse CI gates on every PR; LCP/INP/CLS non-negotiable.
5. Types: strict TS, no `any`, Zod-validated content, `satisfies` operator.
6. CSS: hand-rolled global CSS, BEM-ish, tokens in _tokens.css, no framework.
7. Content: typed TS modules, never inline copy in JSX.
8. Observability: Vercel RUM + Speed Insights; pino structured logs on API routes.
9. A11y: WCAG 2.1 AA minimum; Lighthouse A11y = 100 is a CI gate.
10. DX: pre-commit runs `pnpm check`; pre-push runs full fast-gate chain; CI has 4 required check jobs (build-and-gate, e2e-functional, e2e-visual, ai-eval).
11. Supply chain: deps pinned at latest on install; age gate > 7d before merge.

## Active phases
Current modernization program:
  docs/superpowers/specs/2026-05-21-2026-modernization-program/spec.md
```

---

## Section 3: CLAUDE.md updates

Two targeted changes only.

### 3a. Brainstorming output path (skill dispatch table)

Add a note to the `brainstorming` row trigger or to the `When in doubt` block:

```markdown
- Brainstorming writes spec to:
  `docs/superpowers/specs/YYYY-MM-DD-{feature}/spec.md`
- writing-plans writes plan to:
  `docs/superpowers/specs/YYYY-MM-DD-{feature}/plan.md`
  (same directory as the spec it implements)
```

### 3b. CONSTITUTION.md read rule (When in doubt block)

Prepend to the `When in doubt` section:

```markdown
- Read `CONSTITUTION.md` before proposing any spec or architectural change.
```

No other CLAUDE.md changes.

---

## Section 4: Migration

### Inventory

| Type | Count | Action |
|---|---|---|
| Flat specs (16 with `-design` suffix + 1 flat) | 17 | Move to `{feature}/spec.md` |
| Flat plans | 23 | Move to `{feature}/plan.md` |
| Exact-match pairs (same base name) | 14 | Standard move |
| Near-match pairs (same feature, different filenames) | 2 | Move with explicit mapping (see below) |
| Orphan plans (plan with no spec) | 7 | Create stub `spec.md` |
| Orphan specs (spec with no plan) | 1 | Create stub `plan.md` |
| `docs/superpowers/plans/` dir | 1 | Delete after migration |

### Near-match pairs (explicit mapping)

These pairs share a feature but have different filenames. Directory name uses the
spec basename (with `-design` stripped):

| Spec file | Plan file | New directory |
|---|---|---|
| `2026-05-14-mobile-responsive-design.md` | `2026-05-14-mobile-responsive-layout.md` | `2026-05-14-mobile-responsive/` |
| `2026-05-14-commitizen-conventional-commits-design.md` | `2026-05-14-repo-bootstrap-commitizen.md` | `2026-05-14-commitizen-conventional-commits/` |

### 7 orphan plans (plan without matching spec)

| Plan file | New directory | Stub spec title |
|---|---|---|
| `2026-05-15-architectural-audit-fixes.md` | `2026-05-15-architectural-audit-fixes/` | Architectural Audit Fixes |
| `2026-05-15-perf-a11y.md` | `2026-05-15-perf-a11y/` | Performance & A11y Fixes |
| `2026-05-15-principal-review-fixes.md` | `2026-05-15-principal-review-fixes/` | Principal Review Fixes |
| `2026-05-16-mobile-responsive-fixes.md` | `2026-05-16-mobile-responsive-fixes/` | Mobile Responsive Fixes |
| `2026-05-19-mobile-lcp-pr-1-css-defer.md` | `2026-05-19-mobile-lcp-pr-1-css-defer/` | Mobile LCP — PR 1 CSS Defer |
| `2026-05-19-mobile-lcp-task-0-discovery.md` | `2026-05-19-mobile-lcp-task-0-discovery/` | Mobile LCP — Task 0 Discovery |
| `2026-05-19-pr-comment-harness.md` | `2026-05-19-pr-comment-harness/` | PR Comment Harness |

### 1 orphan spec (spec without matching plan)

| Spec file | New directory | Stub plan title |
|---|---|---|
| `2026-05-19-mobile-lcp-strict-1800ms-campaign-design.md` | `2026-05-19-mobile-lcp-strict-1800ms-campaign/` | Mobile LCP Strict 1800ms Campaign |

### Migration steps (one atomic commit)

For each of the 13 exact-match pairs with `-design` suffix:
1. `mkdir docs/superpowers/specs/{feature-name}/`
2. `git mv docs/superpowers/specs/{feature}-design.md docs/superpowers/specs/{feature-name}/spec.md`
3. `git mv docs/superpowers/plans/{feature}.md docs/superpowers/specs/{feature-name}/plan.md`

For the 1 exact-match pair without `-design` suffix (`clickable-chips-mobile-sync`):
1. `mkdir docs/superpowers/specs/2026-05-16-clickable-chips-mobile-sync/`
2. `git mv docs/superpowers/specs/2026-05-16-clickable-chips-mobile-sync.md docs/superpowers/specs/2026-05-16-clickable-chips-mobile-sync/spec.md`
3. `git mv docs/superpowers/plans/2026-05-16-clickable-chips-mobile-sync.md docs/superpowers/specs/2026-05-16-clickable-chips-mobile-sync/plan.md`

For the 2 near-match pairs (use explicit mapping table above):
1. `mkdir docs/superpowers/specs/{feature-name}/`
2. `git mv docs/superpowers/specs/{spec-file} docs/superpowers/specs/{feature-name}/spec.md`
3. `git mv docs/superpowers/plans/{plan-file} docs/superpowers/specs/{feature-name}/plan.md`

For each of the 7 orphan plans:
1. `mkdir docs/superpowers/specs/{feature-name}/`
2. Write stub `spec.md`
3. `git mv docs/superpowers/plans/{feature}.md docs/superpowers/specs/{feature-name}/plan.md`

For the 1 orphan spec:
1. `mkdir docs/superpowers/specs/2026-05-19-mobile-lcp-strict-1800ms-campaign/`
2. `git mv docs/superpowers/specs/2026-05-19-mobile-lcp-strict-1800ms-campaign-design.md docs/superpowers/specs/2026-05-19-mobile-lcp-strict-1800ms-campaign/spec.md`
3. Write stub `plan.md`

Final steps:
4. `rmdir docs/superpowers/plans/` (should be empty after all moves)
5. Write `CONSTITUTION.md` at repo root
6. Write `docs/superpowers/README.md`
7. Apply CLAUDE.md Section 3 changes
8. Single commit: `chore(docs): migrate specs to per-feature dirs + add CONSTITUTION.md`

### docs/superpowers/README.md content

```markdown
# docs/superpowers/

Spec-driven development artifacts for erikunha.dev.

## Structure

specs/{YYYY-MM-DD-feature}/
  spec.md      — design decisions, architecture, trade-offs (written by brainstorming skill)
  plan.md      — ordered implementation tasks (written by writing-plans skill)
  tasks.md     — optional; present only during active implementation
  contracts/   — optional; API specs or Zod schemas

## Workflow

brainstorm → spec.md → [architect-reviewer] → plan.md → implement → verify

See CONSTITUTION.md (repo root) for governing constraints.
See CLAUDE.md for skill and agent dispatch rules.

## Historical note

Prior to 2026-05-21, specs lived as flat files in specs/ and plans/ separately.
All migrated in commit chore(docs): migrate specs to per-feature dirs.
```

---

## Non-goals

- Installing spec-kit's `.specify/` directory or slash commands — superpowers covers the workflow layer.
- Restructuring content of existing specs/plans — files are moved, not rewritten.
- Adding `contracts/` to historical features — only future complex features need it.
- Changing the CI pipeline, tests, or any app code.

---

## Files changed

| File | Operation |
|---|---|
| `CONSTITUTION.md` | Create |
| `docs/superpowers/README.md` | Create |
| `docs/superpowers/specs/{24 feature dirs}/spec.md` | Create (moved from flat or stub) |
| `docs/superpowers/specs/{24 feature dirs}/plan.md` | Create (moved from flat or stub) |
| `docs/superpowers/plans/` | Delete (emptied) |
| `CLAUDE.md` | Modify — 2 targeted additions |

Total feature directories: 14 exact pairs + 2 near-match pairs + 7 orphan plans + 1 orphan spec = 24.

---

## Spec self-review

**Placeholder scan:** No TBD or TODO. All 7 orphan plan filenames and all 2
near-match pair mappings are explicit. The 1 orphan spec is named. CONSTITUTION.md
content is fully written out.

**Internal consistency:** Section 1 naming rule matches the migration table in
Section 4. Near-match pairs in Section 4 use directory names derived from the
spec basename (with -design stripped), consistent with the Section 1 rule.
CLAUDE.md changes in Section 3 reference the paths defined in Section 1.

**Scope check:** Doc-only change. No app code, no CI, no dependencies. A single
focused commit. Tractable as one implementation plan.

**Ambiguity check:** "Atomic commit" is explicit. "Stub spec.md" content is shown
verbatim. Every orphan file is named explicitly. The non-`-design` spec file
(`clickable-chips-mobile-sync.md`) has its own row in the naming rule table.
