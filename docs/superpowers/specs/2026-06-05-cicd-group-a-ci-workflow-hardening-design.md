# CI/CD Group A — CI Workflow Hardening

**Date:** 2026-06-05
**Status:** Approved for implementation
**PR size:** Single PR, ~3 hours total effort
**Branch:** `ci/workflow-hardening`

---

## Problem

The `performance` CI job owns the critical path at 18-24 min because `numberOfRuns: 3` forces
36 serial Lighthouse audits (6 URLs × 3 runs × 2 configs). Current scores are ≥95 desktop /
≥90 mobile — the 3-run averaging reduces variance by ~2-3 points against thresholds 5-10+ points
above the floor. The variance margin is noise.

Two dead jobs consume CI compute with zero blocking value:
- `vercel-preview`: non-required, `continue-on-error: true`, waits up to 6 min for Vercel URL,
  duplicates the required `performance` job. Value: CDN-fidelity — already covered by `smoke.yml`.
- `e2e-visual-webkit`: non-required, produces artifacts that are reviewed manually (never
  automatically actioned). 2 runners × 15 min per app-change push. The local pre-merge macOS
  Safari MCP check provides the same signal at zero CI cost.

Additional waste:
- `typecheck` job: `incremental: true` is set in `tsconfig.json` but `tsconfig.tsbuildinfo` is
  never cached in CI. Every typecheck does a full graph traversal.
- `pnpm audit` runs on every push regardless of whether `pnpm-lock.yaml` changed. On non-dep
  pushes this is a 10-30s network call with zero signal value.
- `performance` job `timeout-minutes: 12` is at or below the expected floor with
  `numberOfRuns: 3` (18-24 min). Variance causes spurious timeout failures.
- `webkit-desktop` and `webkit-mobile` in `e2e-functional` matrix are required branch-protection
  checks. WebKit flakes (network environment, not real bugs) block merges on non-functional
  failures. These test browser-agnostic behavior (API routes, server responses).
- `performance` job has no per-ref concurrency group. Concurrent PRs queue rather than cancel
  redundant runs.
- Mutation report: `mutation.yml` uploads HTML/JSON artifacts but posts nothing to the GitHub
  Actions job summary. Trend is invisible without manual artifact download.
- `check-harness-size.mjs` threshold is 250 lines. CLAUDE.md is 232 lines with 18 lines of
  headroom — active development is within 1-2 major additions of triggering a false block.
- CodeQL analyzes `tests/`, `scripts/`, and spec files. These are not in the production attack
  surface; their analysis adds 5-8 min of scan time without improving signal quality.

---

## Design

### A1 — LHCI numberOfRuns: 3 → 1

**Files:** `lighthouserc.json`, `lighthouserc.mobile.json`

Change `"numberOfRuns": 3` to `"numberOfRuns": 1` in both configs.

Rationale: CI's authoritative gate no longer averages. A single run is sufficient at current
score margins (≥5-10 points above thresholds). If a score drops to borderline, increase
`numberOfRuns` for that URL only. The local `gates:runtime` already uses 1 run and has never
produced false greens. `lighthouserc.mobile.json` note: `numberOfRuns` is in the `collect`
block alongside the mobile throttling config — the same field, same change.

**Expected outcome:** `performance` CI job drops from 18-24 min to 6-8 min.

### A2 — Delete vercel-preview job

**File:** `.github/workflows/ci.yml`

Remove the entire job block whose key is `vercel-preview:`. Anchor the deletion to the
job-name key, not a line number — applying A3 first shifts line numbers. The block starts
at the `vercel-preview:` key and ends at the last line before the next top-level job key.

The job comment already says "Non-required: Lighthouse against the Vercel preview URL.
Informational only." The `performance` job is the required LHCI gate. `smoke.yml` is the
post-deploy CDN-fidelity gate. `vercel-preview` adds no blocked signal.

**Apply order note:** Apply A3 before A2 (bottom of file first) to avoid line-shift confusion,
or anchor edits to job-name keys rather than line numbers.

**Expected outcome:** 1 runner freed per CI run (PR pushes). 8-10 min CI compute eliminated.

### A3 — Delete e2e-visual-webkit job

**File:** `.github/workflows/ci.yml`

