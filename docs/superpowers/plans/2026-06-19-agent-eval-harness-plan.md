# Agent/Prompt Eval Harness Implementation Plan

> Written for an agentic worker (Claude Code or equivalent) executing tasks sequentially with review checkpoints. Each task is bite-sized, test-first, and ends in a single scoped commit. No task depends on a later task. Stop at any `CHECKPOINT` and wait for human review.

- **Spec:** `docs/superpowers/specs/2026-06-18-agent-eval-harness-design.md`
- **Date:** 2026-06-19
- **Unit:** C (Agent/Prompt Eval Harness) — the platform-self-eval keystone
- **Integration branch:** `feat/platform-gaps-2026-agent-eval` (off `main`)
- **Sub-PRs:** `feat/platform-gaps-2026-agent-eval-{core,runner,ab,ci}` → integration branch

## Goal

Build a Monte-Carlo prompt-regression harness that runs a platform prompt/agent/skill against a ~20-case gold corpus N times, grades each run (code assertions first, then a single calibrated LLM-judge call), and reports pass@k / pass^k / variance — with a control-vs-treatment A/B mode that quantifies whether a prompt change moves the success rate. This makes "is this CLAUDE.md rule load-bearing" a measurement, not an assertion. It evals the **platform's own prompts**, distinct from `ask:eval` which evals the **product** (`/api/ask`).

## Architecture

Four sharded workstreams, each its own sub-PR into the integration branch. Dependency order is strict: C-a → C-b → {C-c, C-d}.

```
                 scripts/ask-eval.ts (existing, 868 lines)
                              │  extract shared core (no behavior change)
                              ▼
   C-a  lib/eval/  ── judge.ts · percentile.ts · cost.ts · redis-publish.ts · types.ts
        evals/agents/<case>/  ── CASE.ts (PROMPT.md task + target ref + assertions)
        scripts/ask-eval.ts re-points at lib/eval/ ; pnpm ask:eval re-run = no regression
                              │
                              ▼
   C-b  scripts/agent-eval.ts  ── pnpm eval:agents
        runCalibration() FIRST (MIN_CALIBRATION_AGREEMENT=0.85) → corpus N runs
        Monte-Carlo aggregation: pass@k, pass^k, mean, variance, stddev
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
   C-c  A/B mode (--ab)              C-d  CI job (manual/scheduled, non-blocking)
        control vs treatment              Redis `agent-eval:latest`
        success-rate delta + variance     local agent-eval-result.json
```

**Why a shared `lib/eval/` core (C-a) before everything else:** the judge call, percentile math, cost model, and Redis-publish helper already exist *inside* `scripts/ask-eval.ts`. Re-implementing them in `agent-eval.ts` would create two judge prompts that drift apart — the exact failure the spec's "no JUDGE_SYSTEM duplication" invariant forbids. Extracting first means both harnesses share one calibrated judge. `scripts/ask-eval.ts` is on the CI `ai-eval` path (security-sensitive: it imports the real `/api/ask` route), so C-a's acceptance bar is "extract with zero behavior change, proven by re-running `pnpm ask:eval` and diffing the result shape."

## Tech Stack

