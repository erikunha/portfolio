# Mutation Testing Reconcile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This is a reconcile-and-verify plan, not a build — the mutation-testing capability already exists at `ffa7009` (`test:mutation` script, `@stryker-mutator/core` + `@stryker-mutator/vitest-runner` devDeps, `stryker.config.mjs`, `.github/workflows/mutation.yml`).

**Goal:** Reconcile three divergences the architect found between the mutation-testing *intent* (API-boundary leverage, non-blocking trend signal) and the *existing* config, then prove the setup is live (not vestigial) by forcing a SURVIVED mutant with a weak test and killing it with a strengthened one. Net scope: one `stryker.config.mjs` `mutate`-scope narrowing, two DECISIONS.md ADR notes, one throwaway verification fixture that is created and removed within the plan.

**Architecture:** No runtime behavior changes and no changes to the mutation infrastructure itself (deps, `test:mutation` script, `mutation.yml` workflow all stay as-is). Reconciliation #1 edits only the `mutate` array in `stryker.config.mjs`. Reconciliation #2 is documentation-only (records that non-blocking is enforced by `continue-on-error: true` at the workflow level, not by an absent `thresholds.break`, and defines the baseline/false-positive condition required before any future blocking flip). The verification (Reconciliation #3) uses a dedicated throwaway fixture file inside the `lib/**` mutate scope plus its own test — never weakening a real production test — and both files are deleted in the final task.

**Tech Stack:** Stryker (`@stryker-mutator/core` + `@stryker-mutator/vitest-runner` `^9.6.1`) with the Vitest test runner, `coverageAnalysis: 'perTest'`; Vitest for the fixture test; ESM config (`stryker.config.mjs`); markdown ADR entries in `DECISIONS.md`.

---

## Global Constraints

- **Do not touch the mutation infrastructure beyond the `mutate` array.** Deps, the `test:mutation` script (`package.json` line 51 — `"stryker run"`), and `.github/workflows/mutation.yml` stay exactly as committed at `ffa7009`. The only config edit allowed is narrowing the `mutate` glob list.
- **`thresholds.break: 65` stays 65.** Reconciliation #2 is documentation-only. No threshold value changes, no workflow change, no flip to a blocking job in this plan. Promotion to blocking is explicitly deferred and gated on a documented baseline (see Task 3).
- **The verification fixture is throwaway.** It lives at `lib/__mutation-fixture__.ts` with test `__tests__/mutation-fixture.test.ts`, exists only to demonstrate the SURVIVED→KILLED transition, and MUST be deleted in Task 6. Never weaken an existing production test to manufacture a survived mutant.
- **Staging discipline:** every commit uses `git add <specific files>` — never `git add .`, `git add -A`, or `git add --all`. Stage only the files named in that task's **Files** block.
- **Mutation runs are slow (~10-15 min).** Each `pnpm test:mutation` invocation in this plan is scoped to a single fixture/file via `--mutate` so the verification loop stays fast; the full-scope run is confirmed once in Task 4.
- **Commitlint requires a scope.** Use the scopes shown in each commit command (`chore`, `docs`).
- **No PR is opened by this plan.** It ends at "ready for the review battery." Opening the PR follows the repo's standard pre-PR gate sequence and is out of scope here.

---

## File Map

| File | Change |
|---|---|
| `stryker.config.mjs` | Remove `'scripts/**/*.ts'` from the `mutate` array; narrow to `app/api/**` + `lib/**` (Task 1) |
| `DECISIONS.md` | Prepend one section with the scope-narrowing ADR (Task 2) + the threshold/non-blocking ADR (Task 3) |
| `lib/__mutation-fixture__.ts` | NEW throwaway file with a mutable function (Task 4); DELETED in Task 6 |
| `__tests__/mutation-fixture.test.ts` | NEW weak test (Task 4) → strengthened (Task 5); DELETED in Task 6 |

---

## Task 1: Narrow the `mutate` scope to the API boundary