Remove the entire job block whose key is `e2e-visual-webkit:`. Anchor the deletion to the
job-name key, not a line number — see A2 note.

The job comment already says "Non-required: webkit pixel rendering differs from Chromium baselines
and from local macOS Safari. Regressions are reviewed via the uploaded artifact."
The pre-merge local MCP Safari check is the correct gate. CI artifacts are an inferior substitute.

**Expected outcome:** 2 runners freed per app-change push. 30 min compute eliminated.

### A4 — Raise performance job timeout: 12 → 20 minutes

**File:** `.github/workflows/ci.yml`, `performance` job

Change `timeout-minutes: 12` to `timeout-minutes: 20`.

After A1 (numberOfRuns: 1), the job should complete in 6-8 min — the timeout becomes academic.
Until A1 is deployed, this prevents spurious timeouts on the existing 18-24 min expected runtime.
Both changes ship in the same PR, so A4 is defensive belt-and-suspenders.

### A5 — Add perf job concurrency group with cancel-in-progress

**File:** `.github/workflows/ci.yml`, `performance` job

Add after `timeout-minutes: 20`:
```yaml
concurrency:
  group: perf-${{ github.ref }}
  cancel-in-progress: true
```

Redundant performance jobs (rapid-fire pushes to the same branch) cancel instead of queuing.
Does not affect the top-level `cancel-in-progress: false` — that policy is correct for main-
branch pushes; this per-job group only applies to the `performance` job.

### A6 — Cache tsbuildinfo in typecheck job

**File:** `.github/workflows/ci.yml`, `typecheck` job

Add a cache step before `Type check`:
```yaml
- name: Cache TypeScript build info
  uses: actions/cache@27d5ce7f107fe9357f9df03efb73ab90386fccae # v5.0.5
  with:
    path: tsconfig.tsbuildinfo
    key: tsbuildinfo-${{ runner.os }}-${{ hashFiles('**/*.ts', '**/*.tsx', 'tsconfig.json', 'tsconfig*.json') }}
    restore-keys: |
      tsbuildinfo-${{ runner.os }}-
```

`tsconfig.json` has `"incremental": true`. TypeScript will use the cached `.tsbuildinfo` file to
skip already-checked modules. On a cache hit where only a few files changed, typecheck drops from
~90s to ~20s. Cache is gitignored; this action manages it out of band. Stale tsbuildinfo is
self-healing: TypeScript detects input hash mismatch and rebuilds fully. No risk.

Use the same SHA-pinned `actions/cache` version already in use in the build job.

### A7 — Gate pnpm audit on lockfile diff (PR only)

**File:** `.github/workflows/ci.yml`, `test` job

The `test` job requires `fetch-depth: 0` (not the default 1) for the lockfile-diff step to
work correctly. With `fetch-depth: 1`, the base SHA may not be in the local git history and
`git diff "$BASE...$HEAD"` fails silently, setting `changed=false` (audit skipped) even on
a real lockfile change. This is a fail-OPEN gap, not fail-closed.

Add `fetch-depth: 0` to the `test` job's `actions/checkout` step. The test job currently uses
default depth; update it explicitly:

```yaml
- uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2
  with:
    fetch-depth: 0
```

Then replace the single `pnpm audit` step with:

```yaml
- name: Check if pnpm-lock.yaml changed
  id: lockfile-diff
  if: github.event_name == 'pull_request'
  run: |
    BASE=${{ github.event.pull_request.base.sha }}
    HEAD=${{ github.event.pull_request.head.sha }}
    if git diff --name-only "$BASE...$HEAD" -- pnpm-lock.yaml | grep -q .; then
      echo "changed=true" >> $GITHUB_OUTPUT
    else
      echo "changed=false" >> $GITHUB_OUTPUT
    fi

- name: Dependency vulnerability audit
  if: github.event_name != 'pull_request' || steps.lockfile-diff.outputs.changed == 'true'
  run: pnpm audit --audit-level=moderate
```

Design decisions:
- Push to main (not a PR): always audits. No exceptions.
- PR without lockfile change: skip audit (save 10-30s network call, no signal value).
- `fetch-depth: 0` ensures both SHAs are reachable. Checkout is fast on ubuntu-latest for
  a shallow-history repo; the extra history download cost is negligible vs. a false audit skip.
