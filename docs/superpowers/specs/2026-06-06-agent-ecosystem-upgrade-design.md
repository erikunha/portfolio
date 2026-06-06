# Agent Ecosystem Upgrade — Design Spec

**Date:** 2026-06-06
**Branch:** `feat/agent-ecosystem-upgrade`
**Author:** Erik Cunha
**Status:** Approved

---

## Context

Full 20-phase audit of the AI engineering ecosystem surfaced five high-leverage improvements:
removing irrelevant global skills (Angular), dropping ineffective hookify WARN rules that
create alert fatigue without blocking, building a battery-synthesis skill to replace manual
synthesis of 5-agent battery output, fixing the learning-loop output path (watch-queue.md
not found), and verifying the architect-gate hook that is currently unconfirmed.

Context preloading is already handled by the installed `remember` plugin (v0.7.3).
Plan red-team does not require a new skill — `thinking-pre-mortem` already exists and
only needs a CLAUDE.md dispatch rule.

---

## Scope

Five independent tracks, all AI engineering infrastructure (no product code changes).
Tracks A and D are global filesystem changes (apply immediately across all projects).
Tracks B, C, and E are project-level changes committed to this branch.

---

## Track A — Global Cleanup

**What:** Delete 23 skill files from `~/.claude/skills/` and 3 hookify WARN files from `~/.claude/`.

### Skills deleted (global, immediate)

21 Angular skills — irrelevant to this Next.js codebase, add noise to skill routing:
`angular-best-practices`, `angular-best-practices-material`, `angular-best-practices-ngrx`,
`angular-best-practices-primeng`, `angular-best-practices-signalstore`,
`angular-best-practices-spartan`, `angular-best-practices-tanstack`,
`angular-best-practices-transloco`, `angular-component`, `angular-developer`,
`angular-di`, `angular-directives`, `angular-forms`, `angular-http`, `angular-new-app`,
`angular-routing`, `angular-signals`, `angular-ssr`, `angular-testing`, `angular-tooling`

2 dead skills — wrong tool for this project:
- `linting-neostandard-eslint9` — project uses Biome, not ESLint; will never trigger correctly
- `deploy-to-vercel` — superseded by GitHub Actions CI pipeline

### Hookify WARN rules deleted (global, immediate)

3 rules that are advisory-only (exit 0, alert fatigue, no enforcement):
- `hookify.brainstorming-before-commit.local.md` — WARN, bypassed silently
- `hookify.commit-skill-reminder.local.md` — WARN, bypassed silently
- `hookify.pre-push-review.local.md` — redundant with `.review-passed` stamp gate in Husky

Kept: `hookify.block-git-add-all.local.md` (BLOCK) and `hookify.stop-without-review.local.md` (BLOCK).

---

## Track B — CLAUDE.md Dispatch Additions

**What:** Three new dispatch rules added to project `CLAUDE.md` under the Skill dispatch table.

### Rule 1 — nextjs-developer activation

```
| After implementing new API routes, server actions, or app router layouts | `nextjs-developer` |
```

Previously available but never dispatched. This agent is precisely relevant to this codebase.

### Rule 2 — Plan red-team

```
| After `writing-plans` produces output for tasks with >5 steps | `thinking-pre-mortem` on the plan (not the feature — the *plan tasks themselves*) |
```

Uses existing `thinking-pre-mortem` skill (installed). No new skill needed.

### Rule 3 — Battery synthesis

```
| After dispatching full 5-agent battery, before `pnpm review:stamp` | `battery-synthesis` skill |
```

Replaces manual synthesis of 5 separate text reports. Documented below in Track C.

---

## Track C — New Skill: battery-synthesis

**Location:** `.claude/skills/battery-synthesis/SKILL.md`

**Purpose:** Read all 5 battery agent reports from current context, deduplicate overlapping
findings, classify by severity, flag agent conflicts, and output a single unified action table.

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
| ... | ... | pr-review + a11y | ... | Overlapping — one fix resolves both |

### Advisory
| Issue | File(s) | Agent(s) | Action | Conflict? |
|---|---|---|---|---|
| ... | ... | perf-engineer | ... | Conflicts with a11y: preload vs layout shift — resolve before acting |

