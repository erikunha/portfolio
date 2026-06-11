# Agent Ecosystem Upgrade — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development`
> (recommended) or `superpowers:executing-plans` to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Archive 22 irrelevant global skills, add 3 dispatch-table rows + 1 architect-gate text update to CLAUDE.md, create the
`battery-synthesis` skill, and update the architect-gate status from "convention pending"
to "confirmed enforced."

**Architecture:** Four independent tracks. Tracks B, C, and E are project-level changes
committed to `feat/agent-ecosystem-upgrade` and land in the PR. Track A is a global
filesystem operation (skill archive + hookify deletion) run after branch work is committed;
it is documented in the PR body but not in the diff.

**Tech Stack:** Bash, Markdown (CLAUDE.md table edits, SKILL.md creation), `pnpm ci:local`
for final gate.

---

## File Map

| Track | File | Action |
|---|---|---|
| B | `CLAUDE.md` | Modify — add 3 rows to dispatch/spot-check tables + update architect-gate text |
| C | `.claude/skills/battery-synthesis/SKILL.md` | Create — new project-level skill |
| E | `CLAUDE.md` | Modify — same file as Track B (done together) |
| A | `~/.claude/skills-archived/` | Create dir + move 22 files (global, outside repo) |
| A | `~/.claude/hookify.brainstorming-before-commit.local.md` | Delete (global) |
| A | `~/.claude/hookify.commit-skill-reminder.local.md` | Delete (global) |
| A | `~/.claude/hookify.pre-push-review.local.md` | Delete (global) |
| — | `docs/superpowers/specs/2026-06-06-agent-ecosystem-upgrade-design.md` | Verify spec is committed on the branch |

---

## Task 1: Verify design spec revision is committed on the branch

**Files:**
- Read: `docs/superpowers/specs/2026-06-06-agent-ecosystem-upgrade-design.md`

No commit needed — the round-2 revision was already committed before this plan was written.

- [ ] **Step 1: Confirm the spec is in git history**

```bash
git log --oneline -- docs/superpowers/specs/2026-06-06-agent-ecosystem-upgrade-design.md
```

Expected: the spec file appears in git log (at least one commit on this branch).

- [ ] **Step 2: Confirm working tree is clean for this file**

```bash
git diff docs/superpowers/specs/2026-06-06-agent-ecosystem-upgrade-design.md
```

Expected: no output (file is committed, not modified). If there is output, stage and commit before proceeding to Task 2.

---

## Task 2: CLAUDE.md — Add `nextjs-developer` to spot-check table (Track B Rule 1)

**Files:**
- Modify: `CLAUDE.md` (project root)

- [ ] **Step 1: Verify rule does not exist yet**

```bash
grep -n "nextjs-developer" CLAUDE.md
```

Expected: no output (the agent is not yet in the dispatch table).

- [ ] **Step 2: Find the spot-check agents table and add the new row**

The spot-check agents table ends with the `dependency-manager` row. Add the
`nextjs-developer` row immediately after it.

Find this exact text in `CLAUDE.md`:

```
| Bundle growth | After adding a new dependency | `dependency-manager` |
```

Replace with:

```
| Bundle growth | After adding a new dependency | `dependency-manager` |
| Next.js patterns | After implementing new API routes, server actions, or app router layouts | `nextjs-developer` |
```

- [ ] **Step 3: Verify the row was added**

```bash
grep -n "nextjs-developer" CLAUDE.md
```

Expected: one match — the new table row.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "chore(claude): add nextjs-developer to spot-check dispatch table"
```

Expected: commit succeeds, pre-commit hooks pass.

---

## Task 3: CLAUDE.md — Add plan red-team and battery-synthesis dispatch rules (Track B Rules 2–3)

**Files:**
- Modify: `CLAUDE.md` (project root)

- [ ] **Step 1: Verify neither rule exists yet**

```bash
grep -n "battery-synthesis\|thinking-pre-mortem — run on" CLAUDE.md
```

Expected: no output.

- [ ] **Step 2: Find the last row of the Skill dispatch table and append two new rows**

The Skill dispatch table ends with the `web-design-guidelines` row:

Find this exact text in `CLAUDE.md`:

```
| Before any UI code review (alongside `ui-ux-tester` dispatch) | `web-design-guidelines` |
```

Replace with:

```
| Before any UI code review (alongside `ui-ux-tester` dispatch) | `web-design-guidelines` |
| After `writing-plans` produces output for tasks with >5 steps | `thinking-pre-mortem` — run on the plan tasks themselves, not the feature |
| After dispatching the full 5-agent battery, before `pnpm review:stamp` | `battery-synthesis` |
```

- [ ] **Step 3: Verify both rows were added**

```bash
grep -n "battery-synthesis\|thinking-pre-mortem — run on" CLAUDE.md
```

Expected: two matches.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "chore(claude): add plan red-team and battery-synthesis dispatch rules"
```

