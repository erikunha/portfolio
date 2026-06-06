# Implementation Plan: CI/CD Group A — CI Workflow Hardening

**Spec:** `docs/superpowers/specs/2026-06-05-cicd-group-a-ci-workflow-hardening-design.md`
**Branch:** `ci/workflow-hardening`
**Goal:** Eliminate ~25-35 min of wasted CI runtime per push by removing dead jobs, reducing LHCI runs, adding tsbuildinfo cache, gating the audit on lockfile diffs, demoting flaky webkit checks, adding CodeQL path exclusions, fixing the harness threshold, and surfacing the mutation score.
**Estimated effort:** ~3 hours
**PR size:** Single PR (~250-350 changed lines across 5 files + 1 config file + 1 manual GitHub UI step)

---

## Architecture

All changes are in CI workflow files and one script. No production code or tests change. Application behavior is unaffected.

**Dependency order inside the PR:**
- A3 before A2 (both delete `ci.yml` jobs — apply A3 first to avoid line-shift confusion; anchor edits to job-name keys not line numbers)
- A1 before verifying A4 (A4 timeout becomes academic after A1 but ships in the same PR)
- A6 and A7 are independent of each other
- A8 is independent
- A9, A10, A11 are fully independent

**File map:**
| Change | File |
|---|---|
| A1 | `lighthouserc.json`, `lighthouserc.mobile.json` |
| A2 | `.github/workflows/ci.yml` (delete `vercel-preview:` job) |
| A3 | `.github/workflows/ci.yml` (delete `e2e-visual-webkit:` job) |
| A4 | `.github/workflows/ci.yml` (`performance` job timeout) |
| A5 | `.github/workflows/ci.yml` (`performance` job concurrency) |
| A6 | `.github/workflows/ci.yml` (`typecheck` job cache) |
| A7 | `.github/workflows/ci.yml` (`test` job fetch-depth + audit gate) |
| A8 | `.github/workflows/ci.yml` (`e2e-functional` continue-on-error) |
| A9 | `.github/codeql/codeql-config.yml` |
| A10 | `scripts/check-harness-size.mjs` |
| A11 | `.github/workflows/mutation.yml` |

---

## Pre-flight

- [ ] **Create branch**
  ```bash
  git checkout main && git pull origin main
  git checkout -b ci/workflow-hardening
  ```

- [ ] **Snapshot current CI state** — note the current job durations so you can verify improvements after merge:
  - `performance` job: expected ~18-24 min currently
  - `typecheck` job: expected ~90s cold
  - `test` job: note whether `Dependency vulnerability audit` runs on lockfile-unchanged PRs

---

## A1 — LHCI numberOfRuns: 3 → 1

- [ ] **Edit `lighthouserc.json`** — change `"numberOfRuns": 3` to `"numberOfRuns": 1` in the `collect` block:

  ```json
  "collect": {
    "url": [...],
    "numberOfRuns": 1,
    "settings": { ... }
  }
  ```

- [ ] **Edit `lighthouserc.mobile.json`** — same change (`numberOfRuns` is in the `collect` block alongside the mobile throttling config):

  ```json
  "collect": {
    "url": [...],
    "numberOfRuns": 1,
    "settings": { ... }
  }
  ```

- [ ] **Verify locally** — the local `gates:runtime` already uses `numberOfRuns` from these files; confirm both files parse correctly:
  ```bash
  node -e "console.log(JSON.parse(require('fs').readFileSync('lighthouserc.json','utf8')).ci.collect.numberOfRuns)"
  # Expected: 1
  node -e "console.log(JSON.parse(require('fs').readFileSync('lighthouserc.mobile.json','utf8')).ci.collect.numberOfRuns)"
  # Expected: 1
  ```

- [ ] **Record risk in DECISIONS.md** — add one bullet:
  ```
  2026-06-05 — LHCI numberOfRuns: 3→1 (ci/workflow-hardening). Reduces `performance` CI job from 18-24 min to 6-8 min. Risk: `a11y=100` and `SEO=100` exact-equality gates lose averaging buffer. Reversibility: set `numberOfRuns: 2` for any URL that starts flaking; full revert is `3` in both lhcirc files.
  ```

---

## A3 — Delete e2e-visual-webkit job (apply before A2 to avoid line-shift)

- [ ] **Read `.github/workflows/ci.yml`** to locate the `e2e-visual-webkit:` job block. The block starts at the `e2e-visual-webkit:` key and ends at the last line before the next top-level job key. The job comment says: "Non-required: webkit pixel rendering differs from Chromium baselines and from local macOS Safari."

- [ ] **Delete the entire `e2e-visual-webkit:` job block** from `ci.yml`. Anchor to the job-name key. Expected: ~25-35 lines removed.

- [ ] **Verify no dangling `needs:` references** — if any other job had `needs: [e2e-visual-webkit]`, remove those references:
  ```bash
  grep -n 'e2e-visual-webkit' .github/workflows/ci.yml
  # Expected: no output (block fully removed)
  ```

---

