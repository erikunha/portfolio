# Agent Ecosystem Upgrade — Design Spec

**Date:** 2026-06-06
**Branch:** `feat/agent-ecosystem-upgrade`
**Author:** Erik Cunha
**Status:** Approved

---

## Context

Full 20-phase audit of the AI engineering ecosystem surfaced five high-leverage improvements.
After architect-reviewer FAIL (round 1) and root-cause diagnosis, the scope reduced to four
tracks:

- **Track A** (was: delete angular skills globally) → archive-not-delete, reversible
- **Track B** (CLAUDE.md dispatch additions) → unchanged
- **Track C** (battery-synthesis skill) → enforcement language corrected
- **Track D** (was: fix learning-loop watch-queue.md) → **dropped**: watch-queue.md exists
  at the correct Jobattle project path; the stop hook (`session_learning.py`) is correctly
  configured; audit finding was based on searching the wrong project scope.
- **Track E** (architect-gate verification) → **confirmed working this session**: the Skill
  matcher fired and blocked `superpowers:writing-plans` (exit 2) when no prior architect-reviewer PASS
  existed. No fallback hook needed. CLAUDE.md "convention pending" note will be updated.

Context preloading already works — the `remember` plugin (v0.7.3) loads `.remember/` at
session start. Plan red-team does not require a new skill — `thinking-pre-mortem` and
`thinking-red-team` already exist; only a CLAUDE.md dispatch rule is needed.

---

## Scope

Four independent tracks. Tracks A and E touch global config (`~/.claude/`); Tracks B and C
are project-level changes committed to this branch. Global changes are archive-reversible
or documentation-only.

---

## Track A — Global Archive of Irrelevant Skills

**What:** Archive 22 global skill files by moving them to `~/.claude/skills-archived/`
rather than deleting. Fully reversible by moving back.

**Justification scope:** These skills are irrelevant to *this project's* Next.js/React stack.
The user's primary stack is Angular but this portfolio is a Next.js codebase. Archiving
removes them from the loaded skill list for all projects — acceptable because the Angular
plugin in the Claude plugin ecosystem can be reinstalled in minutes via `claude plugin install`
if another Angular project needs them.

**Reversibility:** Move files back from `~/.claude/skills-archived/` — no reinstall needed.

### Skills archived (22 files)

20 Angular skills:
`angular-best-practices`, `angular-best-practices-material`, `angular-best-practices-ngrx`,
`angular-best-practices-primeng`, `angular-best-practices-signalstore`,
`angular-best-practices-spartan`, `angular-best-practices-tanstack`,
`angular-best-practices-transloco`, `angular-component`, `angular-developer`,
`angular-di`, `angular-directives`, `angular-forms`, `angular-http`, `angular-new-app`,
`angular-routing`, `angular-signals`, `angular-ssr`, `angular-testing`, `angular-tooling`

2 dead skills:
- `linting-neostandard-eslint9` — project uses Biome; will never trigger correctly
- `deploy-to-vercel` — superseded by GitHub Actions CI pipeline

### Hookify WARNs deleted (3 files)

These are advisory-only (exit 0), create alert fatigue, and have no enforcement value:
- `hookify.brainstorming-before-commit.local.md`
- `hookify.commit-skill-reminder.local.md`
- `hookify.pre-push-review.local.md`

Deletion (not archive) is appropriate for hookify files: they are local-only conventions
that have been superseded by mechanical enforcement (Husky `.review-passed` stamp gate,
`pnpm ci:local`, `git add -A` BLOCK hook). Kept: `block-git-add-all` (BLOCK) and
`stop-without-review` (BLOCK).

**Implementation order:** Perform Track A *after* Tracks B and C are committed to the
branch, so the reviewable, git-tracked work lands first and the global archive is a
subsequent reversible action.

---

## Track B — CLAUDE.md Dispatch Additions

**What:** Two new rules added to the Skill dispatch table + one to the Spot-check agents table in project `CLAUDE.md`.

### Rule 1 — nextjs-developer activation

```
| Next.js patterns | After implementing new API routes, server actions, or app router layouts | `nextjs-developer` |
```

Previously available but never dispatched. Directly relevant to this codebase.

### Rule 2 — Plan red-team

```
| After `superpowers:writing-plans` produces output for tasks with >5 steps | `thinking-pre-mortem` on the plan (not the feature — the *plan tasks*) |
```

Uses existing `thinking-pre-mortem` skill. No new skill needed.

### Rule 3 — Battery synthesis

```
| After dispatching full 5-agent battery, before `pnpm review:stamp` | `battery-synthesis` |
```