### Conflicts requiring explicit resolution
- [perf] Add font preload vs [a11y] Avoid layout shift from font loading — pick one
```

### Deduplication logic

When two agents flag the same file + issue type (e.g., both pr-review and a11y flag
missing `aria-label` on the same button), merge into one row, list both agents in the
Agent(s) column, note "Overlapping — one fix resolves both."

### Conflict detection

When one agent recommends action X and another recommends action Y that contradicts X
(on the same element or file), surface explicitly in the Conflicts section rather than
merging. The conflict must be resolved before `pnpm review:stamp` proceeds.

---

## Track D — Fix Learning-Loop Output Path

**What:** The learning-loop agent references `watch-queue.md` as its backlog file. The file
does not exist in `~/.claude/`. The agent's output for complex improvements is silently
discarded.

### Changes

1. Create `~/.claude/watch-queue.md` with a structured header:
   ```markdown
   # Watch Queue
   Items the learning-loop queued for future improvement.
   Format: [date] | [category] | description | source session

   ## Backlog
   ```

2. Read the learning-loop agent file (`~/.claude/agents/learning-loop.md`) and confirm
   the output path reference. If it references a relative path or wrong location, update
   it to the absolute path `~/.claude/watch-queue.md`.

3. Update `~/.claude/projects/.../memory/MEMORY.md` index to note watch-queue.md location.

---

## Track E — Architect-Gate Verification

**What:** The architect-gate hook (`architect-gate.sh`) uses a `Skill` tool matcher to
block `superpowers:writing-plans` without a prior `architect-reviewer` PASS. Whether the
`Skill` matcher fires (exit 2 = block) has never been live-confirmed. The CLAUDE.md
currently marks this as "convention pending live proof."

### Verification procedure

1. In a fresh Agent sub-session with no prior architect-reviewer PASS in transcript,
   invoke `superpowers:writing-plans` and observe the result.
2. If exit 2 fires: document as confirmed in CLAUDE.md, remove "convention pending" note.
3. If it does not fire: replace `architect-gate.sh` with a Bash-matcher hook that:
   - On any `git commit` during a plan-implementing session, checks for a `.architect-pass`
     state file in `.claude/`
   - The `architect-reviewer` agent writes this file (via a CLAUDE.md instruction) when
     it returns PASS
   - Clears on session end (Stop hook)

### Fallback hook design (if Skill matcher fails)

```bash
# .claude/hooks/architect-gate-bash.sh
# PreToolUse: Bash matcher on "git commit"
PASS_FILE="$(git rev-parse --show-toplevel)/.claude/.architect-pass"
if ! grep -q "$(date +%Y-%m-%d)" "$PASS_FILE" 2>/dev/null; then
  echo "[BLOCKED] architect-reviewer PASS required today before committing plan work."
  exit 2
fi
```

---

## What Is NOT in Scope

- PostToolUse violation persister (css-lint-pending) — good idea, separate PR
- Architecture consistency checker agent — separate PR, requires new agent file
- Unified memory retrieval skill — context preloading already works via remember plugin;
  a deeper RAG-based retrieval is a future investment, not this sprint
- Removal of thinking-ooda, code-simplifier — audit-identified but not in user's request;
  raise as separate decision

---

## Implementation Order

1. Track A (global cleanup, no branch dependency) — do first, reduces noise immediately
2. Track D (learning-loop fix, global) — simple, do alongside A
3. Track E (architect-gate verification) — live test determines whether Track E requires
   additional hook work
4. Track B (CLAUDE.md) — after verification result is known
5. Track C (battery-synthesis skill) — after CLAUDE.md is updated

---

## Success Criteria

- `ls ~/.claude/skills/ | grep angular` returns nothing
- `ls ~/.claude/ | grep hookify` returns exactly 2 files (block-git-add-all, stop-without-review)
- `~/.claude/watch-queue.md` exists and learning-loop agent references correct path
- `battery-synthesis` skill file exists and CLAUDE.md dispatch rule added
- `nextjs-developer` in CLAUDE.md spot-check table
- Plan red-team dispatch rule in CLAUDE.md
- Architect-gate status documented as verified or replaced with confirmed Bash hook
- PR opened with all 5 tracks complete, all gates passing
