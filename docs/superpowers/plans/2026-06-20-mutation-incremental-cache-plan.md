# Mutation testing `--incremental` + cache Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut the typical weekly Stryker mutation run from ~38 min to well under 15 min by re-testing only mutants in files changed since the last run, persisting Stryker's incremental file across runs via `actions/cache`, with zero change to the score, the de-masking guard, or the trend signal.

**Architecture:** Enable Stryker incremental mode in `stryker.config.mjs` with an explicit `incrementalFile` path (the default is `reports/stryker-incremental.json`, which would NOT match our cache/gitignore path), cache that file in `.github/workflows/mutation.yml` with the standard evolving-cache pattern (`run_id` key + prefix `restore-keys`), and gitignore the artifact. Correctness is preserved because the incremental report is always complete; a cache miss self-heals via a full run.

**Tech Stack:** Stryker (`@stryker-mutator/core ^9.6.1`) with vitest-runner; GitHub Actions `actions/cache`; Vitest for the config test; `js-yaml` (already a dev dep, used by other CI-config tests) for parsing the workflow.

## Global Constraints

- **Stryker default `incrementalFile` is `reports/stryker-incremental.json`** (verified in the installed schema). MUST be overridden to `.stryker-incremental.json` so config, cache `path`, and `.gitignore` all reference the same file. This is the single highest-risk failure mode (silent no-speedup).
- **SHA-pin `actions/cache`** to the repo's existing pin: `actions/cache@27d5ce7f107fe9357f9df03efb73ab90386fccae # v5.0.5` (reuse exactly; the repo SHA-pins every action and Dependabot tracks them).
- **No source-grep for behavior** (STANDARDS Ch.4): the config test asserts `incremental`/`incrementalFile` from the PARSED config object (import `stryker.config.mjs`), never a string grep (which would pass on a commented-out line).
- **No change** to `mutate` scope, `thresholds`, `continue-on-error`, the de-masking guard, the weekly cadence, or the 120-min timeout.
- **No em dashes** in any added prose/comments (author convention). Use commas/parentheses.
- **Staging discipline:** `git add <specific files>` only, never `git add .`/`-A`/`--all`.
- **Commitlint:** every commit needs a scope; subjects lowercase (no sentence-case). Scopes used below: `perf`, `test`, `docs`.

## File Map

| File | Change |
|---|---|
| `stryker.config.mjs` | Add `incremental: true` + `incrementalFile: '.stryker-incremental.json'` (Task 2) |
| `__tests__/scripts/mutation-incremental-config.test.ts` | NEW: parsed-config + workflow-cache-step assertions (Task 1 writes it failing, Task 2/3 make it pass) |
| `.gitignore` | Add `.stryker-incremental.json` (Task 2) |
| `.github/workflows/mutation.yml` | Add the `actions/cache` step before "Run mutation tests" (Task 3) |
| `DECISIONS.md` | ADR with the recorded two-run wall-clock proof + failure-mode notes (Task 5) |

---

## Task 1: Write the failing config + workflow test

**Files:**
- Create: `__tests__/scripts/mutation-incremental-config.test.ts`

**Interfaces:**
- Consumes: `stryker.config.mjs` default export (a plain options object); `.github/workflows/mutation.yml` (read as text + parsed with `js-yaml`).
- Produces: the regression guard that Tasks 2 and 3 satisfy.

- [ ] **Step 1: Write the test**

```ts
// __tests__/scripts/mutation-incremental-config.test.ts
// Pins the incremental-cache optimization: Stryker config flags (read from the
// PARSED config object, not a string grep, so a commented-out line cannot pass)
// and the actions/cache step in the weekly mutation workflow.
import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';
import { describe, expect, it } from 'vitest';
import strykerConfig from '@/stryker.config.mjs';

describe('stryker incremental config', () => {
  it('enables incremental mode', () => {
    expect((strykerConfig as Record<string, unknown>).incremental).toBe(true);
  });

  it('pins incrementalFile to the repo-root path the cache + gitignore reference', () => {
    // The Stryker default is reports/stryker-incremental.json; overriding it makes
    // the config, the actions/cache path, and .gitignore all name the same file.
    expect((strykerConfig as Record<string, unknown>).incrementalFile).toBe(
      '.stryker-incremental.json',
    );
  });
});

describe('mutation.yml caches the incremental file', () => {
  const wf = load(
    readFileSync(`${process.cwd()}/.github/workflows/mutation.yml`, 'utf8'),
  ) as { jobs: { mutation: { steps: Array<Record<string, unknown>> } } };
  const steps = wf.jobs.mutation.steps;
  const cacheStep = steps.find(
    (s) => typeof s.uses === 'string' && (s.uses as string).startsWith('actions/cache@'),
  );

  it('has an actions/cache step (existence guard so the asserts below cannot vacuously pass)', () => {
    expect(cacheStep).toBeDefined();
  });

  it('SHA-pins actions/cache to the repo-standard v5.0.5 pin', () => {
    expect(cacheStep?.uses).toBe(
      'actions/cache@27d5ce7f107fe9357f9df03efb73ab90386fccae # v5.0.5',
    );
  });

  it('caches the incremental file with the evolving-cache key pattern', () => {
    const w = cacheStep?.with as Record<string, string>;
    expect(w.path).toContain('.stryker-incremental.json');
    expect(w.key).toContain('stryker-incremental-');
    expect(w.key).toContain('github.run_id');
    expect(w['restore-keys']).toContain('stryker-incremental-');
  });

  it('places the cache step before the mutation run (so the file is restored first)', () => {
    const cacheIdx = steps.findIndex((s) => s === cacheStep);
    const runIdx = steps.findIndex((s) => s.name === 'Run mutation tests');
    expect(cacheIdx).toBeGreaterThanOrEqual(0);
    expect(runIdx).toBeGreaterThan(cacheIdx);
  });
});
```

