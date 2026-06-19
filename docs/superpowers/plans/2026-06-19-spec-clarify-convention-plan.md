# Spec Clarify Convention Implementation Plan

> For use with `agentic-workers` (or any plan-executing agent). Execute tasks in order; check each box on completion. Each task is independently committable.

## Goal

Formalize a single documentation convention: a `## Clarifications resolved` section in the spec template, capturing the open design questions the brainstorming interview closed and their resolutions. Document it in `docs/handbook/knowledge-architecture.md`'s spec→plan pipeline section, add one sentence acknowledging that plans already carry stable-ID checkbox tasks (so no separate `tasks` artifact is needed), and record the decision as an ADR in `DECISIONS.md`.

This is the smallest unit in the platform-gaps program: one handbook edit + one ADR bullet. The `tasks` artifact from the rev.1 spec was **dropped** — the existing plans already ARE discrete stable-ID checkbox task lists mapping 1:1 to commits, so building a separate artifact would duplicate and fragment the working single-plan pattern.

## Architecture

The convention lives entirely in the **handbook** documentation layer (`docs/handbook/`), per the repo's slot-routing rule (gate > skill > rule > memory > prose). A passive reference convention is the wrong fit for a skill (skills fire on action triggers) or a rule (rules need a concrete file-scope trigger), and CLAUDE.md prose is the most expensive slot. The handbook's spec→plan pipeline section is the canonical home for "how the spec format works," so the convention is documented there and only there. The ADR records intent + reversibility per the load-bearing ADR convention.

No code. No `.claude/` surface. No CLAUDE.md prose growth. No new files — both deliverables are edits to existing files (`docs/handbook/knowledge-architecture.md`, `DECISIONS.md`).

## Tech Stack

- Markdown (handbook docs + ADR log)
- `pnpm check:doc-drift` — the only mechanical gate that touches docs (asserts the `ARCHITECTURE.md` tree matches disk); must stay green
- Mermaid is already present in the handbook section but is **not** modified (the convention is a prose addition, not a flow change)

## Global Constraints

- **Zero new `.claude/` surface.** No skills, no rules, no hooks, no settings.
- **Zero CLAUDE.md edits.** The convention is handbook-routed; CLAUDE.md gains nothing.
- **Version-neutral phrasing.** No hard-coded counts ("53 plans", "48 specs") in any new prose — use "the specs and plans directories", "plans", etc. Stale counts are a documented failure mode.
- **No new files.** Both deliverables edit existing files.
- **Append-only ADR.** The `DECISIONS.md` bullet is added to the current session group at the top; existing entries are untouched.
- **Self-demonstrating verification.** The convention is a process convention; it is validated by the fact that several specs in this program already use the `## Clarifications resolved` shape implicitly. No test harness, no build of new code.
- **No em dashes in any added prose** (repo + author convention). Use commas, parentheses, or restructure.
- **Staging discipline:** every commit uses `git add <specific files>` only — never `git add .`, `-A`, or `--all`.

---

## F1.1 — Add the `## Clarifications resolved` convention to the handbook spec→plan section

- [ ] Edit `docs/handbook/knowledge-architecture.md`. In **The spec -> plan pipeline** section (currently ending at the paragraph "A spec is the approved 'what and why'... The architect gate sits between them, mechanically."), append two short paragraphs: (1) the spec-template convention describing the `## Clarifications resolved` section, and (2) the one-sentence acknowledgement that plans already carry stable-ID checkbox tasks, so no separate `tasks` artifact is introduced. Use version-neutral phrasing throughout; no counts.

**Files:**
- `docs/handbook/knowledge-architecture.md`

**Exact prose to add** (insert immediately after the existing paragraph that ends "...The architect gate sits between them, mechanically." and before the `## The memory system` heading):

```markdown
### The `clarify` convention (spec template)

Every spec carries a `## Clarifications resolved` section: the design questions the
brainstorming interview opened and the resolution each one closed with. This names a
shape several specs already use implicitly. It makes the spec self-contained (a reader
sees what was decided and why, without replaying the interview) and gives the
architect gate an explicit list to check the plan against. The section is a short
list, one line per question, in the form `<open question> -> <resolution>`:

```markdown
## Clarifications resolved

- Should the `tasks` artifact be a separate file? -> No; plans already carry
  stable-ID checkbox tasks, so a separate artifact would duplicate them.
- Where does the convention live? -> The handbook, not a skill or rule (it is a
  passive reference convention, not an action trigger).
```

There is no separate `tasks` artifact: the plans in the plans directory already ARE
discrete, stable-ID checkbox task lists that map one-to-one to commits, so the "how"
decomposition the convention would otherwise add already exists in every plan.
```

**Notes for the implementer:**
- The inner fenced ` ```markdown ` block (the `## Clarifications resolved` example) is nested inside the outer code fence shown above. When you paste into the file, the **outer** fence is illustration only — write the heading `### The clarify convention (spec template)` and the surrounding paragraphs as live Markdown, and keep the `## Clarifications resolved` example inside its own ` ```markdown ` fence so it renders as a code sample, not as a real second-level heading in the handbook.
- Verify no em dash appears in the added text (the arrows are `->`, ASCII).
- Confirm placement is inside `## The spec -> plan pipeline`, before `## The memory system`.