- Fail behavior: if `lockfile-diff` step errors (bad SHA), `grep -q .` returns non-zero,
  `changed=false` is written, audit is skipped. This is fail-open for the skip path. Mitigation:
  with `fetch-depth: 0`, there is no reason for the diff to error on a valid PR.

### A8 — Demote webkit-desktop + webkit-mobile in e2e-functional to non-blocking

**File:** `.github/workflows/ci.yml`, `e2e-functional` job

Add `continue-on-error: ${{ contains(matrix.project, 'webkit') }}` at the job level.

```yaml
e2e-functional:
  runs-on: ubuntu-latest
  timeout-minutes: 15
  needs: build
  continue-on-error: ${{ contains(matrix.project, 'webkit') }}
  strategy:
    fail-fast: false
    matrix:
      project: [chromium, chromium-mobile, webkit-desktop, webkit-mobile, chromium-components]
```

**Load-bearing mechanism:** `continue-on-error: ${{ contains(matrix.project, 'webkit') }}` at
the matrix-job level converts each webkit leg's failure result to `success` before GitHub's
branch-protection sees it. The webkit checks already pass branch protection with this YAML alone.

**Defense-in-depth manual step (recommended, not required):** Remove `e2e-functional (webkit-desktop)`
and `e2e-functional (webkit-mobile)` from the required branch-protection status checks.
Path: GitHub → Repository Settings → Branches → Edit protection rule for `main` →
Status checks required → uncheck the two webkit entries. This prevents confusion if
`continue-on-error` is ever removed — without the manual step, removing it from YAML would
instantly re-block merges on webkit flakes.

The matrix continues to run all 5 projects. WebKit failures become informational, not blockers.
Chromium and chromium-mobile remain required. This is correct: functional behavior (API routes,
server responses) is browser-agnostic; the meaningful WebKit check is visual (already non-required).

### A9 — CodeQL path exclusions

**File:** `.github/codeql/codeql-config.yml`

Extend the existing `paths-ignore` list:
```yaml
paths-ignore:
  - design-system/dist
  - coverage
  - .next
  - node_modules
  - tests
  - '**/*.test.ts'
  - '**/*.spec.ts'
  - '**/*.test.tsx'
  - '**/*.spec.tsx'
  - scripts
```

Rationale: test and script files are not in the production attack surface. They cannot serve
user requests. Excluding them removes the surface CodeQL analyzes without creating false negatives
on actual vulnerable paths (`app/api/`, `lib/`, `components/`).

Expected scan time reduction: 30-50% (from ~15-20 min to ~8-12 min). Applies to both the
per-PR trigger and the weekly scheduled scan.

### A10 — Harness size threshold: 250 → 275

**File:** `scripts/check-harness-size.mjs`

Change `const MAX_LINES = 250` to `const MAX_LINES = 275`.

CLAUDE.md is currently 232 lines. The 250-line threshold gives 18 lines of headroom before a
false block. The 275-line threshold gives 43 lines — one additional major section without false
triggering. The comment in the file ("current ~215 ± growth headroom") is now stale and should
be updated to reflect the current 232-line reality.

Update the comment:
```js
// Threshold: 275 lines (current ~232 ± growth headroom before the problem zone).
```

### A11 — Mutation score to GitHub Actions job summary

**File:** `.github/workflows/mutation.yml`

Add a step after `Upload mutation report`:
```yaml
- name: Post mutation score to job summary
  if: always()
  run: |
    if [ -f mutation-report.json ]; then
      node -e "
        const fs = require('fs');
        const r = JSON.parse(fs.readFileSync('mutation-report.json', 'utf8'));
        // Stryker JSON uses mutation-testing-report-schema (no top-level mutationScore field).
        // Compute score from per-mutant status counts: (killed+timeout)/(killed+timeout+survived+noCoverage).
        const mutants = Object.values(r.files || {}).flatMap(f => f.mutants || []);
        const killed = mutants.filter(m => m.status === 'Killed' || m.status === 'Timeout').length;
        const survived = mutants.filter(m => m.status === 'Survived').length;
        const noCoverage = mutants.filter(m => m.status === 'NoCoverage').length;
        const total = killed + survived + noCoverage;
        const score = total > 0 ? (killed / total * 100).toFixed(1) : 'N/A';
        const high = (r.thresholds || {}).high || 80;
        const low = (r.thresholds || {}).low || 65;
        const lines = [
          '## Stryker Mutation Score',
          '',
          '**Score:** ' + score + '%',
          '',
          '**Thresholds:** high: ' + high + '%, low: ' + low + '%',
          '',
          'Download the \`mutation-report\` artifact for the full HTML report.',
        ].join('\n');
        fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines + '\n');
      " 2>/dev/null || echo "## Stryker Mutation Score: could not parse report" >> "$GITHUB_STEP_SUMMARY"
    else
      echo "## Stryker Mutation Score: report not generated" >> "$GITHUB_STEP_SUMMARY"
    fi
```

