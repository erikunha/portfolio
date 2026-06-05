> Status: DRAFT
> Date: 2026-06-04
> Workstream: WS7 Claude Code Architecture Refactor
> Parent: ../specs/2026-06-04-platform-mastery-program-design.md
> PR order: 5 of 8
> Delivery: standalone PR to main

# WS7: Claude Code Architecture Refactor

## Context

`CLAUDE.md` is auto-loaded at the start of every Claude Code session. At 240 lines it is not
large in absolute terms, but several of its sections are dense procedural blocks that are
rarely relevant per turn: the 10-point PR merge gate (lines 210-221, ~392 words), two
visual-baseline regen bullets inside the Working Agreement (lines 187-188, ~646 words in
that cluster), and the Copilot review loop embedded in item 8 of that same gate. These
blocks consume context budget on every session regardless of whether the current task
involves merging a PR or regenerating screenshots.

The ai-eval update flow does not currently exist in `CLAUDE.md` as an explicit procedure.
It lives across `scripts/ask-eval.ts`, `content/ask-eval-corpus.ts`, and plan docs. As WS2
and WS3 ship this flow, it will need a home. Putting it inline in `CLAUDE.md` would
continue the bloat pattern; the right move is to introduce it as a skill from the start.

**The progressive-disclosure principle:** a file loaded on every turn should contain only
the information needed on the majority of turns. Detailed procedures that are invoked
infrequently (merge flow, baseline regen, eval update) belong in on-demand skills that
Claude Code loads only when the relevant trigger fires. The `.claude/skills/fallow-audit/`
skill is the established template in this repo for exactly this pattern.

## Goal

Extract three procedural blocks from `CLAUDE.md` into project-local skills under
`.claude/skills/`. Each skill follows the fallow-audit template: YAML frontmatter with a
precise `description` that acts as the activation trigger, a header, and progressive
disclosure at under 200 lines. `CLAUDE.md` retains standing facts, high-frequency rules,
and one-line pointer stubs so the relocated rules remain discoverable. No behavioral rule
is lost; only the token cost of always loading infrequently-used procedure is eliminated.

Target: reduce `CLAUDE.md` from 240 lines to approximately 205 lines (a reduction of
roughly 35 lines, equivalent to removing about 800 words of dense procedural prose from
the always-loaded context).

## Coordination note

WS4 (PR 4 of 8, previous in sequence) edits `CLAUDE.md` gate-claim language to match
mechanically enforced reality, specifically downgrading any claim that cannot be backed by
an artifact to "convention." WS7 then extracts procedures from the WS4-corrected `CLAUDE.md`.
The implementation of WS7 must build on the post-WS4 state, not the pre-WS4 version. If
WS4 rewrites a gate item's language, WS7's stub for that item must use the WS4 wording.
This dependency is hard: do not implement WS7 while WS4 is still open.

## Extraction inventory

| CLAUDE.md section | Location (lines) | Approx. lines | Destination skill | Skill trigger description | Stub that stays in CLAUDE.md |
|---|---|---|---|---|---|
| PR merge gate (10-item numbered list) | 210-221 | 13 | `.claude/skills/pr-merge-gate/SKILL.md` | Use when about to merge a PR: running `pnpm ready-to-merge`, resolving Copilot threads, rebasing, or executing `gh pr merge`. Covers all 10 pre-merge checks including Copilot auth gate, resolve-thread requirement, rebase rule, and playwright visual check. | "See `.claude/skills/pr-merge-gate` for the full 10-point gate. Run `pnpm ready-to-merge <pr>` first; the skill details each step." |
| Visual baseline regen procedure (2 dense bullets in Working Agreement) | 187-188 | 2 (but ~600 words) | `.claude/skills/visual-baseline-regen/SKILL.md` | Use when any push touches a visual-regression baseline: deciding whether a change affects a baseline, regenerating on darwin with `--update-snapshots`, dispatching the `update_visual_baselines` CI workflow for linux, downloading artifacts, committing both platform PNGs together. | "Visual baseline regen: see `.claude/skills/visual-baseline-regen`. Trigger: any push after a CSS, layout, or rendering change." |
| ai-eval update flow (currently implicit; to be formalized in WS2/WS3) | N/A (new, no current CLAUDE.md lines) | 0 existing lines | `.claude/skills/ai-eval-update/SKILL.md` | Use when updating the ask:eval harness: adding corpus entries, running `pnpm ask:eval`, interpreting pass/fail thresholds, reading `ask:eval:latest` from Upstash KV, and updating the CI `ai-eval` job after WS2/WS3 land. | "ai-eval update flow: see `.claude/skills/ai-eval-update`. Trigger: after editing `content/ask-eval-corpus.ts`, `scripts/ask-eval.ts`, or SYSTEM_TEXT." |