---

## Task 4: CLAUDE.md — Update architect-gate from "convention pending" to "confirmed" (Track E)

**Files:**
- Modify: `CLAUDE.md` (two occurrences — project-agent-dispatch table + when-in-doubt section)

- [ ] **Step 1: Confirm both occurrences of "Convention pending live proof" exist**

```bash
grep -n "Convention pending live proof" CLAUDE.md
```

Expected: exactly 2 matches on different lines.

- [ ] **Step 2: Update first occurrence (in the Hard gates table)**

Find this exact text in `CLAUDE.md` (the `architect-reviewer` gate row in the Hard gates
table under `## Project agent dispatch`):

```
**Convention pending live proof:** the script's exit-2 logic is verified, but whether a PreToolUse `Skill` matcher actually intercepts + blocks is NOT yet live-confirmed (needs a session reload). Treat as convention until a live Skill-matcher block is observed; then promote to "enforced". Boundary: session-scoped PASS, not per-spec identity
```

Replace with:

```
**Confirmed enforced (2026-06-06):** Skill matcher fired exit-2 and blocked `writing-plans` in a live session without a prior GATE_RESULT: PASS. Boundary: session-scoped PASS, not per-spec identity
```

- [ ] **Step 3: Update second occurrence (in the "## When in doubt" section)**

Find this exact text in `CLAUDE.md`:

```
**Convention pending live proof:** the script's exit-2 logic is verified by direct invocation, but whether a PreToolUse `Skill` matcher actually fires + blocks is not yet live-confirmed (the existing hooks only prove the `Bash` matcher; a `Skill`-matcher block needs a session reload to observe). Per "no claim outlives its enforcement," treat this as convention until a live `Skill`-matcher block is observed, then promote to enforced. Boundaries: session-scoped PASS, not per-spec identity (spec identity is not a structured transcript field).
```

Replace with:

```
**Confirmed enforced (2026-06-06):** Skill matcher fired exit-2 and blocked `writing-plans` in a live session without a prior GATE_RESULT: PASS. Boundaries: session-scoped PASS, not per-spec identity (spec identity is not a structured transcript field).
```

- [ ] **Step 4: Verify no "Convention pending" text remains**

```bash
grep -n "Convention pending" CLAUDE.md
```

Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md
git commit -m "chore(claude): update architect-gate status to confirmed-enforced (2026-06-06)"
```

---

## Task 5: Create battery-synthesis skill (Track C)

**Files:**
- Create: `.claude/skills/battery-synthesis/SKILL.md`

- [ ] **Step 1: Verify the skill does not exist yet**

```bash
ls .claude/skills/ | grep battery
```

Expected: no output.

- [ ] **Step 2: Create the directory and skill file**

```bash
mkdir -p .claude/skills/battery-synthesis
```

Write `.claude/skills/battery-synthesis/SKILL.md` with this exact content:

```markdown
# Battery Synthesis

A DX aid for unifying the output of the 5-agent review battery into a single,
deduplicated, prioritized action table. Not a gate — the stamp decision and
the responsibility for fixing findings remain with the main Claude.

## When to use

After all 5 battery agents have returned their reports and before `pnpm review:stamp`.

Battery agents: `pr-review-toolkit:review-pr`, `accessibility-tester`,
`security-auditor`, `performance-engineer`, `dependency-manager`.

Dispatch trigger in CLAUDE.md: "After dispatching the full 5-agent battery, before
`pnpm review:stamp` → `battery-synthesis`"

## How to synthesize

Read all 5 reports from the current context in order. Do NOT re-dispatch agents.

**Step 1 — Extract findings.** For each report, collect every finding:
- Severity as the agent stated it (Critical / Important / Advisory or equivalent)
- File path(s) affected
- Issue description (one line)
- Agent name

**Step 2 — Deduplicate.** When two or more agents flag the same file + issue class
(e.g., both `pr-review-toolkit` and `accessibility-tester` flag a missing `aria-label`
on the same button):
- Merge into one row
- List all agent names in the Agent(s) column separated by ` + `
- Add note: "Overlapping — one fix resolves both"
- Use the highest severity across the duplicates