**Commit:**
```
git add docs/handbook/knowledge-architecture.md
git commit -m "docs(handbook): add clarify convention to spec->plan pipeline section"
```

---

## F1.2 — Verify `check:doc-drift` stays green

- [ ] Run `pnpm check:doc-drift` and confirm it passes. This gate asserts the `ARCHITECTURE.md` tree matches disk; the handbook edit adds no files and changes no tree, so it must remain green. If the script name differs, locate it via `cat package.json | grep doc-drift` (read-only) and run the resolved script.

**Files:**
- (none — verification only)

**Commands:**
```
pnpm check:doc-drift 2>&1 | tail -20
```

**Pass criterion:** exit code 0, no drift reported. If it fails, the failure is unrelated to this change (no files added/moved) — stop and report root cause rather than editing the gate. Do **not** disable or weaken the gate.

**Commit:** none (verification step; no file change).

---

## F1.3 — Record the ADR in DECISIONS.md

- [ ] Edit `DECISIONS.md`. Append one ADR bullet to the **top-most session group** (currently `## 2026-06-18 — Ecosystem-benchmark follow-through...`) following the load-bearing ADR convention: dated bullet, mechanism (what changed, the causal why, the failure mode it addresses), and a mandatory reversibility note. If a new session group for today is more appropriate, add `## 2026-06-19 — Spec clarify convention` above the 2026-06-18 group and place the bullet under it (newest-first ordering). Use version-neutral phrasing.

**Files:**
- `DECISIONS.md`

**Exact ADR bullet to add** (newest-first; create the 2026-06-19 group heading above the existing 2026-06-18 group):

```markdown
## 2026-06-19 — Spec `clarify` convention

- **2026-06-19** · **`## Clarifications resolved` spec-template convention (handbook-routed, smallest platform-gaps unit).** Every spec now carries a `## Clarifications resolved` section listing the open design questions the brainstorming interview closed and their resolutions, in the form `<question> -> <resolution>`. Documented in `docs/handbook/knowledge-architecture.md`'s spec→plan pipeline section; several specs in this program already use the shape implicitly, so the convention names existing practice rather than adding ceremony. The failure mode it addresses: a spec that omits what the interview decided forces a reader (or the architect gate) to replay the interview to recover intent. **Deliberately scoped down from the rev.1 design:** the proposed `tasks` artifact was DROPPED because the plans in the plans directory already ARE stable-ID checkbox task lists mapping one-to-one to commits, so a separate artifact would duplicate and fragment the working single-plan pattern; and the convention was routed to the handbook rather than a `.claude/` skill or rule (a skill fires on action triggers, a rule needs a file-scope trigger, and this is a passive reference convention), adding zero `.claude/` surface and zero CLAUDE.md prose. _Reversible: revert the single `docs/handbook/knowledge-architecture.md` edit; no code, no production impact, no `.claude/` change._
```

**Notes for the implementer:**
- Match the existing bullet format exactly: `**YYYY-MM-DD** · **Title.** <mechanism> _Reversible: <undo>._`
- No em dashes in the bullet body (the `->` arrows and `·` separators are intentional ASCII/existing-convention characters).
- Newest-first: the 2026-06-19 group goes **above** the 2026-06-18 group.

**Commit:**
```
git add DECISIONS.md
git commit -m "docs(decisions): ADR for the spec clarify convention"
```

---

## Verification (worked example, self-demonstrating)

The convention is validated by application, not by a test harness. Two checks:

1. **Self-demonstration.** The driving spec for this very plan (`docs/superpowers/specs/2026-06-18-spec-artifacts-pipeline-design.md`) and several other specs in the platform-gaps program already capture clarifications implicitly (the "Dropped from rev.1" and "Failure-mode checklist" sections are clarification records in all but name). The convention names a shape already in use, so applying it to the next spec is mechanical and the worked example is the spec set itself.

2. **Gate stays green.** `pnpm check:doc-drift` passes after F1.1 (verified in F1.2). No other gate touches `docs/handbook/` or `DECISIONS.md`.

**Self-review checklist (run inline before declaring done; fix in place):**

- [ ] The added handbook prose contains **no hard-coded counts** (no "53", "48", "52", etc.).
- [ ] **No em dash** in any added text (handbook + ADR).
- [ ] The `## Clarifications resolved` example renders as a fenced code sample, not as a live `<h2>` in the handbook.
- [ ] The new prose sits inside `## The spec -> plan pipeline`, before `## The memory system`.
- [ ] Zero files created; zero `.claude/` files touched; zero CLAUDE.md edits.
- [ ] The ADR bullet ends with a `_Reversible: ..._` note and is newest-first.
- [ ] `pnpm check:doc-drift` exits 0.
- [ ] Each commit staged with `git add <specific file>` only.

---

## Out of scope (do not add)

- No `tasks` artifact, no `<plan>-tasks.md` file (dropped by design).
- No `.claude/skills/`, `.claude/rules/`, or hook.
- No CLAUDE.md edit.
- No new mechanical gate or content-validation script for the convention.
- No backfill of `## Clarifications resolved` into existing specs (the convention is forward-looking; backfill is a separate, optional task).