- **Runtime:** `tsx` via `TSX_TSCONFIG_PATH` (mirror `ask:eval`'s `scripts/tsconfig.eval.json` server-only aliasing).
- **Judge / target invocation:** Vercel AI Gateway via `ai` SDK `generateText` (`AI_GATEWAY_API_KEY`). Same Gateway as `ask:eval`.
- **Models (tiered):** mechanical cases → `anthropic/claude-haiku-4-5`; judgment cases → `anthropic/claude-sonnet-4-6`. Judge → `anthropic/claude-sonnet-4-6` (must be ≥ the model it grades).
- **Content validation:** Zod at module load (mirror `content/ask-eval-calibration.ts`).
- **Tests:** Vitest structural + unit tests under `__tests__/` and `lib/eval/__tests__/`. Behavioral, no source-grep.
- **Publication:** Upstash Redis (`@upstash/redis`, env-gated) + local `agent-eval-result.json`.
- **CI:** GitHub Actions job in `.github/workflows/ci.yml`, `workflow_dispatch` + `schedule` only, non-blocking.

## Global Constraints

- **TDD, always.** Write the failing test first, watch it fail, then implement. No implementation commit without a preceding (or same-commit) test that exercised it red→green.
- **Cost ceiling — hard budget.** `N ≤ 5` runs per case. Corpus ≤ 20 cases. Per non-A/B job dollar cap: **`MAX_JOB_COST_USD = 2.00`** (sonnet judge at ~$3/$15 per MTok, haiku targets at ~$1/$5; 20 cases × 5 runs × (target + judge) ≈ $0.40–0.90 typical, $2.00 is the hard ceiling with margin). The runner **estimates cost before running** and **aborts if the projected cost exceeds the cap** (borrow `ask-eval.ts`'s `PRICING_USD_PER_MTOK` + estimate pattern). **A/B mode doubles the run** (control + treatment) so its effective cap is tracked as `2 × MAX_JOB_COST_USD = 4.00`; the estimate must account for both arms.
- **Calibration is a first-class gate, not optional.** `runCalibration()` runs **before** the corpus, mirroring `ask-eval.ts`: `MIN_CALIBRATION_AGREEMENT = 0.85`, `CALIBRATION_ERROR_FRACTION_LIMIT = 0.5`. A drifted judge fails the run before spending corpus tokens. Reuse the *extracted* `judge()` so the two harnesses share one judge prompt.
- **Distinct from `ask:eval`.** Different corpus (`evals/agents/`, not `content/ask-eval-corpus.ts`), different Redis key (`agent-eval:latest`), different result file (`agent-eval-result.json`), different script (`scripts/agent-eval.ts`). Shared *scaffolding* (`lib/eval/`), never shared *corpus*.
- **Gold set discipline.** ~20 cases seeded from real session transcripts, each with a human-verified `expected` outcome. **At least one deliberately-hard / known-failing case** so the eval does not saturate at 100% and stop discriminating.
- **Non-blocking CI.** Manual/scheduled only. Never in the per-push gate. Never on the `ai-eval` blocking path.
- **Commits:** one logical unit per commit. `git add <specific files>` only — never `git add .`/`-A`/`--all`. Conventional-commit scope required (`feat(eval)`, `refactor(eval)`, `test(eval)`, `ci(eval)`).
- **No behavior change to `ask:eval` in C-a.** The extraction is a pure refactor. `pnpm ask:eval` output shape must be byte-identical in structure (the `Aggregate` JSON keys); prove it.
- **Reversibility:** removing `evals/agents/` + `scripts/agent-eval.ts` + the `eval:agents` script + the Redis key fully reverts the unit. `lib/eval/` stays (it is now a dependency of `ask:eval`). Record in DECISIONS.md.

---

# Sub-PR C-a — Shared eval core + corpus schema

Goal: extract `lib/eval/` from `scripts/ask-eval.ts` with zero behavior change, and define the `evals/agents/` corpus schema + first cases. End state: `pnpm ask:eval` runs through the extracted core and produces a structurally identical result; the agent corpus loads and Zod-validates.

Branch: `feat/platform-gaps-2026-agent-eval-core`

## C-a.1 — Create `lib/eval/types.ts` with shared result/judge types

- [ ] Write `lib/eval/__tests__/types.test.ts` asserting the exported Zod schemas parse a valid sample and reject an invalid one (e.g. `agreement` out of `[0,1]`).
- [ ] Watch it fail (module does not exist).
- [ ] Implement `lib/eval/types.ts`.

**Files:** `lib/eval/types.ts`, `lib/eval/__tests__/types.test.ts`

**Interfaces:**
```ts
// lib/eval/types.ts
import { z } from 'zod';

export type JudgeVerdict = {
  pass: boolean;
  reason: string;
  inputTokens: number;
  outputTokens: number;
};

export const CalibrationCaseSchema = z.object({
  id: z.string().min(1),
  humanVerdict: z.boolean(),
  judgeVerdict: z.boolean(),
  agreed: z.boolean(),
  errored: z.boolean(),
  reason: z.string(),
});
export type CalibrationCase = z.infer<typeof CalibrationCaseSchema>;

export const CalibrationResultSchema = z.object({
  cases: z.array(CalibrationCaseSchema),
  total: z.number().int().nonnegative(),
  agreed: z.number().int().nonnegative(),
  agreement: z.number().min(0).max(1),
  errored: z.number().int().nonnegative(),
  passed: z.boolean(),
  judgeInputTokens: z.number().int().nonnegative(),
  judgeOutputTokens: z.number().int().nonnegative(),
});
export type CalibrationResult = z.infer<typeof CalibrationResultSchema>;
```

**Commit:** `git add lib/eval/types.ts lib/eval/__tests__/types.test.ts` → `feat(eval): shared eval result + judge types`

## C-a.2 — Extract `judge()` into `lib/eval/judge.ts`

- [ ] Write `lib/eval/__tests__/judge.test.ts`: mock the `ai` SDK `generateText`, assert (a) bare-JSON verdict parses to `{pass,reason}`; (b) prose-wrapped JSON is extracted via the first `{...}` span; (c) no-JSON response → `{pass:false, reason:'judge returned no JSON'}`; (d) thrown error after retries → `pass:false` with the retry-exhaustion reason prefix; (e) token usage passes through.
- [ ] Watch fail.
- [ ] Move `JUDGE_SYSTEM`, `judge()`, `MAX_JUDGE_RETRIES` verbatim from `scripts/ask-eval.ts` into `lib/eval/judge.ts`. Parameterize the judge model (`judge(item, answer, { model })`) so both harnesses pass their own model. Keep the retry + backoff + JSON-extraction logic identical.

**Files:** `lib/eval/judge.ts`, `lib/eval/__tests__/judge.test.ts`

**Interfaces:**
```ts
// lib/eval/judge.ts
export const JUDGE_SYSTEM: string; // moved verbatim from ask-eval.ts
export const MAX_JUDGE_RETRIES = 2;

export type JudgeItem = { id: string; question: string; kind: string; expect: string };

export async function judge(
  item: JudgeItem,
  answer: string,
  opts: { model: string },
): Promise<JudgeVerdict>;
```

**Commit:** `git add lib/eval/judge.ts lib/eval/__tests__/judge.test.ts` → `refactor(eval): extract judge() into lib/eval/judge`

## C-a.3 — Extract `percentile()` into `lib/eval/percentile.ts`

- [ ] Write `lib/eval/__tests__/percentile.test.ts`: empty array → 0; single element → that element; nearest-rank p50/p95 on a known 10-element array returns the exact observed sample (assert the documented nearest-rank, NOT interpolated, behavior).
- [ ] Watch fail.
- [ ] Move `percentile()` verbatim from `scripts/ask-eval.ts`.

**Files:** `lib/eval/percentile.ts`, `lib/eval/__tests__/percentile.test.ts`

**Interfaces:** `export function percentile(sorted: number[], p: number): number;`

**Commit:** `git add lib/eval/percentile.ts lib/eval/__tests__/percentile.test.ts` → `refactor(eval): extract percentile() into lib/eval/percentile`

## C-a.4 — Extract cost model into `lib/eval/cost.ts`

- [ ] Write `lib/eval/__tests__/cost.test.ts`: `judgeCostUsdFrom(1_000_000, 1_000_000)` for sonnet pricing returns `3.0 + 15.0 = 18.0`; a zero-token call returns 0; assert `PRICING_USD_PER_MTOK` shape.
- [ ] Watch fail.
- [ ] Move `PRICING_USD_PER_MTOK`, `judgeCostUsdFrom`, `APPROX_FEATURE_*` into `lib/eval/cost.ts`. Add `estimateJobCostUsd({ cases, runs, judgeInOut, targetInOut })` that returns a *projected* pre-run cost — the new helper C-b's cap check consumes.

**Files:** `lib/eval/cost.ts`, `lib/eval/__tests__/cost.test.ts`

**Interfaces:**
```ts
// lib/eval/cost.ts
export const PRICING_USD_PER_MTOK: {
  feature: { input: number; output: number };
  judge: { input: number; output: number };
};
export function judgeCostUsdFrom(inputTokens: number, outputTokens: number): number;
export function estimateJobCostUsd(args: {
  cases: number;
  runs: number;
  approxTargetInputTokens: number;
  approxTargetOutputTokens: number;
  approxJudgeInputTokens: number;
  approxJudgeOutputTokens: number;
}): number;
```

**Commit:** `git add lib/eval/cost.ts lib/eval/__tests__/cost.test.ts` → `refactor(eval): extract cost model into lib/eval/cost`

## C-a.5 — Extract Redis-publish helper into `lib/eval/redis-publish.ts`

- [ ] Write `lib/eval/__tests__/redis-publish.test.ts`: with env unset → returns `{ published: false }` and never calls Redis; with both env vars set → calls `getRedis().set(key, json)` once (mock `getRedis`); a Redis throw is caught and returns `{ published: false, error }` (non-fatal).
- [ ] Watch fail.
- [ ] Extract the env-gated publish block from `scripts/ask-eval.ts` into `publishAggregate(key, aggregate)`. Preserve the both-credentials guard and the try/catch non-fatal semantics exactly.

**Files:** `lib/eval/redis-publish.ts`, `lib/eval/__tests__/redis-publish.test.ts`

**Interfaces:**
```ts
// lib/eval/redis-publish.ts
export async function publishAggregate(
  key: string,
  aggregate: unknown,
): Promise<{ published: boolean; error?: string }>;
```

**Commit:** `git add lib/eval/redis-publish.ts lib/eval/__tests__/redis-publish.test.ts` → `refactor(eval): extract Redis-publish helper into lib/eval/redis-publish`

## C-a.6 — Re-point `scripts/ask-eval.ts` at `lib/eval/` (no behavior change)

- [ ] Replace the in-file `judge`, `percentile`, `PRICING_USD_PER_MTOK`, `judgeCostUsdFrom`, `JUDGE_SYSTEM`, `MAX_JUDGE_RETRIES`, and the Redis-publish block with imports from `lib/eval/`. Pass `JUDGE_MODEL` explicitly to `judge(item, answer, { model: JUDGE_MODEL })`. `runCalibration()` stays in `ask-eval.ts` but now calls the imported `judge`.
- [ ] Run `pnpm typecheck` — must pass.
- [ ] Run `pnpm test --run __tests__/ask-eval-corpus.test.ts __tests__/ask-eval-calibration.test.ts lib/eval` — all green.
- [ ] **Behavioral proof of no regression:** run `pnpm ask:eval` with `AI_GATEWAY_API_KEY` set on a throwaway branch (or, if no key locally, assert the result-JSON *shape* via a new unit test that imports the `Aggregate` type and checks key parity against a committed `ask-eval-result.json` fixture). Cite the before/after `Aggregate` key set in the commit body — they must be identical.

**Files:** `scripts/ask-eval.ts`

**Interfaces:** no public-interface change. Imports added; ~180 lines removed from the script.

**Commit:** `git add scripts/ask-eval.ts` → `refactor(eval): re-point ask-eval at shared lib/eval core`

> **CHECKPOINT C-a-mid** — `ask:eval` is now on the shared core. Confirm no behavior change before building the new corpus on top.

## C-a.7 — Define `evals/agents/` corpus schema

- [ ] Write `evals/agents/__tests__/corpus-schema.test.ts`: the `AgentEvalCaseSchema` parses a valid case and rejects (a) empty `prompt`; (b) `kind` outside the enum; (c) a code-assertion case missing `assert`.
- [ ] Watch fail.
- [ ] Implement `evals/agents/schema.ts` defining a single case shape. Each case is a directory `evals/agents/<id>/` containing `CASE.ts` (default-exporting the validated case) and `PROMPT.md` (the human-readable task). The schema models: `id`, `prompt` (or a path to `PROMPT.md`), `target` (which platform prompt/agent/skill is under test, as a string descriptor + optional system text), `tier` (`mechanical | judgment` → model assignment), `grader` (`code | judge`), an optional `assert` (a pure `(output: string) => boolean` for code graders), `expect` (judge criterion), and a `knownHard` boolean flag.

**Files:** `evals/agents/schema.ts`, `evals/agents/__tests__/corpus-schema.test.ts`

**Interfaces:**
```ts
// evals/agents/schema.ts
import { z } from 'zod';

export const AgentEvalCaseSchema = z.object({
  id: z.string().min(1),
  prompt: z.string().min(1),              // the task given to the target prompt
  target: z.object({
    name: z.string().min(1),              // e.g. 'CLAUDE.md:no-broad-git-add'
    systemText: z.string().min(1),        // the prompt/rule under test
  }),
  tier: z.enum(['mechanical', 'judgment']),
  grader: z.enum(['code', 'judge']),
  expect: z.string().min(1),              // judge criterion OR assertion description
  knownHard: z.boolean().default(false),  // deliberately-hard / known-failing
});
export type AgentEvalCase = z.infer<typeof AgentEvalCaseSchema>;

// Code-grader assertion lives next to the case (not serializable into Zod):
export type CodeAssertion = (output: string) => boolean;
```

**Commit:** `git add evals/agents/schema.ts evals/agents/__tests__/corpus-schema.test.ts` → `feat(eval): agent-eval corpus case schema`

## C-a.8 — Seed first 3 cases incl. one trivial-deterministic + one known-hard

- [ ] Write `evals/agents/__tests__/corpus.test.ts`: the aggregated corpus (loader from C-a.9 stubbed or all three `CASE.ts` imported) — every `id` unique; ≥1 `grader:'code'` case; ≥1 `knownHard:true` case; ≥1 `tier:'mechanical'` and ≥1 `tier:'judgment'`.
- [ ] Watch fail.
- [ ] Create three case dirs:
  - `evals/agents/git-add-scoping/` — **trivial deterministic, code grader.** Task: "stage your changes." `assert`: output does NOT contain `git add .`, `git add -A`, or `git add --all`. This is the case that must pass 100% across N runs (spec §5).
  - `evals/agents/architect-gate-respect/` — **judgment, judge grader.** Task seeded from a real transcript where the agent must dispatch `architect-reviewer` before `writing-plans`. `expect`: identifies the gate and does not skip it.
  - `evals/agents/rule-pruning-knownhard/` — **knownHard:true, judge grader.** A deliberately ambiguous CLAUDE.md-rule-application case the current platform prompt is known to get wrong sometimes (anti-saturation, spec §4).
  - Each dir gets a `PROMPT.md` (the task verbatim) and a `CASE.ts` default-exporting the Zod-validated case + (for code cases) its `assert`.

**Files:** `evals/agents/git-add-scoping/{PROMPT.md,CASE.ts}`, `evals/agents/architect-gate-respect/{PROMPT.md,CASE.ts}`, `evals/agents/rule-pruning-knownhard/{PROMPT.md,CASE.ts}`, `evals/agents/__tests__/corpus.test.ts`

**Commit:** `git add evals/agents/git-add-scoping evals/agents/architect-gate-respect evals/agents/rule-pruning-knownhard evals/agents/__tests__/corpus.test.ts` → `feat(eval): seed first 3 agent-eval cases`

## C-a.9 — Corpus loader

- [ ] Write `evals/agents/__tests__/load.test.ts`: `loadCases()` returns ≥3 cases, all Zod-valid, each carrying its `assert` for code graders and its source dir.
- [ ] Watch fail.
- [ ] Implement `evals/agents/load.ts` — globs `evals/agents/*/CASE.ts`, validates each against `AgentEvalCaseSchema`, returns the array. Pure, no I/O beyond dynamic import.

**Files:** `evals/agents/load.ts`, `evals/agents/__tests__/load.test.ts`

**Interfaces:** `export async function loadCases(): Promise<LoadedCase[]>;` where `LoadedCase = AgentEvalCase & { dir: string; assert?: CodeAssertion }`.

**Commit:** `git add evals/agents/load.ts evals/agents/__tests__/load.test.ts` → `feat(eval): agent-eval corpus loader`

> **CHECKPOINT C-a** — Open sub-PR `…-core` → integration branch. Run the 5-agent review battery (security-auditor REQUIRED — this touched the `ai-eval` path). Confirm `pnpm ask:eval` regression-free before C-b.

---

# Sub-PR C-b — Monte-Carlo runner + calibration gate

Goal: `pnpm eval:agents` runs the corpus N times, grades each run (code first, then calibrated judge), and aggregates pass@k / pass^k / variance. Calibration runs FIRST and gates the run. Cost ceiling enforced before any model call.

Branch: `feat/platform-gaps-2026-agent-eval-runner`

## C-b.1 — Monte-Carlo aggregation math

- [ ] Write `lib/eval/__tests__/montecarlo.test.ts`: for per-case run-results `[true,true,true,false,true]` (N=5): `passAtK` (≥1 pass) = 1.0; `passHatK` (all pass) = 0.0; `mean` = 0.8; `variance` and `stddev` match hand-computed values; an all-true case → variance 0; an all-false case → passAtK 0.
- [ ] Watch fail.
- [ ] Implement `lib/eval/montecarlo.ts`.

**Files:** `lib/eval/montecarlo.ts`, `lib/eval/__tests__/montecarlo.test.ts`

**Interfaces:**
```ts
// lib/eval/montecarlo.ts
export type CaseStats = {
  id: string;
  runs: number;
  passes: number;
  passAtK: number;   // P(>=1 pass) — discrimination
  passHatK: number;  // P(all pass) — consistency
  mean: number;
  variance: number;
  stddev: number;
};
export function aggregateCase(id: string, runResults: boolean[]): CaseStats;
```

**Commit:** `git add lib/eval/montecarlo.ts lib/eval/__tests__/montecarlo.test.ts` → `feat(eval): Monte-Carlo pass@k/pass^k/variance aggregation`

## C-b.2 — Agent-eval calibration gold set + schema

- [ ] Write `evals/agents/__tests__/calibration.test.ts` (mirror `__tests__/ask-eval-calibration.test.ts`): the gold set Zod-parses; ≥6 cases; ≥1 positive AND ≥1 negative (`humanVerdict` both true and false present); every id unique.
- [ ] Watch fail.
- [ ] Implement `evals/agents/calibration.ts` — a `AgentEvalCalibration` array (same shape as `content/ask-eval-calibration.ts`: `id`, `prompt`, `expect`, `canonicalAnswer`, `humanVerdict`) with deliberately-borderline platform-prompt-grading gold cases (e.g. a near-correct architect-gate answer that should still PASS, and a plausible-but-wrong one that must FAIL).

**Files:** `evals/agents/calibration.ts`, `evals/agents/__tests__/calibration.test.ts`

**Commit:** `git add evals/agents/calibration.ts evals/agents/__tests__/calibration.test.ts` → `feat(eval): agent-eval judge calibration gold set`

## C-b.3 — Calibration runner (reuses extracted `judge`)

- [ ] Write `lib/eval/__tests__/calibration-runner.test.ts`: mock `judge` to return verdicts matching/mismatching the gold labels; assert `agreement` = agreed/total; a judge ERROR (reason starts `judge errored after` or `judge returned no JSON`) counts as both a disagreement AND `errored`; `passed` = `agreement >= 0.85 && errorFraction <= 0.5`; an outage (errorFraction > 0.5) → `passed:false` with the outage distinguishable.
- [ ] Watch fail.
- [ ] Implement `lib/eval/calibration.ts` — a `runCalibration(goldSet, { model })` generalized from `ask-eval.ts`'s `runCalibration()`, importing the shared `judge`. Export `MIN_CALIBRATION_AGREEMENT = 0.85` and `CALIBRATION_ERROR_FRACTION_LIMIT = 0.5` as named constants.

**Files:** `lib/eval/calibration.ts`, `lib/eval/__tests__/calibration-runner.test.ts`

**Interfaces:**
```ts
// lib/eval/calibration.ts
export const MIN_CALIBRATION_AGREEMENT = 0.85;
export const CALIBRATION_ERROR_FRACTION_LIMIT = 0.5;
export async function runCalibration(
  goldSet: Array<{ id: string; prompt: string; expect: string; canonicalAnswer: string; humanVerdict: boolean }>,
  opts: { model: string },
): Promise<CalibrationResult>;
```

**Commit:** `git add lib/eval/calibration.ts lib/eval/__tests__/calibration-runner.test.ts` → `feat(eval): shared calibration runner`

> **Note:** C-b.3 generalizes the calibration logic but does NOT yet re-point `ask-eval.ts`'s own `runCalibration()` at it — that is deferred to avoid a second behavior-touching change on the `ai-eval` path inside the runner sub-PR. A follow-up task (post-merge or a small `…-core` addendum) can unify them; the shared `judge` already guarantees one judge prompt, which is the load-bearing invariant.

## C-b.4 — Target invocation (run a prompt under test once)

- [ ] Write `lib/eval/__tests__/run-target.test.ts`: mock `generateText`; `runTarget(case, { model })` composes `systemText` + `prompt`, calls the SDK once, returns `{ output, inputTokens, outputTokens }`; a thrown SDK error surfaces as `{ errored: true, detail }` (never silently passes).
- [ ] Watch fail.
- [ ] Implement `lib/eval/run-target.ts` — tiered model already resolved by the caller (`mechanical`→haiku, `judgment`→sonnet). One `generateText` call per run.

**Files:** `lib/eval/run-target.ts`, `lib/eval/__tests__/run-target.test.ts`

**Interfaces:**
```ts
export async function runTarget(
  c: { prompt: string; target: { systemText: string } },
  opts: { model: string },
): Promise<{ output: string; inputTokens: number; outputTokens: number; errored: boolean; detail?: string }>;
```

**Commit:** `git add lib/eval/run-target.ts lib/eval/__tests__/run-target.test.ts` → `feat(eval): single-run target prompt invocation`

## C-b.5 — Grading dispatch (code-first, then judge)

- [ ] Write `lib/eval/__tests__/grade.test.ts`: a `grader:'code'` case calls `assert(output)` and never invokes the judge (mock both, assert judge call count 0); a `grader:'judge'` case calls the shared `judge`; a code case with no `assert` → throws a clear config error.
- [ ] Watch fail.
- [ ] Implement `lib/eval/grade.ts` — dispatches on `case.grader`. Code path is deterministic and free; judge path uses the shared `judge` with the tiered judge model.

**Files:** `lib/eval/grade.ts`, `lib/eval/__tests__/grade.test.ts`

**Interfaces:** `export async function gradeRun(c: LoadedCase, output: string, opts: { judgeModel: string }): Promise<JudgeVerdict>;`

**Commit:** `git add lib/eval/grade.ts lib/eval/__tests__/grade.test.ts` → `feat(eval): code-first / judge-fallback grading dispatch`

## C-b.6 — Cost-ceiling pre-flight check

- [ ] Write `lib/eval/__tests__/cost-ceiling.test.ts`: `assertWithinBudget` with a projected cost under `MAX_JOB_COST_USD` returns ok; over the cap throws/returns a budget-exceeded error naming the projection and the cap; A/B mode (`doubled:true`) uses `2 × MAX_JOB_COST_USD`.
- [ ] Watch fail.
- [ ] Implement `lib/eval/budget.ts` — `export const MAX_JOB_COST_USD = 2.0;` + `assertWithinBudget({ projectedUsd, doubled })`. The runner calls this AFTER computing `estimateJobCostUsd` and BEFORE the first model call.

**Files:** `lib/eval/budget.ts`, `lib/eval/__tests__/cost-ceiling.test.ts`

**Interfaces:**
```ts
export const MAX_JOB_COST_USD = 2.0;
export function assertWithinBudget(args: { projectedUsd: number; doubled: boolean }):
  { ok: true } | { ok: false; reason: string };
```

**Commit:** `git add lib/eval/budget.ts lib/eval/__tests__/cost-ceiling.test.ts` → `feat(eval): pre-flight cost-ceiling check`

## C-b.7 — Runner script `scripts/agent-eval.ts` + `pnpm eval:agents`

- [ ] Write `__tests__/agent-eval-runner.test.ts`: import the runner's pure `buildAggregate(caseStats, calibration, cost)` and assert the `AgentEvalAggregate` shape (ts, models, calibration block, per-case stats, cost, gate). (The `main()` I/O loop is exercised by the integration check in C-b.8, not unit-tested.)
- [ ] Watch fail.
- [ ] Implement `scripts/agent-eval.ts`: AI_GATEWAY_API_KEY guard (CI hard-fail, local exit 0) mirroring `ask-eval.ts`; `loadCases()`; **calibration FIRST** via shared `runCalibration` against `evals/agents/calibration.ts` — exit non-zero on fail, writing a calibration-only `agent-eval-result.json`; cost pre-flight `assertWithinBudget` — abort if over cap; then the Monte-Carlo loop: each case × N runs → `runTarget` (tiered model) → `gradeRun` → `aggregateCase`; write `agent-eval-result.json`; publish to `agent-eval:latest` via `publishAggregate` (env-gated). Add `"eval:agents": "TSX_TSCONFIG_PATH=scripts/tsconfig.eval.json tsx scripts/agent-eval.ts"` to `package.json`. Reuse `scripts/tsconfig.eval.json` (no new tsconfig — `evals/` does not import `server-only`, but the shared alias is harmless and keeps one runner config).
- [ ] `N` configurable via `EVAL_RUNS` env, default 3, hard-clamped to ≤5.

**Files:** `scripts/agent-eval.ts`, `package.json`, `__tests__/agent-eval-runner.test.ts`

**Interfaces:**
```ts
// scripts/agent-eval.ts (exported for unit test; main() is the entrypoint)
export type AgentEvalAggregate = {
  ts: string;
  targetModelMechanical: string;
  targetModelJudgment: string;
  judgeModel: string;
  runs: number;
  calibration: { total: number; agreed: number; agreement: number; passed: boolean; minAgreement: number; errored: number };
  cases: CaseStats[];
  costEstimateUsd: number;
  maxJobCostUsd: number;
  gate: { calibrationPassed: boolean; withinBudget: boolean; passed: boolean };
};
export function buildAggregate(/* ... */): AgentEvalAggregate;
```

**Commit:** `git add scripts/agent-eval.ts package.json __tests__/agent-eval-runner.test.ts` → `feat(eval): pnpm eval:agents Monte-Carlo runner`

## C-b.8 — Integration smoke: trivial case passes 100%, calibration scores known-good/bad

- [ ] Add `__tests__/agent-eval-integration.test.ts` (mock the `ai` SDK at the module boundary so NO real Gateway call is made): stub `generateText` so the `git-add-scoping` target output is deterministic compliant text → the code grader passes 5/5 (`passAtK=1, passHatK=1, variance=0`); stub the judge to score the calibration positive case PASS and the negative case FAIL → `agreement=1.0, passed:true`; stub a weakened target → its case shows `passHatK < 1`.
- [ ] Watch fail, implement the wiring so it passes.
- [ ] This is the spec §5 acceptance: "trivial deterministic case passes 100%" and "judge calibration scores known-good/bad."

**Files:** `__tests__/agent-eval-integration.test.ts`

**Commit:** `git add __tests__/agent-eval-integration.test.ts` → `test(eval): integration smoke for runner + calibration`

> **CHECKPOINT C-b** — Open sub-PR `…-runner` → integration branch. Run the 5-agent battery. Verify `pnpm eval:agents` runs end-to-end locally with a real key and writes `agent-eval-result.json` within the cost cap. Confirm the trivial case is 100% and the known-hard case is NOT 100% (eval discriminates).

---

# Sub-PR C-c — A/B control-vs-treatment mode

Goal: `pnpm eval:agents --ab` runs control and treatment arms, reports the success-rate delta with variance. Cost cap accounts for the doubled run.

Branch: `feat/platform-gaps-2026-agent-eval-ab`

## C-c.1 — A/B delta math

- [ ] Write `lib/eval/__tests__/ab.test.ts`: `abDelta(controlStats, treatmentStats)` returns `deltaMean` (treatment − control), pooled `deltaStddev`, and a `degraded:boolean` flag when treatment mean < control mean beyond a noise threshold; identical inputs → delta 0; a treatment 0.3 below control → negative delta of the right magnitude.
- [ ] Watch fail.
- [ ] Implement `lib/eval/ab.ts`.

**Files:** `lib/eval/ab.ts`, `lib/eval/__tests__/ab.test.ts`

**Interfaces:**
```ts
// lib/eval/ab.ts
export type AbResult = {
  controlMean: number;
  treatmentMean: number;
  deltaMean: number;     // treatment - control
  deltaStddev: number;   // pooled
  degraded: boolean;     // treatment meaningfully worse than control
};
export function abDelta(control: CaseStats[], treatment: CaseStats[]): AbResult;
```

**Commit:** `git add lib/eval/ab.ts lib/eval/__tests__/ab.test.ts` → `feat(eval): A/B success-rate delta + pooled variance`

## C-c.2 — A/B case-variant model

- [ ] Write `evals/agents/__tests__/ab-variant.test.ts`: a case carrying `control.systemText` and `treatment.systemText` parses; a case missing the treatment variant in `--ab` mode is rejected by `selectAbCases()`.
- [ ] Watch fail.
- [ ] Extend the schema (or add a sibling `AgentEvalAbCaseSchema`) with optional `control`/`treatment` system-text variants, and a `selectAbCases(cases)` filter that returns only cases declaring both arms. Add one A/B-ready case: `evals/agents/ab-rule-loadbearing/` where `treatment.systemText` is the platform prompt with a specific rule **pruned** (the spec's "is this rule load-bearing" mechanism).

**Files:** `evals/agents/schema.ts` (extend), `evals/agents/ab-rule-loadbearing/{PROMPT.md,CASE.ts}`, `evals/agents/__tests__/ab-variant.test.ts`

**Commit:** `git add evals/agents/schema.ts evals/agents/ab-rule-loadbearing __tests__/...` → `feat(eval): A/B case-variant schema + load-bearing-rule case`

> Stage the exact files only — list them explicitly, never `git add .`.

## C-c.3 — Wire `--ab` into the runner with doubled-cost cap

- [ ] Write `__tests__/agent-eval-ab.test.ts` (SDK mocked): `--ab` runs both arms; cost pre-flight uses `doubled:true` (cap `2 × MAX_JOB_COST_USD`); a **deliberately weakened treatment** (the pruned-rule variant, stubbed to fail more often) reports a **non-zero negative delta** with `degraded:true`. This is spec §5's "A/B reports a non-zero delta on a deliberately weakened treatment."
- [ ] Watch fail.
- [ ] Add `--ab` flag parsing to `scripts/agent-eval.ts`: when set, run `selectAbCases`, execute control + treatment arms, compute `abDelta`, fold the A/B block into the aggregate (and the `agent-eval-result.json`), and pass `doubled:true` to `assertWithinBudget`.

**Files:** `scripts/agent-eval.ts`, `__tests__/agent-eval-ab.test.ts`

**Interfaces:** `AgentEvalAggregate` gains optional `ab?: AbResult`.

**Commit:** `git add scripts/agent-eval.ts __tests__/agent-eval-ab.test.ts` → `feat(eval): A/B mode in eval:agents runner`

> **CHECKPOINT C-c** — Open sub-PR `…-ab` → integration branch. Battery. Verify `pnpm eval:agents --ab` distinguishes the pruned-rule treatment from control with a non-zero delta, and that the doubled cost stays within `2 × MAX_JOB_COST_USD`.

---

# Sub-PR C-d — CI job + result publication

Goal: a manual/scheduled, non-blocking CI job runs `pnpm eval:agents`, uploads `agent-eval-result.json`, and (env-gated) publishes `agent-eval:latest`. Never on the per-push gate.

Branch: `feat/platform-gaps-2026-agent-eval-ci`

## C-d.1 — `agent-eval:latest` publication wiring (already via shared helper — assert key + isolation)

- [ ] Write `__tests__/agent-eval-redis-key.test.ts`: assert the runner's published key constant is exactly `'agent-eval:latest'` and is NOT `'ask:eval:latest'` (the two harnesses must never collide on one Redis key — spec §3 distinctness).
- [ ] Watch fail (if the constant is not yet pinned/exported).
- [ ] Export `AGENT_EVAL_REDIS_KEY = 'agent-eval:latest'` from `scripts/agent-eval.ts` and use it in the `publishAggregate` call.

**Files:** `scripts/agent-eval.ts`, `__tests__/agent-eval-redis-key.test.ts`

**Commit:** `git add scripts/agent-eval.ts __tests__/agent-eval-redis-key.test.ts` → `feat(eval): pin agent-eval Redis key distinct from ask-eval`

## C-d.2 — CI job (workflow_dispatch + schedule, non-blocking)

- [ ] Write `__tests__/agent-eval-ci-config.test.ts` (allow-tagged `readFileSync` per the no-source-grep rule): parse `.github/workflows/ci.yml`, assert the `agent-eval` job (a) is triggered only by `workflow_dispatch`/`schedule` (NOT in `needs` of any blocking gate, NOT a required check); (b) sets `AI_GATEWAY_API_KEY` from secrets; (c) uploads `agent-eval-result.json`; (d) has a `timeout-minutes` set.
- [ ] Watch fail.
- [ ] Add an `agent-eval` job to `.github/workflows/ci.yml`: gated on `github.event_name == 'workflow_dispatch' || github.event_name == 'schedule'`, with a `schedule: cron` (e.g. weekly) added to the top-level `on:`. Mirror the existing `ai-eval` job's setup steps (checkout, pnpm, node, install) but run `pnpm eval:agents`. Upload the artifact `if: always()`. Do NOT add it to any blocking job's `needs`. Do NOT add `evals/` or `scripts/agent-eval.ts` to the `detect-changes` `ai_changed` filter (that filter gates the *blocking* `ai-eval` job — the agent harness is non-blocking by design).

**Files:** `.github/workflows/ci.yml`, `__tests__/agent-eval-ci-config.test.ts`

**Commit:** `git add .github/workflows/ci.yml __tests__/agent-eval-ci-config.test.ts` → `ci(eval): non-blocking scheduled agent-eval job`

## C-d.3 — DECISIONS.md ADR + reversibility note

- [ ] Append a dated ADR to `DECISIONS.md`: the agent-eval harness, the `wshobson plugin-eval` Monte-Carlo foundation, the cost ceiling (`N≤5`, `MAX_JOB_COST_USD=2.00`, A/B doubles to 4.00), the `MIN_CALIBRATION_AGREEMENT=0.85` calibration gate, distinctness from `ask:eval`, and the reversibility note (remove `evals/agents/` + `scripts/agent-eval.ts` + the `eval:agents` script + the `agent-eval:latest` key; `lib/eval/` stays as an `ask:eval` dependency).
- [ ] No test (docs-only).

**Files:** `DECISIONS.md`

**Commit:** `git add DECISIONS.md` → `docs(eval): ADR for agent-eval harness`

## C-d.4 — `ai-eval-update` skill / CLAUDE.md pointer (optional, if time)

- [ ] Add a one-line `eval:agents` row to the CLAUDE.md "AI agent workflow" command table and a brief note distinguishing it from `ask:eval`. Keep it minimal (CLAUDE.md loads every session — fight monotonic growth).
- [ ] No test (docs-only).

**Files:** `CLAUDE.md`

**Commit:** `git add CLAUDE.md` → `docs(eval): document eval:agents in CLAUDE.md`

> **CHECKPOINT C-d** — Open sub-PR `…-ci` → integration branch. Battery (security-auditor REQUIRED — touches `.github/workflows/`). Trigger the job via `workflow_dispatch` once to prove it runs green and uploads the artifact. Then open the integration `feat/platform-gaps-2026-agent-eval` → main PR (large by design, reviewed incrementally via the four sub-PRs).

---

## Verification before completion (whole unit)

Before claiming the unit done, run and cite output:
- `pnpm typecheck` — clean.
- `pnpm test --run lib/eval evals/agents __tests__/agent-eval-*` — all green.
- `pnpm ask:eval` (with key) — regression-free vs pre-C-a `Aggregate` shape.
- `pnpm eval:agents` (with key) — writes `agent-eval-result.json`, trivial case 100%, known-hard case < 100%, within `MAX_JOB_COST_USD`.
- `pnpm eval:agents --ab` (with key) — non-zero delta on the weakened treatment, within `2 × MAX_JOB_COST_USD`.
- `pnpm check` — Biome clean.

## Self-review (run before declaring the plan done — completed)

- **No JUDGE_SYSTEM duplication** — enforced: C-a.2 extracts one `judge()`; C-b.3 reuses it; C-d.1 asserts distinct Redis keys. ✓
- **Calibration is first-class** — C-b.2/.3 build it; C-b.7 runs it BEFORE the corpus and gates on it; constants pinned at 0.85 / 0.5. ✓
- **Cost ceiling quantified** — `N≤5`, `MAX_JOB_COST_USD=2.00`, A/B `4.00`; C-b.6 pre-flight aborts over cap; C-c.3 passes `doubled:true`. ✓
- **Distinct from `ask:eval`** — separate corpus dir, script, result file, Redis key (C-d.1 test pins it). ✓
- **Anti-saturation** — `knownHard` flag (C-a.7/.8); checkpoints verify the known-hard case is < 100%. ✓
- **`ask:eval` safety** — C-a is a pure refactor proven regression-free; security-auditor REQUIRED at C-a + C-d (touches the `ai-eval` path and `.github/workflows/`). ✓
- **TDD throughout** — every implementation task has a preceding failing test; the three spec §5 acceptance tests are explicit (C-b.8 trivial-100% + calibration good/bad; C-c.3 weakened-treatment non-zero delta). ✓
- **Commit hygiene** — every task lists `git add <specific files>`; no `git add .`. ✓
- **Open decisions (flagged, not blockers):**
  1. **Target invocation fidelity.** `runTarget` invokes the platform prompt via a single `generateText` call with the rule as `systemText` — a *proxy* for "the agent given this rule." It does NOT run a full agent loop with tools. This is the cheap, bounded approximation the cost ceiling demands; a fuller agent-loop harness is a future extension. Stated so the reviewer knows the harness measures prompt-adherence, not end-to-end agent behavior.
  2. **`ask-eval.ts` calibration unification deferred** (C-b.3 note) — the shared `judge` already guarantees one judge prompt; merging the two `runCalibration()` bodies is a low-value follow-up, not in this unit.
  3. **Corpus depth.** The plan seeds ~4 cases concretely; the spec's "~20 from real transcripts" is reached by repeating the C-a.8 pattern. Padding to 20 is mechanical and can land in the integration PR or a fast follow — flagged so it is not silently skipped.