- [ ] **Step 2: Run it, confirm it FAILS**

Run: `pnpm test --run __tests__/scripts/mutation-incremental-config.test.ts 2>&1 | tail -15`
Expected: FAIL. `incremental` is `undefined` (config not yet changed) and there is no `actions/cache` step in `mutation.yml` (`cacheStep` undefined).

- [ ] **Step 3: Commit the failing test**

```bash
git add __tests__/scripts/mutation-incremental-config.test.ts
git commit -m "test(mutation): pin incremental config + cache-step expectations"
```

---

## Task 2: Enable incremental mode + gitignore the artifact

**Files:**
- Modify: `stryker.config.mjs`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: nothing.
- Produces: `incremental: true` and `incrementalFile: '.stryker-incremental.json'` in the Stryker options, satisfying the first `describe` of the Task 1 test.

- [ ] **Step 1: Add the two options to `stryker.config.mjs`**

The current file ends with `timeoutFactor: 2,` inside the default export. Add the two
keys (anywhere in the object; place them next to `coverageAnalysis` for readability):

```js
  coverageAnalysis: 'perTest',
  // Incremental mode: re-test only mutants in files changed since the last run,
  // reusing cached statuses for the rest. The report stays complete (cached +
  // fresh), so the score, the de-masking guard, and the trend signal are unchanged.
  // incrementalFile is pinned to repo root (Stryker's default is
  // reports/stryker-incremental.json) so the config, the actions/cache path, and
  // .gitignore all reference the same file. CI caches it across weekly runs.
  incremental: true,
  incrementalFile: '.stryker-incremental.json',
```

- [ ] **Step 2: Verify config parses**

Run: `node --check stryker.config.mjs && echo PARSE_OK`
Expected: `PARSE_OK`.

- [ ] **Step 3: Add the artifact to `.gitignore`**

The mutation block currently reads:
```
.stryker-tmp/
mutation-report.html
mutation-report.json
```
Append one line so it reads:
```
.stryker-tmp/
mutation-report.html
mutation-report.json
.stryker-incremental.json
```

- [ ] **Step 4: Run the config half of the test, confirm those cases PASS**

Run: `pnpm test --run __tests__/scripts/mutation-incremental-config.test.ts -t 'stryker incremental config' 2>&1 | tail -8`
Expected: the two `stryker incremental config` cases PASS. The `mutation.yml` cases still FAIL (no cache step yet).

- [ ] **Step 5: Commit**

```bash
git add stryker.config.mjs .gitignore
git commit -m "perf(mutation): enable Stryker incremental mode (pinned incrementalFile)"
```

---

## Task 3: Cache the incremental file in the workflow

**Files:**
- Modify: `.github/workflows/mutation.yml`

**Interfaces:**
- Consumes: the `incrementalFile` path from Task 2 (`.stryker-incremental.json`).
- Produces: the `actions/cache` step satisfying the second `describe` of the Task 1 test.

- [ ] **Step 1: Insert the cache step before "Run mutation tests"**

In `.github/workflows/mutation.yml`, the steps currently go: checkout, pnpm
action-setup, setup-node, Install, then `- name: Run mutation tests`. Insert this
step immediately BEFORE `- name: Run mutation tests`:

