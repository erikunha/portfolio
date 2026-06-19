# Spec `clarify` Convention (Unit F) — Design Spec

- **Date:** 2026-06-18 (rev. 2026-06-19 — addresses architect-reviewer FAIL)
- **Status:** Draft (rev.2) — pending architect-reviewer re-gate
- **Branch:** `feat/platform-gaps-2026-spec-clarify` (sub-PR into `feat/platform-gaps-2026`)
- **Author:** Erik Cunha

## 1. Context & goal

Benchmark gap (score 27) — but the architect-review found it is **even more closed than the rev.1 spec assumed**. The repo's specs and plans directories already exist with the architect-gate mechanically between them, and the **plans already ARE discrete stable-ID checkbox task lists** mapping 1:1 to commits (verified: `C1.1`–`C1.5`, `Task 1.1`–`1.4`, `CG0`, all `- [ ]`). So the proposed `tasks` artifact **already exists** — building it would duplicate and risk fragmenting the working single-plan pattern.

### Goal (shrunk per via-negativa)

The ONLY genuinely-new piece: formalize a **`clarify` convention** — a `## Clarifications resolved` section in the spec template capturing what the brainstorming interview closed (the open questions + their resolutions). Documented in the handbook. Nothing else.

### Dropped from rev.1 (architect-required)

- **`tasks` artifact — DROPPED.** The existing plans already carry stable-ID checkbox tasks mapping 1:1 to commits. No new artifact; at most one handbook sentence acknowledging this.
- **`.claude/rules/` and `.claude/skills/` surface — DROPPED.** A skill is the wrong slot for a passive reference convention (skills fire on action triggers); a rule needs a concrete trigger. Handbook + ADR only; zero new `.claude/` surface.

## 2. The single component

A `## Clarifications resolved` template section in the spec format: a short list of the design questions the brainstorming interview closed and their resolutions (already implicitly present in recent specs — this names it). Documented in `docs/handbook/knowledge-architecture.md`'s spec→plan pipeline section, plus a one-sentence note there that plans already carry stable-ID checkbox tasks (so no `tasks` artifact is needed).

## 3. Wiring

- Edit `docs/handbook/knowledge-architecture.md`: add the `clarify` convention to the spec→plan section; add the one-sentence existing-tasks acknowledgement.
- ADR records the convention + reversibility.
- **No** new `.claude/` files, **no** CLAUDE.md prose growth (slot-routing: handbook is the correct slot).
- Use version-neutral phrasing ("the specs and plans directories") rather than stale counts.

## 4. Failure-mode checklist (thinking-inversion)

| Failure mode | Mitigation |
|---|---|
| Re-specifying what 53 plans already do (`tasks`) | Dropped entirely; one acknowledging sentence only |
| Fragmenting the single-plan pattern with `<plan>-tasks.md` | Not introduced; no separate file |
| Ceremony creep | Reduced to one optional template section + one handbook edit |
| CLAUDE.md bloat | Routed to handbook; zero always-on prose; zero new `.claude/` surface |
| Stale counts in docs | Version-neutral phrasing |

## 5. Testing & verification

Process convention — validated by applying the `## Clarifications resolved` section to the next real spec (several specs in THIS program already use it implicitly, so it is self-demonstrating). `check:doc-drift` stays green.

## 6. Reversibility

Revert the single handbook edit. No code, no production impact, no `.claude/` change. ADR records the undo.

## 7. Status / next steps

Draft rev.2 → architect-reviewer re-gate → writing-plans (smallest plan in the program) → implementation (held).
