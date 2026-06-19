# Mutation Testing (Unit E) — Reconcile & Verify Spec

- **Date:** 2026-06-18 (rev. 2026-06-19 — reframed: the capability already exists)
- **Status:** Approved (reconcile/verify reframe, architect-reviewer PASS 2026-06-19) — plan written
- **Branch:** `feat/platform-gaps-2026-mutation` (sub-PR into `feat/platform-gaps-2026`)
- **Author:** Erik Cunha

## 1. Context & goal — the gap is already closed

Benchmark gap (score 14): TDD proves tests *pass*, not that they *catch regressions*. **Architect-review discovery:** mutation testing is **already fully wired** in the repo — `test:mutation` script, `@stryker-mutator/core` + `@stryker-mutator/vitest-runner` devDeps (`^9.6.1`), `stryker.config.mjs`, and `.github/workflows/mutation.yml` (scheduled + `workflow_dispatch`, `continue-on-error: true`), all committed at `ffa7009 feat(chore): init`. My benchmark inventory missed it. **This further confirms the platform's saturation thesis.**

### Goal (reframed from "build" to "reconcile + verify")

This is no longer a build. It is: (1) reconcile three divergences the architect found between intent and the existing config, (2) verify the existing setup actually catches a survived mutant, (3) decide the threshold-promotion story.

## 2. The three reconciliations

1. **`mutate` scope.** `stryker.config.mjs` currently mutates `app/api/**`, `lib/**`, **and `scripts/**`**. `scripts/**` is broader than the "API boundary only" intent and risks the maintenance-drag the unit exists to avoid. **Decide:** narrow to `app/api/**` + `lib/**` (recommended — matches the leverage rationale), OR justify keeping `scripts/**` in an ADR note.
2. **Threshold story.** Config sets `thresholds.break: 65` (a hard gate) and `high: 80` (report band); non-blocking is enforced only by `continue-on-error: true` at the workflow level. Document this accurately: the gate is non-blocking via the workflow lever, not via an absent threshold. Define the FP/baseline condition before any future flip to a blocking job.
3. **Cosmetic:** config is `stryker.config.mjs` (not `.conf.json` as rev.1 assumed) — no change, just record.

## 3. Wiring

No new deps, scripts, or CI (all exist). Changes are limited to: a possible `stryker.config.mjs` `mutate`-scope narrowing, and an ADR note documenting the threshold/non-blocking story + the scope decision. `check-dep-pinning` already covers the devDeps (caret + lockfile).

## 4. Failure-mode checklist (thinking-inversion)

| Failure mode | Mitigation |
|---|---|
| `scripts/**` scope = maintenance drag | Narrow to API boundary (decision #1) |
| `break:65` retrains a bypass if mis-promoted | Keep non-blocking via `continue-on-error`; define baseline before any blocking flip |
| Setup looks wired but never actually catches anything | Verification step: a weak-test fixture must produce a survived mutant |
| Slow runs | Already scheduled/dispatch-only; tight scope after #1 |

## 5. Testing & verification

- Run `pnpm test:mutation`; confirm it produces a mutation-score report scoped to the API boundary (post-#1, no `scripts/**`/`app/` UI mutants).
- A deliberately weak test (asserts nothing meaningful) leaves a **survived mutant** in the report; strengthening it kills it — proving the existing setup is live, not vestigial.

## 6. Reversibility

The only changes are a config-scope narrowing + an ADR note — both trivially revertible. The existing mutation infra is untouched otherwise.

## 7. Status / next steps

Draft rev.2 → architect-reviewer re-gate (light; this is reconcile-not-build) → writing-plans (smallest in the program after F) → implementation (held). **Net finding: the benchmark over-counted this gap; it was already ~90% delivered.**