Note: the Copilot review loop (item 8 inside the PR merge gate) is contained within the
pr-merge-gate extraction. No separate extraction is needed. It travels with the gate.

## Approach

1. **Author each skill following the fallow-audit template.** The template structure is:
   YAML frontmatter (`name`, `description`), a `# title` heading, one short orientation
   paragraph, then sections that expand detail progressively. Each skill must be under 200
   lines and self-contained: it must answer every question about the procedure without
   requiring the reader to cross-reference `CLAUDE.md`.

2. **Skill authoring order:** `pr-merge-gate` first (largest and highest-risk extraction),
   then `visual-baseline-regen` (medium complexity), then `ai-eval-update` (new content,
   lower risk because nothing is being removed).

3. **Apply the stub-and-pointer pattern.** For each extracted section, replace the full
   prose in `CLAUDE.md` with a one- or two-line pointer stub. The stub must name the skill
   path and state the activation condition so the rule is discoverable without loading the
   skill. The stub preserves the invariant that reading only `CLAUDE.md` gives enough
   information to know when each skill applies.

4. **Verify no rule is lost.** Before and after extraction, enumerate every behavioral rule
   from the extracted sections as a flat list. Confirm every rule appears in either the
   skill or the stub, with no omissions. This is the primary quality gate for WS7.

5. **Verify the post-WS4 baseline.** Because WS4 may reword gate items, the implementer
   must diff the current `CLAUDE.md` against its post-WS4 state (by rebasing or checking
   that WS4 is already merged) before writing stubs. A stub that quotes pre-WS4 language
   would reintroduce a corrected claim.

## Architecture

### New files

| Path | Purpose |
|---|---|
| `.claude/skills/pr-merge-gate/SKILL.md` | Full 10-point pre-merge gate procedure including Copilot auth gate, unresolved-thread check, self-resolve detection via `scripts/check-pr-comments.ts`, branch protection rule, rebase rule (with dependabot and already-reviewed exceptions), and playwright local visual check. Under 200 lines. |
| `.claude/skills/visual-baseline-regen/SKILL.md` | Full visual baseline regen procedure: how to assess baseline impact before any push, darwin regen path (`pnpm build` to prod server, `--update-snapshots`), linux regen path (`gh workflow run "CI" -f update_visual_baselines=true --ref <branch>`, artifact download, copy each project's `-linux.png`), commit discipline (both platforms in the same commit), inspect-before-commit rule. References `tests/visual/visual.spec.ts` for the list of captured sections. Under 200 lines. |
| `.claude/skills/ai-eval-update/SKILL.md` | Procedure for maintaining the ask:eval harness post-WS2/WS3: when to add corpus entries (`content/ask-eval-corpus.ts`), running `pnpm ask:eval`, interpreting the correctness and jailbreak-resistance thresholds, reading `ask:eval:latest` from Upstash KV, the judge-calibration gate added in WS3, and when to re-request CI after corpus changes. Under 200 lines. |

### Modified files

| Path | Change |
|---|---|
| `CLAUDE.md` | Replace the 13-line PR merge gate section with a 2-line stub pointer. Replace the 2 dense visual-baseline regen bullets (lines 187-188) with 2 compressed one-line triggers each pointing to the skill. Add a one-line stub for ai-eval-update in the Working Agreement near the `pnpm ask:eval` command entry. Net reduction: approximately 35 lines (from 240 to ~205). |

## Error handling / risk

The principal risk of this refactor is a relocated rule that the model no longer auto-applies
because it has moved from an always-loaded file to an opt-in skill. This risk applies to any
rule that should fire on every occurrence of a trigger, not only when the user or model
consciously invokes the skill.

Mitigation: the stub-and-pointer pattern is the primary defense. Every stub in `CLAUDE.md`
must state the activation condition explicitly and in the imperative mood. A stub that reads
"see skill for details" without naming the trigger condition fails the mitigation. A correct
stub reads "When [trigger condition], invoke `.claude/skills/<name>`: [one-line summary of
what the skill enforces]."