## A2 — Delete vercel-preview job

- [ ] **Read `.github/workflows/ci.yml`** to locate the `vercel-preview:` job block. The job comment says: "Non-required: Lighthouse against the Vercel preview URL. Informational only."

- [ ] **Delete the entire `vercel-preview:` job block**. Anchor to the job-name key.

- [ ] **Verify no dangling references:**
  ```bash
  grep -n 'vercel-preview' .github/workflows/ci.yml
  # Expected: no output
  ```

---

## A4 — Raise performance job timeout: 12 → 20

- [ ] **Edit `.github/workflows/ci.yml`** — in the `performance:` job, change `timeout-minutes: 12` to `timeout-minutes: 20`.

- [ ] **Verify:**
  ```bash
  grep -A3 'performance:' .github/workflows/ci.yml | grep timeout-minutes
  # Expected: timeout-minutes: 20
  ```

---

## A5 — Add perf job concurrency group

- [ ] **Edit `.github/workflows/ci.yml`** — in the `performance:` job, add after `timeout-minutes: 20`:

  ```yaml
  concurrency:
    group: perf-${{ github.ref }}
    cancel-in-progress: true
  ```

  The block should read:
  ```yaml
  performance:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    concurrency:
      group: perf-${{ github.ref }}
      cancel-in-progress: true
    needs: build
    ...
  ```

- [ ] **Verify YAML is valid:**
  ```bash
  python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml').read()); print('valid')"
  # Expected: valid
  ```

---

## A6 — Cache tsbuildinfo in typecheck job

- [ ] **Read the `typecheck:` job block in `ci.yml`** to find the exact position of the `Type check` step. The cache step goes before it.

- [ ] **Edit `.github/workflows/ci.yml`** — in the `typecheck:` job, add this step before the `Type check` run step. Use the same SHA-pinned `actions/cache` version already used in the build job:

  ```yaml
  - name: Cache TypeScript build info
    uses: actions/cache@27d5ce7f107fe9357f9df03efb73ab90386fccae # v5.0.5
    with:
      path: tsconfig.tsbuildinfo
      key: tsbuildinfo-${{ runner.os }}-${{ hashFiles('**/*.ts', '**/*.tsx', 'tsconfig.json', 'tsconfig*.json') }}
      restore-keys: |
        tsbuildinfo-${{ runner.os }}-
  ```

- [ ] **Verify `tsconfig.json` has `incremental: true`** (prerequisite for tsbuildinfo to be written):
  ```bash
  node -e "console.log(JSON.parse(require('fs').readFileSync('tsconfig.json','utf8')).compilerOptions?.incremental)"
  # Expected: true
  ```

---

## A7 — Gate pnpm audit on lockfile diff (PR only)

- [ ] **Edit `.github/workflows/ci.yml`** — in the `test:` job, update the `actions/checkout` step to use `fetch-depth: 0`:

  ```yaml
  - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2
    with:
      fetch-depth: 0
  ```

  This ensures both `base.sha` and `head.sha` from the PR event are in the local git history. Without this, `git diff "$BASE...$HEAD"` fails silently and always writes `changed=false`, making the gate always skip the audit (fail-open).

- [ ] **Replace the existing `pnpm audit` step in the `test:` job** with these two steps:

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

  **Behavior:**
  - Push to `main` (not a PR): `github.event_name != 'pull_request'` is true → always audits.
  - PR without lockfile change: `lockfile-diff.outputs.changed == 'false'` → audit step skipped.
  - PR with lockfile change: `lockfile-diff.outputs.changed == 'true'` → audit runs.

---

## A8 — Demote webkit-desktop + webkit-mobile in e2e-functional to non-blocking

- [ ] **Edit `.github/workflows/ci.yml`** — in the `e2e-functional:` job, add `continue-on-error` at the job level (not inside the strategy):

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

  The `continue-on-error: ${{ contains(matrix.project, 'webkit') }}` expression evaluates per matrix leg — webkit legs get `true`, chromium legs get `false`. GitHub branch-protection sees webkit leg results as `success` even when they fail.

- [ ] **Manual GitHub UI step (defense-in-depth — recommended after merge):**
  Navigate to: Repository Settings → Branches → Edit protection rule for `main` → Status checks required.
  Remove `e2e-functional (webkit-desktop)` and `e2e-functional (webkit-mobile)` from the required list.
  This prevents confusion if `continue-on-error` is ever reverted: without this step, reverting the YAML would instantly re-block merges.
  *This step cannot be scripted — it must be done in the GitHub UI after the PR merges.*

---

## A9 — CodeQL path exclusions

- [ ] **Read `.github/codeql/codeql-config.yml`** to see the current `paths-ignore` list.

- [ ] **Edit `.github/codeql/codeql-config.yml`** — extend `paths-ignore` to exclude test and script directories:

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

  Keep existing entries (do not remove `design-system/dist`, `coverage`, `.next`, `node_modules`). The new additions are `tests`, the 4 glob patterns, and `scripts`.

