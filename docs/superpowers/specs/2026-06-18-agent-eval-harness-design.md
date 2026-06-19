# Agent/Prompt Eval Harness (Unit C) — Design Spec

- **Date:** 2026-06-18
- **Status:** Draft — pending architect-reviewer gate
- **Branch:** `feat/platform-gaps-2026-agent-eval` (sub-PR into `feat/platform-gaps-2026`)
- **Author:** Erik Cunha

## 1. Context & goal

Benchmark keystone (score 42, but the *enabling* unit): the platform evals its **product** (`/api/ask` via `ask:eval`) but not its **own** agent/skill/CLAUDE.md prompts. A reference system should A/B-test its conventions, not defend them on principle. This harness is what turns "Semgrep helps" / "this rule is load-bearing" from assertion into measurement — it makes Units B, D, E and every future CLAUDE.md change empirically checkable.

### Goal

A Monte-Carlo prompt-regression harness (the **wshobson `plugin-eval` pattern**, adapted to this repo) that runs a prompt/agent/skill against a gold set N times, grades each run, and reports pass-rate + variance — supporting control-vs-treatment A/B (does a change move the success rate?).

### Decision (user-approved)

Foundation = **wshobson `plugin-eval` pattern** (Monte-Carlo over agent prompts, tiered model assignment, prompt-regression harness), borrowed and adapted — not `@vercel/agent-eval`, not a from-scratch build. Reuse the repo's existing `ask:eval` scaffolding (runner, Redis result publication) where it transfers.

## 2. Components

1. **`evals/agents/` corpus.** Per-case directories: a `PROMPT.md` (the task), the target prompt/agent/skill under test, and graders. ~20 cases seeded from real session transcripts (representative review, refactor, architect-gate, and convention-application tasks).
2. **Runner — `pnpm eval:agents`.** Runs each case N times (Monte-Carlo, N bounded for cost), with tiered model assignment (cheap model for mechanical cases, stronger for judgment). Aggregates pass@k and pass^k (consistency) and variance.
3. **Graders.** Cost-tiered: code-based assertions first (cheap, deterministic), then a single LLM-judge call returning `0.0–1.0 + pass/fail` (the Anthropic-aligned shape). Humans reserved for hallucination/bias spot-checks.
4. **A/B mode.** Run control vs treatment (e.g., a CLAUDE.md rule present vs pruned) and report the success-rate delta with variance — the mechanism behind "is this rule load-bearing."
5. **Result publication.** Write `agent-eval:latest` alongside the existing `ask:eval:latest` pattern (Redis when env present); always write a local `agent-eval-result.json`.
6. **CI.** Optional manual/scheduled job initially (cost-bounded), non-blocking. Not in the per-push gate.

## 3. Relationship to existing harnesses

- **Distinct from `ask:eval`** — that evals the product persona/answer quality; this evals the *platform's* prompts (agents, skills, CLAUDE.md rules). Shares runner scaffolding, not corpus.
- Once live, Unit D's vetted agents and any CLAUDE.md change get a regression case here.

## 4. Failure-mode checklist (thinking-inversion)

| Failure mode | Mitigation |
|---|---|
| LLM-judge flakiness | Calibration set; single multi-criteria judge call; report variance not point estimate |
| Cost blowup (N runs × cases × model) | Bound N; tiered model assignment; manual/scheduled CI not per-push |
| Gold-set staleness | Seed from real transcripts; review quarterly; cases versioned in-repo |
| Saturation at ~100% (eval stops discriminating) | Track saturation; retire/replace solved cases |
| Non-determinism misread as regression | Variance reporting + pass^k for consistency-critical prompts |
| Harness evaluates a moving target (prompt + model both change) | Pin model per eval job; record model id in results |

## 5. Testing (TDD)

- A trivial deterministic case (code-based grader) passes 100% across N runs.
- The judge calibration case scores a known-good and known-bad output correctly.
- A/B mode reports a non-zero delta on a deliberately weakened treatment prompt.
- Variance computed correctly across N runs.

## 6. Verification before completion

`pnpm eval:agents` runs the seed corpus, writes `agent-eval-result.json`, and an A/B run distinguishes a deliberately-degraded prompt from the baseline.

## 7. Reversibility

Remove `evals/agents/` + the `eval:agents` script + the Redis key. No production impact. ADR records the undo.

## 8. Status / next steps

Draft → architect-reviewer gate → writing-plans → implementation (held; planning phase). This unit unblocks empirical validation of B, D, E.