**Step 3 — Detect conflicts.** When one agent recommends action X and another recommends
action Y that contradicts X on the same element or file (e.g., `performance-engineer`
says "add preload for this font" and `accessibility-tester` says "avoid layout shift from
this font loading"), do NOT merge them. Surface them in the Conflicts section instead.

**Step 4 — Classify.** Sort all deduplicated findings by severity:
Critical → Important → Advisory.

**Step 5 — Output** the table in the format below.

## Output format

~~~markdown
## Battery Synthesis — YYYY-MM-DD

### Critical
| Issue | File(s) | Agent(s) | Action |
|---|---|---|---|
| Missing rate-limit on /api/example | app/api/example/route.ts | security-auditor | Add `applyRateLimit()` call before handler logic |

### Important
| Issue | File(s) | Agent(s) | Action | Note |
|---|---|---|---|---|
| Missing aria-label on close button | components/client/Dialog.client.tsx | pr-review-toolkit:review-pr + accessibility-tester | Add aria-label="Close dialog" | Overlapping — one fix resolves both |

### Advisory
| Issue | File(s) | Agent(s) | Action |
|---|---|---|---|
| Unused import `clsx` | components/sections/Hero.tsx | pr-review-toolkit:review-pr | Remove import |

### Conflicts requiring resolution before acting
- [perf] Add `<link rel="preload">` for JetBrains Mono ↔ [a11y] Avoid CLS from font
  swap — pick one approach before addressing either row. Options: (a) preload + `font-display:
  block` to eliminate swap; (b) keep `font-display: swap` and accept first-paint penalty.
~~~

## After synthesis

- Address all Critical and Important rows before calling `pnpm review:stamp`.
- Advisory rows are optional; note any you skip.
- Resolve all Conflicts explicitly — pick the approach, document the choice, then act.
- The table does not mechanically block stamp. It informs your decision.
- If a conflict cannot be resolved without user input, escalate before stamping.
```

- [ ] **Step 3: Verify the file was created with correct content**

```bash
ls .claude/skills/battery-synthesis/SKILL.md
head -5 .claude/skills/battery-synthesis/SKILL.md
```

Expected: file exists; first 5 lines show the `# Battery Synthesis` heading and description.

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/battery-synthesis/SKILL.md
git commit -m "feat(claude): add battery-synthesis skill for 5-agent battery output unification"
```

---

## Task 6: Run pnpm ci:local to verify all project-level changes pass gates

**Files:** none — verification only

- [ ] **Step 1: Run the full local CI chain**

```bash
pnpm ci:local 2>&1 | tail -20
```

Expected: all checks pass (Biome, typecheck, validate-content, client-naming, dep-pinning,
harness-size, section-order, doc-drift, tests). CLAUDE.md and skill file changes are
unlikely to affect these gates; if a gate fails, investigate before assuming it is unrelated.

- [ ] **Step 2: Confirm all 4 implementation commits are on the branch**

```bash
git log main..HEAD --oneline | grep -E "battery-synthesis skill|architect-gate status|plan red-team|nextjs-developer"
```

Expected: exactly 4 lines:
```
<sha> feat(claude): add battery-synthesis skill for 5-agent battery output unification
<sha> chore(claude): update architect-gate status to confirmed-enforced (2026-06-06)
<sha> chore(claude): add plan red-team and battery-synthesis dispatch rules
<sha> chore(claude): add nextjs-developer to spot-check dispatch table
```

Note: The branch will also contain doc/spec/fix commits from the planning phase — these are expected and do not affect this gate.

---

## Task 7: Global archive — Angular skills and dead skills (Track A)

**Context:** This is a global filesystem operation. It runs AFTER the branch is committed
and is NOT in the PR diff. The changes apply to `~/.claude/skills/` which is outside
this git repository.

**Reversibility:** Skills are moved to `~/.claude/skills-archived/`, not deleted. Restore
by moving back: `mv ~/.claude/skills-archived/<skill> ~/.claude/skills/<skill>`.

- [ ] **Step 1: Create the archive directory**

```bash
mkdir -p ~/.claude/skills-archived
```

- [ ] **Step 2: Archive all 20 Angular skills**

```bash
for skill in \
  angular-best-practices \
  angular-best-practices-material \
  angular-best-practices-ngrx \
  angular-best-practices-primeng \
  angular-best-practices-signalstore \
  angular-best-practices-spartan \
  angular-best-practices-tanstack \
  angular-best-practices-transloco \
  angular-component \
  angular-developer \
  angular-di \
  angular-directives \
  angular-forms \
  angular-http \
  angular-new-app \
  angular-routing \
  angular-signals \
  angular-ssr \
  angular-testing \
  angular-tooling; do
  mv ~/.claude/skills/$skill ~/.claude/skills-archived/$skill
done
```

- [ ] **Step 3: Archive the 2 dead skills**

```bash
mv ~/.claude/skills/linting-neostandard-eslint9 ~/.claude/skills-archived/linting-neostandard-eslint9
mv ~/.claude/skills/deploy-to-vercel ~/.claude/skills-archived/deploy-to-vercel
```

- [ ] **Step 4: Verify Angular skills are gone from active skills**

```bash
ls ~/.claude/skills/ | grep angular
```

Expected: no output.

- [ ] **Step 5: Verify archived skills exist**

```bash
ls ~/.claude/skills-archived/ | wc -l
```

Expected: 22 (20 Angular + 2 dead).

---

## Task 8: Global deletion — Hookify WARN rules (Track A continued)

**Context:** These 3 hookify files are advisory-only conventions superseded by mechanical
enforcement (Husky `.review-passed` stamp, `pnpm ci:local`, `block-git-add-all` BLOCK
hook). Deletion is appropriate — they are not archived because they provide no value even
if restored.

**Verify first: only 3 WARNs exist (the 2 BLOCKs must be preserved)**

- [ ] **Step 1: Confirm current hookify file count and names**

```bash
ls ~/.claude/ | grep hookify
```

Expected: exactly 5 files:
```
hookify.block-git-add-all.local.md
hookify.brainstorming-before-commit.local.md
hookify.commit-skill-reminder.local.md
hookify.pre-push-review.local.md
hookify.stop-without-review.local.md
```

- [ ] **Step 2: Delete the 3 WARN-only files**

```bash
rm ~/.claude/hookify.brainstorming-before-commit.local.md
rm ~/.claude/hookify.commit-skill-reminder.local.md
rm ~/.claude/hookify.pre-push-review.local.md
```

- [ ] **Step 3: Verify only the 2 BLOCK files remain**

```bash
ls ~/.claude/ | grep hookify
```

Expected: exactly 2 files:
```
hookify.block-git-add-all.local.md
hookify.stop-without-review.local.md
```

---

## Task 9: Verify all success criteria

- [ ] **Step 1: Angular skills archived**

```bash
ls ~/.claude/skills/ | grep angular
```

Expected: no output.

- [ ] **Step 2: Archive exists with 22 files**

```bash
ls ~/.claude/skills-archived/ | wc -l
```

Expected: `22`

- [ ] **Step 3: Hookify WARNs deleted**

```bash
ls ~/.claude/ | grep hookify
```

Expected: exactly 2 lines (`block-git-add-all` and `stop-without-review`).

- [ ] **Step 4: battery-synthesis skill exists**

```bash
ls .claude/skills/battery-synthesis/SKILL.md
```

Expected: file exists (no error).

- [ ] **Step 5: nextjs-developer in CLAUDE.md**

```bash
grep "nextjs-developer" CLAUDE.md
```

Expected: 1 match — the spot-check table row.

- [ ] **Step 6: battery-synthesis and plan red-team in CLAUDE.md**

```bash
grep "battery-synthesis\|thinking-pre-mortem — run on" CLAUDE.md
```

Expected: 2 matches.

- [ ] **Step 7: architect-gate confirmed (no "Convention pending" text)**

```bash
grep "Convention pending" CLAUDE.md
```

Expected: no output.

- [ ] **Step 8: ci:local passes**

```bash
pnpm ci:local 2>&1 | tail -5
```

Expected: no errors.

---

## Self-Review

**Spec coverage:**

| Spec requirement | Task covering it |
|---|---|
| Archive 22 skills to ~/.claude/skills-archived/ | Task 7 |
| Delete 3 hookify WARN files | Task 8 |
| nextjs-developer spot-check rule | Task 2 |
| Plan red-team dispatch rule (>5-step plans → thinking-pre-mortem) | Task 3 |
| battery-synthesis dispatch rule | Task 3 |
| architect-gate confirmation update | Task 4 |
| battery-synthesis SKILL.md created | Task 5 |
| pnpm ci:local verification | Task 6 |
| All success criteria verified | Task 9 |
| Spec revision verified as committed | Task 1 |

No spec requirements without a task.

**Placeholder scan:** No TBD, TODO, or incomplete steps. All shell commands show exact
flags. All Edit steps show the exact find and replacement strings. ✅

**Type consistency:** No function signatures in this plan (config changes only). The
`battery-synthesis` SKILL.md content and the CLAUDE.md dispatch rule that references
it both use the same skill name (`battery-synthesis`). ✅