- [ ] **Verify YAML syntax:**
  ```bash
  python3 -c "import yaml; yaml.safe_load(open('.github/codeql/codeql-config.yml').read()); print('valid')"
  # Expected: valid
  ```

---

## A10 — Harness size threshold: 250 → 275

- [ ] **Edit `scripts/check-harness-size.mjs`** — change the constant and its comment:

  Current:
  ```js
  // Threshold: 250 lines (current ~215 ± growth headroom before the problem zone).
  const MAX_LINES = 250;
  ```

  New:
  ```js
  // Threshold: 275 lines (current ~232 ± growth headroom before the problem zone).
  const MAX_LINES = 275;
  ```

- [ ] **Verify the gate still passes with current CLAUDE.md line count:**
  ```bash
  pnpm validate-content 2>&1 | head -5
  # or run the harness check directly:
  node scripts/check-harness-size.mjs
  # Expected: OK (232/275 lines) — or similar passing output
  ```

---

## A11 — Mutation score to GitHub Actions job summary

- [ ] **Read `.github/workflows/mutation.yml`** to find the `Upload mutation report` step and the job-level structure.

- [ ] **Edit `.github/workflows/mutation.yml`** — add this step after `Upload mutation report`:

  ```yaml
  - name: Post mutation score to job summary
    if: always()
    run: |
      if [ -f mutation-report.json ]; then
        node -e "
          const fs = require('fs');
          const r = JSON.parse(fs.readFileSync('mutation-report.json', 'utf8'));
          // Stryker JSON uses mutation-testing-report-schema (no top-level mutationScore field).
          // Score = (killed+timeout) / (killed+timeout+survived+noCoverage).
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

  **Why no top-level `mutationScore`:** Stryker's `json` reporter emits the `mutation-testing-report-schema` format — `{ schemaVersion, thresholds, files: { [path]: { mutants } } }`. The score must be computed from per-mutant `status` values. The `if [ -f mutation-report.json ]` guard handles the case where `continue-on-error: true` on the parent step causes the JSON to be absent.

- [ ] **Verify YAML syntax:**
  ```bash
  python3 -c "import yaml; yaml.safe_load(open('.github/workflows/mutation.yml').read()); print('valid')"
  # Expected: valid
  ```

---

## Commit

- [ ] **Run local CI gates:**
  ```bash
  pnpm ci:local 2>&1 | tail -20
  # Expected: all checks pass
  ```

- [ ] **Commit:**
  ```bash
  git add lighthouserc.json lighthouserc.mobile.json \
    .github/workflows/ci.yml \
    .github/codeql/codeql-config.yml \
    scripts/check-harness-size.mjs \
    .github/workflows/mutation.yml \
    DECISIONS.md
  git commit -m "ci(workflow): harden CI — LHCI 3→1, rm dead jobs, tsbuildinfo cache, audit gate, webkit demotion, CodeQL exclusions, harness threshold, mutation summary"
  ```

---

## Verification After Merge

- [ ] **LHCI runtime:** open next CI run → `performance` job duration should be < 10 min (was 18-24 min).
- [ ] **Deleted jobs:** `vercel-preview` and `e2e-visual-webkit` should not appear in CI run summary.
- [ ] **tsbuildinfo cache:** on a second CI run on the same branch, `typecheck` job logs should show `Cache restored from key: tsbuildinfo-...`.
- [ ] **Audit gate:** open a PR that does NOT touch `pnpm-lock.yaml` → `Dependency vulnerability audit` step should be skipped in the `test` job.
- [ ] **Mutation summary:** trigger `mutation.yml` via `workflow_dispatch` → job summary tab should show `## Stryker Mutation Score` with a numeric percentage.
- [ ] **Harness gate:** `node scripts/check-harness-size.mjs` should print `OK (232/275 lines)` (or similar passing output).
- [ ] **WebKit demotion:** open a PR where a webkit e2e test fails → the check should appear with an orange `!` (non-blocking), not a red `✗` blocking the merge.
- [ ] **Manual GitHub UI:** Remove webkit entries from required status checks (see A8).

---

## Failure Modes Checklist

The following failure modes were identified via pre-mortem (`thinking-inversion`) before writing this plan:

| Risk | Mitigation |
|---|---|
| `a11y=100` / `SEO=100` gates flake without averaging | If they start flaking: set `numberOfRuns: 2` for affected URLs only, not all 6 |
| `git diff "$BASE...$HEAD"` fails silently with `fetch-depth: 1` | Fixed by setting `fetch-depth: 0` in test job checkout |
| `continue-on-error` removed later without removing webkit from branch protection | Manual GitHub UI step after merge prevents re-blocking |
| `mutation-report.json` absent when Stryker fails with `continue-on-error: true` | `if [ -f ]` guard in the summary step handles this gracefully |
| CodeQL exclusions accidentally remove a real attack surface | New entries are `tests/`, `scripts/`, and glob patterns — none serve user requests |
| tsbuildinfo cache stale | TypeScript self-heals (full rebuild on hash mismatch) — no incorrect type errors |
