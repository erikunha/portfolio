# Mutation testing `--incremental` + cache design

- **Date:** 2026-06-20
- **Author:** Erik Cunha
- **Status:** approved (brainstorming), pending architect gate + plan

## 1. Context & goal

The weekly Stryker mutation job (`.github/workflows/mutation.yml`) became genuinely
live in #154 (the vitest runner now loads under pnpm; a de-masking guard fails the job
if the runner produced no score). A real full-scope run now executes the suite against
~1986 instrumented mutants across `app/api/**` + `lib/**` and takes ~38 min. #154's ADR
explicitly deferred a speedup: "Stryker `--incremental` + an `actions/cache` of the
incremental file would make steady-state weekly runs fast." This spec is that follow-up.

**Goal:** cut the *typical* weekly run from ~38 min to well under 15 min by re-testing
only the mutants in files that changed since the last run, while keeping the score, the
de-masking guard, and the trend signal identical. **Accept** an occasional full run when
the cache is unavailable (first run, or 7-day eviction). Correctness is never traded for
speed.

**Why the ROI is real here:** the mutated scope (`app/api/**` + `lib/**`) saw only ~4
commits in the last 14 days (squash-merges keep main low-churn), so on a typical week
incremental skips the large majority of the ~1986 mutants.

## 2. Design

Three small edits + one test. Net ~15 lines.

### 2.1 Enable incremental analysis (`stryker.config.mjs`)

Add `incremental: true`. Stryker writes `.stryker-incremental.json`, a map of source +
test file content hashes to per-mutant results. On the next run it re-tests only mutants
whose source (or a covering test) changed, reusing cached statuses for the rest. The JSON
report (`mutation-report.json`) still contains **all** mutants (cached + freshly tested),
so the posted score, the `scoreable > 0` de-masking guard, and the weekly trend are
unchanged. The flag also speeds local `pnpm test:mutation` runs (the file is gitignored).

### 2.2 Persist the incremental file across runs (`.github/workflows/mutation.yml`)

One SHA-pinned `actions/cache` step, placed before "Run mutation tests":

```yaml
- name: Cache Stryker incremental file
  uses: actions/cache@<sha-pinned> # v4
  with:
    path: .stryker-incremental.json
    key: stryker-incremental-${{ github.run_id }}
    restore-keys: |
      stryker-incremental-
```

This is the standard evolving-cache pattern: `github.run_id` is unique so the primary key
always misses (forcing a save at the post-step), and `restore-keys` restores the most
recent prior `stryker-incremental-*` cache. Each run thus restores last run's file,
Stryker updates it in place, and the post-step persists the updated file under a fresh key.

### 2.3 Gitignore the artifact (`.gitignore`)

Add `.stryker-incremental.json` alongside the existing `.stryker-tmp/` and
`mutation-report.*` entries (generated, never committed).

## 3. Correctness & failure modes

- **Cache miss** (first run ever, or 7-day GitHub eviction at the weekly boundary) →
  full ~38 min run, still correct, re-seeds the cache. The existing 120 min timeout covers it.
- **Staleness** is Stryker's responsibility: it hashes source + test files, so a changed
  test re-tests its mutants; a cached result cannot go silently stale.
- **Stryker version upgrade** that changes the incremental-file format → Stryker detects
  the incompatible file and rebuilds (one full run, self-healing). This is why the cache
  key is **not** bound to the lockfile (see Clarifications).
- **De-masking guard** (`scoreable > 0`, from #154) holds: an incremental report is still
  a complete report. A genuine runner crash still produces no report → guard still fails.

## 4. Testing & verification

1. **CI-config test** (mirroring `__tests__/scripts/lhci-ci-job.test.ts`): assert
   `stryker.config.mjs` sets `incremental: true`, and `mutation.yml` has the cache step
   with `path: .stryker-incremental.json`, a `github.run_id`-suffixed `key`, and the
   `stryker-incremental-` `restore-keys` prefix. An existence guard so the assertion can't
   silently pass on a renamed step.
2. **Payoff proof** (same `workflow_dispatch` discipline #154 established): dispatch the
   workflow twice on the branch. Run 1 = cache miss → full run, saves the cache. Run 2 =
   cache hit → materially faster, posts the same-shape score, guard passes. Record both
   wall-clock times in the ADR so the speedup is proven, not assumed.

## 5. Clarifications resolved

- Faster typical runs, or guarantee the cache never evicts? -> Faster typical runs,
  accept an occasional full run on the 7-day eviction boundary (simplest; correctness
  is unaffected either way).
- Key the cache on the lockfile (to bust on Stryker upgrades)? -> No; that would force a
  full run on every Dependabot bump. Stryker self-heals an incompatible incremental file
  by rebuilding, so a stable prefix + `run_id` suffix is both simpler and faster.
- Enable via the `--incremental` CLI flag or `incremental: true` in config? -> Config, so
  the intent is declarative, version-controlled, and applies to local runs too.
- Verify by configuration inspection alone, or prove the speedup? -> Prove it: two
  `workflow_dispatch` runs (miss then hit), wall-clock recorded, per the #154 precedent
  that a green job alone is not proof.

## 6. Out of scope

- No change to the `mutate` scope, thresholds, `continue-on-error`, the guard, or the
  weekly cadence (all settled in #153/#154).
- No keep-warm second trigger (rejected: the goal accepts occasional full runs).
- No blocking-gate promotion (still gated on the #153 baseline ADR's 3-run precondition).

## 7. Reversibility

Remove `incremental: true`, the cache step, and the gitignore line. No production impact;
the job reverts to the full ~38 min weekly run. Low blast radius (a non-blocking weekly CI
job; nothing downstream depends on its runtime).