**Decision encoded: remove `scripts/**/*.ts`.** Rationale (matches the spec's recommended option): the unit's leverage is API-boundary correctness — bugs in `app/api/**` and `lib/**` are security/correctness issues, the stated highest-value targets. `scripts/**` is build/CI tooling whose failures surface directly in CI runs, not in production behavior; mutating it adds runtime and maintenance drag (the exact failure mode the unit exists to avoid) for low signal. Keeping it would require an ADR justification per the spec; narrowing matches the leverage rationale and needs none beyond Task 2's record.

**Files:**
- Modify: `stryker.config.mjs`

- [ ] **Step 1: Confirm current scope**

```bash
sed -n '6,18p' stryker.config.mjs
```

Expected: the `mutate` array lists `'app/api/**/*.ts'`, `'lib/**/*.ts'`, AND `'scripts/**/*.ts'`, followed by the four `!` exclusions.

- [ ] **Step 2: Remove the `scripts/**/*.ts` line**

In `stryker.config.mjs`, delete exactly this line from the `mutate` array:

```js
    'scripts/**/*.ts',
```

The `mutate` array must read exactly:

```js
  mutate: [
    // API routes and server logic are the highest-value mutation targets:
    // bugs here are security/correctness issues, not just UI regressions.
    'app/api/**/*.ts',
    'lib/**/*.ts',
    // Exclude test files, type-only files, and generated output.
    '!**/*.test.*',
    '!**/*.spec.*',
    '!**/index.ts',
    '!design-system/dist/**',
  ],
```

(Only the `'scripts/**/*.ts',` line is removed; nothing else changes — `thresholds`, `reporters`, `timeoutMS`, `timeoutFactor`, `coverageAnalysis`, `testRunner`, `packageManager` all stay identical.)

- [ ] **Step 3: Verify config still parses**

```bash
node --check stryker.config.mjs && echo "PARSE_OK"
```

Expected: `PARSE_OK` and exit 0. (`node --check` validates ESM syntax without executing Stryker.)

- [ ] **Step 4: Commit**

```bash
git add stryker.config.mjs
git status
git commit -m "chore(test): narrow Stryker mutate scope to the API boundary

Remove scripts/**/*.ts from the mutate array. The unit's leverage is
API-boundary correctness (app/api/** + lib/**) — bugs there are
security/correctness issues. scripts/** is CI/build tooling whose
failures surface in CI runs, not production; mutating it adds runtime
and maintenance drag for low signal. Matches the original 'highest-value
mutation targets' comment. ADR recorded in DECISIONS.md (next commit)."
```

Expected: only `stryker.config.mjs` staged and committed.

---

## Task 2: Record the scope-narrowing ADR in DECISIONS.md

**Files:**
- Modify: `DECISIONS.md`

- [ ] **Step 1: Read the current DECISIONS.md top for the prepend point**

```bash
sed -n '1,12p' DECISIONS.md
```

Note the heading style and the most recent dated section so the new section is prepended in the correct place and format (newest-first, `## YYYY-MM-DD — title` then dated bullets).

- [ ] **Step 2: Prepend the new section**

Add a new section immediately after the file's intro/most-recent-newest boundary (match the existing newest-first ordering). Use exactly:

```markdown
## 2026-06-19 — Mutation testing reconcile: scope narrowed to the API boundary

- **2026-06-19** — **Stryker `mutate` scope narrowed to `app/api/**` + `lib/**`; `scripts/**` removed.** Mutation testing (already wired at `ffa7009`) exists to prove the test suite *catches regressions* at the highest-leverage surface: API routes and server logic, where a missed bug is a security/correctness defect rather than a UI regression. `scripts/**` is build/CI tooling — its failures surface directly in CI runs, so mutating it adds run time and maintenance drag (the precise failure mode the unit exists to avoid) for marginal signal. Narrowing aligns the config with the standing "highest-value mutation targets" comment already in `stryker.config.mjs`. _Reversible: re-add `'scripts/**/*.ts'` to the `mutate` array if scripts ever grow logic worth mutation-guarding._
```

- [ ] **Step 3: Commit**

```bash
git add DECISIONS.md
git status
git commit -m "docs(test): ADR for Stryker mutate-scope narrowing

Record the rationale for removing scripts/**/*.ts from the mutate scope
(API-boundary leverage; scripts failures surface in CI, not production).
Reversibility note included."
```

Expected: only `DECISIONS.md` staged and committed.

---

## Task 3: Document the threshold / non-blocking story + the promotion gate

**Files:**
- Modify: `DECISIONS.md`

This is documentation-only. No threshold value changes and no workflow change. The point is to record *accurately* how non-blocking is enforced today and what must be true before anyone flips it to blocking.

- [ ] **Step 1: Confirm the current threshold + non-blocking mechanism (so the ADR is accurate, not assumed)**

```bash
sed -n '19,23p' stryker.config.mjs
grep -n 'continue-on-error' .github/workflows/mutation.yml
```

Expected: config shows `thresholds: { high: 80, low: 65, break: 65 }`; the workflow shows `continue-on-error: true` on the `Run mutation tests` step. These two facts are the load-bearing claims of the ADR — the ADR must match this output verbatim.

- [ ] **Step 2: Append the threshold ADR bullets under the Task 2 section**

Add these bullets to the `## 2026-06-19 — Mutation testing reconcile...` section created in Task 2 (same section, appended after the scope bullet):

```markdown
- **2026-06-19** — **Mutation testing is non-blocking via the workflow lever (`continue-on-error: true`), NOT via an absent break threshold.** `stryker.config.mjs` sets `thresholds.break: 65`, which on its own would make `stryker run` exit non-zero below 65% and hard-fail the job. The job does not block because `.github/workflows/mutation.yml`'s `Run mutation tests` step carries `continue-on-error: true`, and the workflow runs on a weekly `schedule` + `workflow_dispatch` only (never on `push`/`pull_request`). So the gate's value today is **trend tracking** (uploaded artifact + job-summary score), not per-commit enforcement. This is deliberate: a per-commit mutation gate is slow (~10-15 min) and, before a stable baseline exists, would retrain `--no-verify` bypasses — the false-positive failure mode CLAUDE.md warns against. _Reversible: the gate is config-present but workflow-suppressed; flipping it on is a one-line workflow change, gated by the baseline below._
- **2026-06-19** — **Baseline / false-positive condition required before any blocking flip.** Promoting mutation testing to a blocking gate is explicitly deferred. Before removing `continue-on-error` (or adding a `push`/`pull_request` trigger), ALL must hold: (1) at least **3 consecutive weekly runs** recorded with a mutation score for the narrowed `app/api/**` + `lib/**` scope, establishing the real baseline; (2) the chosen `break` value set **at or below the observed floor minus a margin** (not the aspirational 80, not a guessed 65) so a green suite cannot fail the gate on noise; (3) a documented exclusion path for equivalent/无-kill mutants (e.g. log-string mutations) so a true-but-unkillable mutant does not force a bypass. Until all three exist, the gate stays non-blocking. _Reversible: this is the precondition record; no code changes here._
```

(Replace the stray non-ASCII `无-kill` if it appears — write "non-killable". The intent: equivalent mutants that no test can kill must have a documented exclusion before blocking.)

- [ ] **Step 3: Commit**

```bash
git add DECISIONS.md
git status
git commit -m "docs(test): ADR for mutation threshold + non-blocking story

Record that non-blocking is enforced by continue-on-error in
mutation.yml (not by an absent break threshold), and define the
3-run baseline + floor-minus-margin + equivalent-mutant-exclusion
preconditions required before any future flip to a blocking gate."
```

Expected: only `DECISIONS.md` staged and committed.

---

## Task 4: Create the weak-test fixture and prove a SURVIVED mutant (RED of the verification)

**Files:**
- Create: `lib/__mutation-fixture__.ts`
- Create: `__tests__/mutation-fixture.test.ts`

The fixture is a self-contained pure function inside the `lib/**` mutate scope. A deliberately weak test exercises it without asserting the boundary behavior, so Stryker's boundary/arithmetic mutation survives — proving the setup actually detects an under-tested branch.

- [ ] **Step 1: Create the fixture**

Write `lib/__mutation-fixture__.ts` exactly:

```ts
// THROWAWAY — mutation-testing liveness fixture. Deleted in the same plan
// (Task 6). Exists only to prove Stryker produces a SURVIVED mutant for a
// weakly-tested branch and a KILLED mutant once the test asserts the boundary.
// Do NOT import this from any production code.
export function clampScore(n: number): number {
  if (n < 0) return 0;
  if (n > 100) return 100;
  return n;
}
```

- [ ] **Step 2: Create the deliberately weak test**

Write `__tests__/mutation-fixture.test.ts` exactly:

```ts
import { describe, expect, it } from 'vitest';
import { clampScore } from '@/lib/__mutation-fixture__';

describe('clampScore (weak — does NOT assert clamp boundaries)', () => {
  it('returns a number for an in-range input', () => {
    // Weak on purpose: only exercises the pass-through branch, never the
    // `< 0` or `> 100` clamp branches. Stryker mutations of the boundary
    // conditionals will SURVIVE because nothing asserts the clamp.
    expect(typeof clampScore(50)).toBe('number');
  });
});
```

- [ ] **Step 3: Confirm the weak test passes (it must — that is the whole point)**

```bash
pnpm test --run __tests__/mutation-fixture.test.ts 2>&1 | tail -8
```

Expected: 1 passing test. A test that catches nothing still passes — which is exactly the blind spot mutation testing exposes.

- [ ] **Step 4: Run Stryker scoped to the fixture and confirm a SURVIVED mutant**

```bash
pnpm exec stryker run --mutate 'lib/__mutation-fixture__.ts' 2>&1 | tail -30
```

Expected: the clear-text reporter lists at least one mutant with status **Survived** for `lib/__mutation-fixture__.ts` (e.g. the `n < 0` conditional flipped, or the `0`/`100` literal replaced), and a mutation score well below 100%. This is the live proof: the wired setup detects the under-tested branch. (Scoping with `--mutate` keeps this run to seconds, not the full ~10-15 min suite.)

- [ ] **Step 5: Commit the RED fixture + verification evidence**

```bash
git add lib/__mutation-fixture__.ts __tests__/mutation-fixture.test.ts
git status
git commit -m "chore(test): mutation liveness fixture — weak test yields SURVIVED mutant

Throwaway clampScore fixture in lib/** mutate scope with a deliberately
weak test that never asserts the clamp boundaries. Stryker (scoped via
--mutate) reports a SURVIVED mutant on the boundary conditional, proving
the existing setup detects under-tested branches (live, not vestigial).
Strengthened to KILLED in the next commit; both files removed in Task 6."
```

Expected: only the two fixture files staged and committed.

---

## Task 5: Strengthen the test to KILL the mutant (GREEN of the verification)

**Files:**
- Modify: `__tests__/mutation-fixture.test.ts`

- [ ] **Step 1: Replace the weak test body with boundary assertions**

Overwrite `__tests__/mutation-fixture.test.ts` exactly:

```ts
import { describe, expect, it } from 'vitest';
import { clampScore } from '@/lib/__mutation-fixture__';

describe('clampScore (strengthened — asserts both clamp boundaries)', () => {
  it('passes in-range values through unchanged', () => {
    expect(clampScore(50)).toBe(50);
  });

  it('clamps negatives to 0', () => {
    expect(clampScore(-1)).toBe(0);
  });

  it('clamps values over 100 to 100', () => {
    expect(clampScore(101)).toBe(100);
  });
});
```

- [ ] **Step 2: Confirm the strengthened tests pass**

```bash
pnpm test --run __tests__/mutation-fixture.test.ts 2>&1 | tail -8
```

Expected: 3 passing tests.

- [ ] **Step 3: Re-run Stryker scoped to the fixture and confirm the mutant is now KILLED**

```bash
pnpm exec stryker run --mutate 'lib/__mutation-fixture__.ts' 2>&1 | tail -30
```

Expected: the previously SURVIVED boundary mutants now report **Killed**, and the mutation score for `lib/__mutation-fixture__.ts` is 100% (or no surviving mutants). This closes the SURVIVED→KILLED loop, proving the setup both detects AND rewards a real assertion.

- [ ] **Step 4: Commit the GREEN strengthening**

```bash
git add __tests__/mutation-fixture.test.ts
git status
git commit -m "chore(test): strengthen mutation fixture test — mutant now KILLED

Add the two missing clamp-boundary assertions (negatives -> 0, >100 ->
100). Stryker (scoped via --mutate) now reports the boundary mutants as
Killed and the fixture at 100% mutation score, closing the
SURVIVED->KILLED liveness proof. Fixture removed in Task 6."
```

Expected: only the test file staged and committed.

---

## Task 6: Confirm full-scope run is correctly scoped, then remove the throwaway fixture

**Files:**
- Delete: `lib/__mutation-fixture__.ts`
- Delete: `__tests__/mutation-fixture.test.ts`

- [ ] **Step 1: Run the full (unscoped) mutation suite and confirm scope is correct**

```bash
pnpm test:mutation 2>&1 | tee /tmp/mutation-full.log | tail -40
```

Expected (this is the post-#1 scope check): the report covers `app/api/**/*.ts` and `lib/**/*.ts` files only. Confirm NO `scripts/` file appears as a mutated target:

```bash
grep -c 'scripts/' /tmp/mutation-full.log || echo "NO_SCRIPTS_MUTANTS (expected)"
```

Expected: `0` matches (or the `NO_SCRIPTS_MUTANTS` echo) — proving Reconciliation #1 took effect on the real run, not just the scoped fixture run. (This is the one full ~10-15 min run; everything prior was `--mutate`-scoped for speed.)

- [ ] **Step 2: Delete the throwaway fixture and its test**

```bash
git rm lib/__mutation-fixture__.ts __tests__/mutation-fixture.test.ts
git status
```

Expected: both files staged for deletion.

- [ ] **Step 3: Confirm nothing imported the fixture (no dangling references)**

```bash
grep -rn '__mutation-fixture__' --include='*.ts' --include='*.tsx' . ; echo "exit=$?"
```

Expected: no matches (`grep` exit `1` printed as `exit=1`). If any match appears outside the files just deleted, remove that reference before committing.

- [ ] **Step 4: Verify the suite is clean after removal**

```bash
pnpm typecheck 2>&1 | tail -5
pnpm test --run 2>&1 | tail -8
```

Expected: typecheck passes; the test suite passes with no reference to the deleted fixture test.

- [ ] **Step 5: Commit the removal**

```bash
git add lib/__mutation-fixture__.ts __tests__/mutation-fixture.test.ts
git status
git commit -m "chore(test): remove throwaway mutation liveness fixture

The SURVIVED->KILLED proof is complete and recorded in the prior two
commits. Delete lib/__mutation-fixture__.ts and its test so no throwaway
code lands on the branch. Full-scope pnpm test:mutation confirmed the
narrowed scope (no scripts/ mutants) on the real run."
```

(Note: `git add` of a `git rm`-staged path keeps the deletion staged; both deletions are committed.)

Expected: both files committed as deletions.

---

## Self-review

- **Methodology header complete?** Yes — title (`# Mutation Testing Reconcile Implementation Plan`), agentic-workers line, Goal, Architecture, Tech Stack, `## Global Constraints`, File Map. ✓
- **All three reconciliations covered?** #1 scope-narrow = Task 1 (+ADR Task 2); #2 threshold/non-blocking story + baseline precondition = Task 3; #3 verification SURVIVED→KILLED = Tasks 4–5, full-scope confirmation = Task 6. ✓
- **`scripts/**` decision encoded?** Yes — removed (recommended option), with rationale in Task 1 and a reversibility ADR in Task 2. ✓
- **Stable IDs + checkboxes + per-task Files + real commands + per-task commit with specific `git add`?** Yes on all tasks. ✓
- **No infra drift?** Confirmed — no dep, `test:mutation` script, or `mutation.yml` edits; only `mutate` array, DECISIONS.md, and a throwaway fixture that is deleted. ✓
- **Fixes applied inline during review:**
  - Tasks 4–5 originally risked weakening a real `lib/` test (`ip-hash`/`cn`); switched to a dedicated throwaway `__mutation-fixture__.ts` deleted in Task 6, so no production test is ever weakened. ✓
  - Added `--mutate`-scoped runs in Tasks 4–5 so the verification loop is seconds, not the full ~10-15 min suite; the one full run is isolated to Task 6 Step 1 where it doubles as the post-#1 scope check. ✓
  - Added Task 6 Step 3 dangling-reference grep + Step 4 typecheck/test, so fixture removal cannot leave a broken import. ✓
- **Open decisions (carry into implementation):**
  1. **DECISIONS.md ordering** — Task 2/3 prepend assumes newest-first; if the file is oldest-first at implementation time, append instead (Step 1 of each reads the file to confirm). Low risk, self-correcting.
  2. **Stryker `--mutate` CLI flag form** — assumed `pnpm exec stryker run --mutate '<glob>'` overrides the config array for a single file. If the installed `@stryker-mutator/core ^9.6.1` ignores/merges rather than overrides, fall back to a temporary one-file `mutate` in config or run unscoped (slower) — does not change the outcome, only the speed of Tasks 4–5.