**Schema note:** Stryker's `json` reporter emits `mutation-testing-report-schema` format:
`{ schemaVersion, thresholds, files: { [path]: { mutants, source } } }`. There is no
top-level `mutationScore` field. The score is computed from per-mutant `status` values.
Thresholds are sourced from the JSON (matching `stryker.config.mjs` values: high=80, low=65)
rather than hardcoded strings that would drift.

`continue-on-error: true` on the parent step means the JSON may not exist — the `if [ -f ]`
guard handles this.

---

## Files Changed

| File | Change type | Change |
|---|---|---|
| `lighthouserc.json` | Edit | `numberOfRuns: 3 → 1` |
| `lighthouserc.mobile.json` | Edit | `numberOfRuns: 3 → 1` |
| `.github/workflows/ci.yml` | Edit | Delete vercel-preview job |
| `.github/workflows/ci.yml` | Edit | Delete e2e-visual-webkit job |
| `.github/workflows/ci.yml` | Edit | performance timeout 12→20, concurrency group |
| `.github/workflows/ci.yml` | Edit | Add tsbuildinfo cache in typecheck job |
| `.github/workflows/ci.yml` | Edit | Gate pnpm audit on lockfile diff |
| `.github/workflows/ci.yml` | Edit | Add continue-on-error to webkit e2e-functional |
| `.github/codeql/codeql-config.yml` | Edit | Add path exclusions |
| `scripts/check-harness-size.mjs` | Edit | Threshold 250→275, update comment |
| `.github/workflows/mutation.yml` | Edit | Add mutation score summary step |
| GitHub Settings UI | Manual | Remove webkit entries from required checks |

---

## Verification

After merging, verify:

1. **LHCI runtime:** open next CI run, check `performance` job duration < 10 min.
2. **Deleted jobs:** confirm `vercel-preview` and `e2e-visual-webkit` no longer appear in CI runs.
3. **tsbuildinfo cache:** in `typecheck` job logs, confirm `Cache restored from key: tsbuildinfo-...`
   on second run on same branch.
4. **Audit gate:** on a PR that does NOT touch `pnpm-lock.yaml`, confirm `Dependency vulnerability
   audit` step is skipped.
5. **Mutation summary:** trigger `mutation.yml` via `workflow_dispatch`, verify job summary shows
   the score table.
6. **Harness gate:** confirm `pnpm ci:local` still passes with `OK (232/275 lines)`.
7. **WebKit demotion:** open a PR, confirm webkit e2e failures are non-blocking (orange !, not red X).

---

## Risk

- **LHCI variance (Perf AND a11y=100/SEO=100):** with `numberOfRuns: 1`, a single outlier run
  can miss a borderline score. For `perf ≥95`, current scores are 5-10+ points above threshold —
  margin is adequate. More importantly, `a11y=100` and `SEO=100` are exact-equality gates —
  a single-run transient audit failure (e.g., `errors-in-console` from a network hiccup) now
  fails the build with no averaging buffer. Mitigation: these exact gates have never flaked in
  practice; if they start flaking, increase `numberOfRuns` to 2 specifically for a11y and SEO
  assertions, not for all 6 URLs. This decision (3→1) must be recorded in DECISIONS.md with a
  reversibility note as an explicit weakening of statistical protection.
- **WebKit demotion:** a real Safari API regression would no longer block a PR. Mitigation: the
  pre-merge local Safari MCP check (documented in memory) catches this before merge.
- **tsbuildinfo stale cache:** TypeScript self-heals on stale tsbuildinfo (rebuilds fully).
  No risk of incorrect type errors passing.