For the PR merge gate specifically: the 10 numbered items are procedure, not standing rules.
They are only relevant at merge time. The stub "run `pnpm ready-to-merge <pr>` and invoke
`.claude/skills/pr-merge-gate` before any `gh pr merge`" preserves discovery with zero
behavioral loss.

For the visual baseline bullets: these ARE triggered on every push, so the stub must remain
visible in the Working Agreement at the same logical position (between the auto-review bullet
and the PR template bullet). The stub must name both trigger conditions: (a) assessing
baseline impact before any push, and (b) the regen procedure when impact is confirmed. Shrinking
to one line is acceptable only if both triggers are named.

For ai-eval-update: this is new content, so there is no behavioral regression risk. The only
risk is authoring incompleteness. The skill must cover the full WS2/WS3 eval flow to be
useful; a half-written skill is worse than no skill because it creates false confidence.

## Test strategy

**Rule inventory (before/after comparison):**

Before authoring the skills, produce a flat numbered list of every behavioral rule currently
in the three source sections (PR merge gate items 1-10, visual baseline bullets, and any
implicit eval rules). After authoring, map each rule to either a skill line or a stub line.
Every rule must appear in the mapping. Any unmapped rule is a blocker.

**Skill invocability check:**

Each skill must be loadable via Claude Code's skill dispatch mechanism. Verify by invoking
each skill by name and confirming it returns coherent output that covers the procedure.

**High-frequency rule inline check:**

Rules that must fire on every turn (not just at merge or regen time) must stay in `CLAUDE.md`
inline, not in skills. The review battery dispatch rule (lines 183-185), the runtime gate rule
(line 184), and the verification-before-completion rule (line 195) are examples. Confirm these
are NOT extracted; they must remain inline.

**Line count gate:**

After editing `CLAUDE.md`, run `wc -l CLAUDE.md` and confirm the result is at or below 205.
If it is above, the stubs are not compressed enough or additional non-procedure lines should
be reviewed.

**Content completeness check on skills:**

For `pr-merge-gate`: enumerate the 10 gate items in the skill and confirm each maps 1:1 to
an item in the original CLAUDE.md section. No items may be silently dropped.

For `visual-baseline-regen`: confirm the skill covers darwin path, linux path, artifact
download step, project-specific PNG copy step, inspect-before-commit rule, and the
"batch visual tweaks to one push" cost-awareness rule.

For `ai-eval-update`: confirm the skill is internally consistent with the WS2/WS3 design
and references real paths (`scripts/ask-eval.ts`, `content/ask-eval-corpus.ts`,
`content/ask-eval-corpus.ts`, `ask:eval:latest` KV key).

## Acceptance criteria

1. `wc -l CLAUDE.md` returns at most 233 (from 240). NOTE (architect-gate correction,
   2026-06-05): the original 205 target was arithmetically unreachable — the merge-gate
   items and baseline bullets are very long SINGLE lines, so removing ~720 dense words
   only removes ~8 physical lines. The line count was a proxy; the real, achieved win is
   ~720 words of infrequently-used procedure removed from always-loaded context. Do not
   pad extractions to hit an arbitrary line number — that risks demoting an always-on
   rule (the primary WS7 risk).