### Architect-gate documentation update (not a new dispatch rule)

Update the CLAUDE.md note that reads "Convention pending live proof" to:
"Confirmed enforced (2026-06-06): Skill matcher fired exit-2 and blocked `superpowers:writing-plans`
in a live session without a prior `GATE_RESULT: PASS`. Boundary: session-scoped PASS, not per-spec identity."

---

## Track C — New Skill: battery-synthesis

**Location:** `.claude/skills/battery-synthesis/SKILL.md`

**Purpose:** Read all 5 battery agent reports from current context, deduplicate overlapping
findings, classify by severity, flag agent conflicts, and output a unified action table to
reduce manual synthesis burden on the main Claude context.

**Nature:** A DX aid — synthesis tool, not a gate. It does not mechanically block
`pnpm review:stamp`. The synthesized table guides which fixes to apply before stamp;
the decision and the stamp remain the main Claude's responsibility.

### Trigger

Invoked by main Claude immediately after all 5 battery agents have returned their reports,
before `pnpm review:stamp`. Added to CLAUDE.md dispatch table (Rule 3 above).

### Input

The 5 battery reports are already in the main Claude context. No file reads needed.

### Output format

```markdown
## Battery Synthesis — [date]

### Critical
| Issue | File(s) | Agent(s) | Action |
|---|---|---|---|
| ... | ... | security-auditor | ... |

### Important
| Issue | File(s) | Agent(s) | Action | Note |
|---|---|---|---|---|
| ... | ... | pr-review-toolkit:review-pr + accessibility-tester | ... | Overlapping — one fix resolves both |

### Advisory
| Issue | File(s) | Agent(s) | Action |
|---|---|---|---|
| ... | ... | performance-engineer | ... |

### Conflicts requiring resolution before acting
- [perf] Add font preload vs [a11y] Avoid layout shift from font loading — pick one
  before addressing either row
```

### Deduplication logic

When two agents flag the same file + issue type (e.g., both `pr-review-toolkit:review-pr` and `accessibility-tester` flag
missing `aria-label` on the same button), merge into one row; list both agents in the
Agent(s) column; note "Overlapping — one fix resolves both."

### Conflict detection

When one agent recommends action X and another recommends action Y that contradicts X
on the same element or file, surface in the Conflicts section. Conflicts do not block
stamp mechanically; they inform the main Claude's decision before stamp.

---

## Track E — Architect-Gate Documentation

**What:** Update CLAUDE.md to record that the Skill matcher was live-confirmed.

**Finding:** `architect-gate.sh` was invoked this session when `superpowers:writing-plans` was called
without a prior architect-reviewer PASS. The hook fired exit 2 and blocked the skill.
The "convention pending live proof" caveat in CLAUDE.md is now resolved.

**Change:** One-line update to the CLAUDE.md section that describes the architect-gate
enforcement status.

---

## What Is NOT in Scope

- PostToolUse violation persister (css-lint-pending) — separate PR
- Architecture consistency checker agent — separate PR
- Unified memory retrieval / RAG — future investment
- Learning-loop changes — correctly wired to Jobattle; not broken
- Track D removed after diagnosis confirmed watch-queue.md exists at correct Jobattle path

---

## Implementation Order

1. **Track B** — CLAUDE.md updates (project-level, committed to branch, reviewable)
2. **Track C** — battery-synthesis skill file (project-level, committed to branch)
3. **Track E** — architect-gate documentation update in CLAUDE.md (project-level)
4. **Track A** — global archive of 22 skills + deletion of 3 hookify WARNs (global,
   after branch work is committed; archive is reversible)

---

## Success Criteria

- `ls ~/.claude/skills/ | grep angular` returns nothing
- `ls ~/.claude/skills-archived/ | grep -cE "^angular-"` returns 20 (archive exists)
- `ls ~/.claude/ | grep hookify` returns exactly 2 files (block-git-add-all, stop-without-review)
- `.claude/skills/battery-synthesis/SKILL.md` exists with correct output format
- CLAUDE.md contains `nextjs-developer` in spot-check table
- CLAUDE.md contains plan red-team rule (>5-step plans → thinking-pre-mortem on plan tasks)
- CLAUDE.md contains battery-synthesis dispatch rule
- CLAUDE.md architect-gate note updated from "convention pending" to "confirmed 2026-06-06"
- All project-level changes pass `pnpm ci:local`
- PR opened on `feat/agent-ecosystem-upgrade` containing Tracks B, C, and E only
  (Track A is global, not in PR diff — documented in PR body)