```yaml
      - name: Cache Stryker incremental file
        # Evolving-cache pattern: the run_id key is unique so the primary key always
        # misses, forcing the post-step to SAVE the updated file; restore-keys
        # restores the most recent prior file. Not keyed on the lockfile on purpose:
        # Stryker self-heals an incompatible incremental file by rebuilding (one full
        # run), so binding the key to deps would force a needless full run on every
        # Dependabot bump. A cache miss (first run, or 7-day eviction) is a correct
        # full run that re-seeds the cache.
        uses: actions/cache@27d5ce7f107fe9357f9df03efb73ab90386fccae # v5.0.5
        with:
          path: .stryker-incremental.json
          key: stryker-incremental-${{ github.run_id }}
          restore-keys: |
            stryker-incremental-
```

- [ ] **Step 2: Verify the workflow YAML parses + the cache step is well-formed**

Run: `pnpm exec tsx -e "import {load} from 'js-yaml'; import {readFileSync} from 'fs'; const d=load(readFileSync('.github/workflows/mutation.yml','utf8')); const s=d.jobs.mutation.steps.find(x=>(x.uses||'').startsWith('actions/cache@')); console.log('cache step path:', s.with.path, '| key:', s.with.key);"`
Expected: `cache step path: .stryker-incremental.json | key: stryker-incremental-${{ github.run_id }}`

- [ ] **Step 3: Run the full test, confirm ALL cases PASS**

Run: `pnpm test --run __tests__/scripts/mutation-incremental-config.test.ts 2>&1 | tail -8`
Expected: all cases PASS (config + workflow).

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/mutation.yml
git commit -m "perf(mutation): cache the Stryker incremental file across weekly runs"
```

---

## Task 4: Local correctness check (file path + guard + clean tree)

**Files:**
- (none, verification only)

- [ ] **Step 1: Run a scoped mutation locally and confirm the incremental file lands at the pinned path**

Run: `pnpm exec stryker run --mutate 'lib/ip-hash.ts' >/tmp/inc1.log 2>&1; echo "exit $?"; ls -la .stryker-incremental.json; ls reports/stryker-incremental.json 2>/dev/null && echo "UNEXPECTED: default path also written" || echo "default path NOT used (correct)"`
Expected: exit 0, `.stryker-incremental.json` exists at repo root, `reports/stryker-incremental.json` does NOT exist. (Proves the `incrementalFile` override took effect, the core failure-mode #1 guard.)

- [ ] **Step 2: Confirm the de-masking guard still passes on the produced report**

Run:
```bash
node -e "const r=require('./mutation-report.json');const m=Object.values(r.files||{}).flatMap(f=>f.mutants||[]);const s=m.filter(x=>['Killed','Timeout','Survived','NoCoverage'].includes(x.status)).length;console.log(s===0?'GUARD WOULD FAIL':'GUARD PASSES - '+s+' scoreable')"
```
Expected: `GUARD PASSES - <n> scoreable` (the incremental report is complete).

- [ ] **Step 3: Confirm the incremental file is gitignored (working tree clean)**

Run: `git status --porcelain | grep -E 'stryker-incremental|mutation-report' || echo "clean (artifacts ignored)"`
Expected: `clean (artifacts ignored)`.

- [ ] **Step 4: Re-run scoped mutation and confirm it reuses the incremental file (local speed sanity)**

Run: `pnpm exec stryker run --mutate 'lib/ip-hash.ts' 2>&1 | grep -iE "incremental|reuse|Restored" | head -3 || echo "(no explicit incremental log line; not fatal)"`
Expected: Stryker logs that it reused the incremental result for unchanged mutants (or completes faster). Not a hard gate; the authoritative proof is the CI two-run in Task 5.

- [ ] **Step 5: Commit:** none (verification only; no file change).

---

## Task 5: CI payoff proof (two workflow_dispatch runs) + ADR

**Files:**
- Modify: `DECISIONS.md`

This task runs AFTER the branch is pushed (the workflow must exist on the branch to
dispatch it). It is the load-bearing proof, per the #154 precedent that a green job is
not proof; the recorded numbers are.

- [ ] **Step 1: Dispatch run 1 (cache miss, full run, seeds the cache)**

```bash
gh workflow run mutation.yml --ref perf/mutation-incremental-cache
```
Wait for completion (up to ~38 min). Record the job wall-clock (`started`/`completed`)
and confirm: conclusion success, the de-masking guard passed, a real score posted, and
the cache was SAVED (the run log shows "Cache saved with key: stryker-incremental-<run_id>").

- [ ] **Step 2: Dispatch run 2 (cache hit, incremental, fast)**

```bash
gh workflow run mutation.yml --ref perf/mutation-incremental-cache
```
Wait for completion. Confirm: the cache was RESTORED (log shows "Cache restored from key: stryker-incremental-..."), conclusion success, guard passed, score posted.

- [ ] **Step 3: Assert the quantified pass condition**

Compute run 2 wall-clock. **Pass condition (falsifiable, per the architect review):**
`run2 < 15 min` AND `run2 < 0.5 * run1`. If run 2 is NOT materially faster, STOP and
investigate (most likely the cache path did not match, i.e. failure-mode #1 regressed,
or restore-keys did not restore) rather than recording a false win.

- [ ] **Step 4: Record the ADR in `DECISIONS.md`**

Append to the top-most `## 2026-06-20` group (newest-first; do not disturb existing
entries). Use a hyphen, not an em dash, in any new heading (author convention), and fill
the two `<...>` wall-clock values with the real recorded numbers from Steps 1-3:

```markdown
- **2026-06-20** · **Stryker mutation runs go incremental + cached (weekly job sped up).** `stryker.config.mjs` sets `incremental: true` + `incrementalFile: '.stryker-incremental.json'` (overriding Stryker's `reports/stryker-incremental.json` default so the config, the `actions/cache` path, and `.gitignore` all name one file). `mutation.yml` caches that file with the evolving-cache pattern (`key: stryker-incremental-${{ github.run_id }}` + `restore-keys: stryker-incremental-`), so a run restores the prior file, Stryker re-tests only changed mutants, and the post-step saves the updated file. The report stays complete, so the score, the de-masking guard, and the weekly trend are unchanged. **Proven via two `workflow_dispatch` runs:** run 1 (cache miss, full) <run1> min; run 2 (cache hit, incremental) <run2> min. The cache is NOT keyed on the lockfile on purpose (Stryker self-heals an incompatible incremental file by rebuilding, so lockfile-keying would force a full run on every Dependabot bump for no correctness gain). Accepted failure mode: a 7-day GitHub cache eviction at the weekly boundary, or the first weekly run on `main` after merge, is a correct full run that re-seeds the cache. The `run_id`-suffixed cache entries are small (<5MB JSON) and rely on GitHub LRU; churn is negligible (~52/year). _Reversible: remove `incremental`/`incrementalFile`, the cache step, and the gitignore line; the job reverts to the full ~38 min weekly run. Non-blocking weekly job, nothing downstream depends on its runtime._
```

- [ ] **Step 5: Commit**

```bash
git add DECISIONS.md
git commit -m "docs(decisions): adr for mutation incremental + cache (with proof)"
```

---

## Failure-mode checklist (from inversion + architect review)

Each is covered by a task/step above; listed here so the reviewer can confirm coverage.

- [ ] **Cache path != Stryker's path (CRITICAL, silent no-speedup):** `incrementalFile` pinned to `.stryker-incremental.json`; Task 4 Step 1 asserts the file lands there and the default `reports/` path is NOT used.
- [ ] **`incremental` typo/commented:** Task 1 asserts it from the PARSED config, not a grep.
- [ ] **No actual speedup shipped unnoticed:** Task 5 Step 3 quantified pass condition (`run2 < 15min` AND `< 0.5*run1`); stop-and-investigate on failure.
- [ ] **Artifact committed:** gitignored (Task 2 Step 3); Task 4 Step 3 asserts a clean tree.
- [ ] **Partial incremental file after a hard Stryker failure:** self-correcting (content-hash keyed); a true runner crash still produces no report so the de-masking guard still fails. Documented in the cache-step comment + ADR.
- [ ] **Unbounded cache growth:** small `run_id`-keyed JSON, GitHub LRU; noted in the ADR.
- [ ] **`actions/cache` unpinned:** pinned to the repo-standard `@27d5ce7f... # v5.0.5`; Task 1 asserts the exact pin.
- [ ] **main re-seeds once post-merge:** the first weekly run on `main` is a cache miss (correct full run); noted in the ADR as an accepted failure mode.

## Self-Review

- **Spec coverage:** §2.1 -> Task 2; §2.2 -> Task 3; §2.3 -> Task 2 Step 3; §3 failure modes -> the checklist + Task 4; §4.1 config test -> Task 1; §4.2 payoff proof -> Task 5; §5 clarifications -> reflected in config/cache decisions; §7 reversibility -> ADR note. All covered.
- **Placeholder scan:** the only `<...>` tokens are the two wall-clock values in the ADR, which are intentionally filled from real recorded run times in Task 5 (a plan cannot know them in advance). No TBD/TODO.
- **Type/name consistency:** the path string `.stryker-incremental.json`, the cache key prefix `stryker-incremental-`, and the action pin `actions/cache@27d5ce7f107fe9357f9df03efb73ab90386fccae # v5.0.5` are identical across the test, config, workflow, and ADR.

## Out of scope (do not add)

- No change to `mutate` scope, thresholds, `continue-on-error`, the guard, cadence, or timeout.
- No keep-warm second trigger (the goal accepts occasional full runs).
- No blocking-gate promotion (still gated on the #153 3-run baseline precondition).