2. Each of the three new `SKILL.md` files exists at the specified paths, is under 200 lines,
   and has valid YAML frontmatter with a `name` and `description` field.
3. The `description` field of each skill is a complete, accurate activation trigger that
   would cause a model to invoke the skill at the right moment.
4. Every behavioral rule from the extracted sections is accounted for in either the skill
   body or the CLAUDE.md stub. The rule inventory comparison is complete and clean.
5. `CLAUDE.md` contains a one- or two-line stub pointer for each extracted skill. Each stub
   names the skill path and the activation condition.
6. High-frequency always-applied rules (review battery, runtime gates, verification-before-
   completion, quality gate fix discipline, four-conditions-before-done) remain inline in
   `CLAUDE.md` unchanged.
7. The ai-eval-update skill is consistent with the WS2/WS3 design: it references
   `scripts/ask-eval.ts`, `content/ask-eval-corpus.ts`, the Upstash KV key `ask:eval:latest`,
   and the judge-calibration gate.
8. `pnpm ci:local` passes (this is a docs-only change; no runtime gate required).

## Out of scope

- Extracting high-frequency rules (review battery dispatch, verification-before-completion,
  quality-gate fix discipline). These fire on nearly every turn and must stay inline.
- Extracting the Working Agreement header paragraphs (commit discipline, integration branch
  model, process-feedback hard-stop). These are standing practices read frequently.
- Extracting the Stack, Performance budgets, Engineering standards, or Aesthetic constraints
  sections. These are reference facts, not procedures, and are often consulted mid-task.
- Refactoring `.claude/commands/` files. Commands are already short dispatchers and do not
  contribute to CLAUDE.md token cost.
- Any change to `.claude/hooks/`, `scripts/`, `package.json`, or test files.
- Automation of skill invocation (hookify rules, PreToolUse triggers). WS4 covers mechanical
  gate enforcement; WS7 is purely a documentation restructure.

## Risks and open questions

### Real risk: opt-in vs. always-applied

The most dangerous class of extraction is moving a rule that should always apply to a skill
that only applies when consciously invoked. The visual baseline regen bullets are borderline:
they are procedural enough to extract, but the pre-push assessment trigger (does this push
affect any baseline?) must remain as a prompt inline or in the stub. The mitigation is to
keep the inline stub as a two-line trigger, not just a pointer.

**Safe to extract (procedure, fired at a discrete event):**
- PR merge gate: invoked only at merge time, not on every turn.
- Linux baseline regen steps: invoked only when a baseline change is confirmed.
- ai-eval harness maintenance: invoked only when eval corpus or harness changes.

**Must stay inline (standing rule, applies to every turn in its context):**
- Review battery dispatch before every push.
- Runtime gate requirement before every non-docs push.
- Verification-before-completion before any done claim.
- Quality gate fix discipline (never suppress, fix the property).
- Four-conditions-before-done.
- Process feedback is a hard stop.

**Borderline (needs care in stub wording):**
- "Decide baseline impact BEFORE every push" (line 188 CLAUDE.md): the decision-point trigger
  must stay inline as a one-line rule; only the full procedure for when the answer is YES
  belongs in the skill.

### Open question: WS4 gate language — RESOLVED (2026-06-05)

WS4 (#94) is merged. The pr-merge-gate skill was authored against the post-WS4 CLAUDE.md
(quoting current text by content, not pre-WS4 wording or line numbers). All 10 gate items
survived WS4 intact, so the skill maps 1:1 to the current section.

### Open question: ai-eval-update skill timing

RESOLVED (2026-06-05): WS2 (#91) and WS3 (#95) are merged. The ai-eval-update skill is
fully authored against current main — no skeleton, no `TODO: expand` comment. It documents
the live calibration gate, the correctness/jailbreak/calibration thresholds, the
`ask:eval:latest` KV key, and the corpus + gold-set files as they exist on main.
