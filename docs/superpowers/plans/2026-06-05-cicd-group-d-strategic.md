# Implementation Plan: CI/CD Group D — Strategic Improvements

**Spec:** `docs/superpowers/specs/2026-06-05-cicd-group-d-strategic-design.md`
**Branch:** Per sub-item (see below)
**Goal:** Research, evaluate, and decide on 4 strategic improvements: external visual testing (Argos CI), Vercel build cache audit, Playwright workers go/no-go, and CI-integrated Copilot review request.
**Prerequisite:** Groups A, B, C merged and validated before beginning D2. D1, D3, D4 can begin immediately.
**Effort:** Research tasks first (ADR-locked), then implementation PRs only if go-decision is confirmed.

---

## Overview

Group D items require evidence before code. Each sub-item follows this protocol:
1. **Research phase** — probe the system, gather measurements
2. **ADR decision** — write DECISIONS.md entry, make explicit go/no-go
3. **Implementation PR** — only if go-decision is made

No implementation code is written before the ADR is written and the go-decision is confirmed.

**Sub-item independence:**
| Sub-item | Branch | Prerequisite |
|---|---|---|
| D1 — Argos CI evaluation | `ci/argos-eval` | None |
| D2 — Build cache audit | `ci/build-cache-audit` | Group A merged (LHCI timing changes affect baseline) |
| D3 — Playwright workers | `ci/playwright-workers` | None |
| D4 — Copilot review request | `ci/copilot-review` | None |

---

## D1 — External Visual Testing Service (Argos CI)

**Problem being solved:** Darwin vs Linux rendering divergence requires dual-baseline maintenance. A visual-affecting CSS change adds 20-30 min of PNG regen ceremony per PR. Binary merge conflicts occur when two PRs both change CSS.

**Recommended candidate:** Argos CI (first-party `@argos-ci/playwright` adapter, free tier: 5000 screenshots/month, 250 CI runs of coverage).

### D1.1 — Create Argos account and install package

- [ ] **Create a free Argos CI account** at `argos-ci.com`. Use the existing GitHub OAuth flow to link to the `erik-portifolio` repository.

- [ ] **Get `ARGOS_TOKEN`** from the Argos dashboard (Settings → Token).

- [ ] **Add `ARGOS_TOKEN` to GitHub repo secrets:**
  ```bash
  gh secret set ARGOS_TOKEN --body "<token-from-argos-dashboard>"
  # Verify:
  gh secret list | grep ARGOS_TOKEN
  ```

- [ ] **Install `@argos-ci/playwright`:**
  ```bash
  pnpm add -D @argos-ci/playwright
  # Verify:
  cat package.json | node -e "const d=require('/dev/stdin'); console.log(d.devDependencies?.['@argos-ci/playwright'] ?? 'NOT FOUND')"
  ```

### D1.2 — Integrate Argos into e2e-visual-chromium CI job

- [ ] **Read `.github/workflows/ci.yml`** to find the `e2e-visual-chromium:` job. Identify the `--update-snapshots` step.

- [ ] **Create branch:**
  ```bash
  git checkout main && git pull origin main
  git checkout -b ci/argos-eval
  ```

- [ ] **Edit the `e2e-visual-chromium:` job in `.github/workflows/ci.yml`** — replace the `--update-snapshots` step with an Argos upload step. The exact change depends on whether Argos uploads during the test run or as a post-test step. Typical pattern:

  ```yaml
  - name: Run visual regression tests and upload to Argos
    env:
      ARGOS_TOKEN: ${{ secrets.ARGOS_TOKEN }}
    run: pnpm playwright test tests/visual --project=e2e-visual-chromium
  ```

  The `@argos-ci/playwright` package hooks into Playwright's reporter and uploads automatically when `ARGOS_TOKEN` is set. Read the `@argos-ci/playwright` docs to confirm the exact integration pattern.

- [ ] **Update `playwright.config.ts`** to add the Argos reporter alongside the existing reporter:
  ```typescript
  import { ArgosReporter } from '@argos-ci/playwright';

  // In the config:
  reporter: [
    ['list'],
    ...(process.env.ARGOS_TOKEN ? [[ArgosReporter]] : []),
  ],
  ```

### D1.3 — Test on a real PR (decisive criterion)

- [ ] **Open a test PR** that makes a trivial CSS change (e.g., a comment in `app/css/theme.css`).

- [ ] **Run the visual CI job** and confirm:
  - Argos PR comment appears on the PR with diff thumbnails
  - The CI job passes (Argos upload succeeds)

- [ ] **Run the visual tests locally from macOS:**
  ```bash
  ARGOS_TOKEN="<token>" pnpm playwright test tests/visual --project=e2e-visual-chromium
  ```
  Confirm: the local macOS run does NOT trigger spurious diffs vs. the CI baseline.
  **This is the decisive criterion.** If the local macOS run produces diffs against Argos's CI-captured baseline, the environment-isolation win is NOT achieved and Argos does not solve the dual-baseline problem.

### D1.4 — ADR and go/no-go decision

- [ ] **Write DECISIONS.md entry** (only after D1.3 results are in):
  ```
  2026-06-05 — [DECISION] External visual testing service: [Argos CI / Percy / rejected].
  Reason: [decisive criterion result from D1.3]. Alternatives: Percy ($599/month team tier, overkill), Chromatic (requires Storybook, not used). Reversibility: committed PNGs can be restored from git history (git show HEAD:<path>/<file>.png > restored.png).
  ```

- [ ] **If go-decision: remove committed PNG baselines:**
  Only after Argos is confirmed working in CI and locally:
  ```bash
  git rm tests/visual/visual.spec.ts-snapshots/*.png
  git commit -m "ci(visual): migrate baselines to Argos CI — remove committed PNGs"
  ```

- [ ] **If no-go:** close the branch, write the rejection reason in DECISIONS.md, and document why the dual-baseline ceremony is acceptable or how it will be managed differently.

---

## D2 — Vercel Remote Build Cache Audit

**Problem being solved:** The `build` CI job takes 6-8 min cold. The existing `actions/cache` for `.next/cache` has `restore-keys` fallback tiers. The question is whether the warm-cache path is actually firing and reducing build time.

**Prerequisite:** Group A must be merged first (LHCI timing changes affect the CI critical path, and D2 is about the build job specifically).

### D2.1 — Baseline measurement

- [ ] **Create branch:**
  ```bash
  git checkout main && git pull origin main
  git checkout -b ci/build-cache-audit
  ```

- [ ] **Push a source-change commit** (not lockfile, not CI config — something in `app/` or `components/`):
  ```bash
  # Make a trivial source change (e.g., add and remove a comment in any component)
  git add -u
  git commit -m "ci(build-cache-audit): trivial source change for cache measurement"
  git push
  ```

- [ ] **In the GitHub Actions run for that push:**
  - Open the `build` job
  - Find the `Cache Next.js build` step
  - Check whether it says "Cache restored from key: nextjs-..." (partial match = warm-cache hit via `restore-keys`)
  - Or "Cache not found" (cold build)
  - Record the **build job duration** in seconds

- [ ] **Push a second source-change commit** (another trivial change):
  ```bash
  git add -u
  git commit -m "ci(build-cache-audit): second trivial source change"
  git push
  ```
  - Record whether the second run shows a warm-cache restore
  - Record the build duration

### D2.2 — Evaluate the result

- [ ] **Decision rule:**
  - If the `restore-keys` warm-cache fires in >70% of source-change pushes AND build time is < 4 min (was 6-8 min cold): **cache is working. No action needed.** Record in DECISIONS.md.
  - If the cache always misses (no restore-key hit) or build time stays at 6-8 min: **investigate why restore-keys aren't effective.** Common causes: cache key too broad (lockfile hash always changes), cache key too narrow (app content hash always busts), or `.next/cache` format incompatible with the cache action version.
  - If there IS a gap: implement the fix (cache key adjustment or Turborepo remote cache investigation).

### D2.3 — ADR

- [ ] **Write DECISIONS.md entry** (after D2.2 measurement):
  ```
  2026-06-05 — Build cache audit (ci/build-cache-audit). Measured warm-cache hit rate: [X%]. Build time with warm cache: [Xs] (vs [Ys] cold). [Decision: no action / fix cache key / investigate Turborepo]. Reversibility: remove the cache step from the build job (build goes back to cold every run).
  ```

---

## D3 — Playwright Workers: 1 → 2 (Go/No-Go)

**Problem being solved:** Each e2e-functional matrix leg runs with 1 Playwright worker. Increasing to 2 would reduce tail-latency per leg ~35%. However, the 5 matrix legs already run in parallel — the wall-clock CI wait is determined by the slowest leg. The gain is tail-latency only (~15 min → ~10 min per leg, ~5 min off the CI critical path).

**Pre-decision required:** The cost/benefit is thin. An explicit go/no-go must be made before writing any code.

### D3.1 — Shared-state audit

- [ ] **Create branch:**
  ```bash
  git checkout main && git pull origin main
  git checkout -b ci/playwright-workers
  ```

- [ ] **Run the shared-state audit:**
  ```bash
  grep -rni 'localStorage\|sessionStorage\|document\.cookie\|indexedDB' \
    tests/e2e/ tests/a11y/
  # Expected: no output (no shared browser storage state)

  find design-system -name '*.e2e.ts' -exec grep -Hin \
    'localStorage\|sessionStorage\|POST\|mutation' {} + 2>/dev/null
  # Expected: no results, or only stateless POST assertions
  ```

- [ ] **Review each test file for DOM mutation:**
  - `tests/e2e/observability-smoke.spec.ts` — reads `/api/healthz`, stateless
  - `tests/e2e/cross-cutting.spec.ts` — reads various routes, stateless
  - `tests/a11y/axe.spec.ts` — reads DOM, stateless
  - `design-system/**/*.e2e.ts` — check each for `page.evaluate()` that mutates shared state

- [ ] **Confirm port 3000 conflict safety:** in CI, Upstash Redis credentials are not present → API routes that use Redis fail-open (no shared state to conflict between parallel workers).

### D3.2 — Go/no-go decision

- [ ] **Make the explicit decision** (do not skip this step):

  **Go if:** All of the following are true:
  - Shared-state audit finds no conflicts
  - The 5 min tail-latency reduction is valued (e.g., the slowest leg consistently blocks the CI wait)
  - Flaky-test risk is acceptable (parallel tests are more sensitive to timing)

  **No-go if:** Any shared state found, OR the tail-latency gain is judged insufficient for the flaky-test risk.

  **The wall-clock CI wait is UNCHANGED** (matrix legs already run in parallel). Only per-leg tail latency changes. State this explicitly in the ADR.

### D3.3 — Implementation (only if go-decision)

- [ ] **Edit `playwright.config.ts`** — change workers:
  ```typescript
  workers: process.env.CI ? 2 : undefined,
  ```

- [ ] **If any test files have shared state:** add serial mode to those groups:
  ```typescript
  test.describe.configure({ mode: 'serial' });
  ```

- [ ] **Push and observe CI** — confirm no new test failures in any e2e-functional matrix leg.

### D3.4 — ADR

- [ ] **Write DECISIONS.md entry:**
  ```
  2026-06-05 — Playwright workers: 1→2 audit (ci/playwright-workers). Shared-state audit result: [clean / found: X]. Decision: [go/no-go]. Reason: [tail-latency gain / flaky-test risk]. Wall-clock CI wait: unchanged (matrix legs parallel). Reversibility: set workers back to 1 in playwright.config.ts.
  ```

---

## D4 — CI-Integrated Copilot Review Request

**Problem being solved:** Copilot auto-triggers on PR open inconsistently. The developer manually checks whether Copilot triggered. A CI step that programmatically requests a Copilot review on PR open makes the trigger reliable and traceable.

**Task zero:** Verify the correct GitHub API reviewer identity before writing any CI YAML. The `[bot]` suffix is a display form — the API login may differ.

### D4.1 — Verify Copilot reviewer identity (task zero)

- [ ] **Create branch:**
  ```bash
  git checkout main && git pull origin main
  git checkout -b ci/copilot-review
  ```

- [ ] **Open a test PR** (or use any open PR):
  ```bash
  gh pr list --state open | head -3
  ```

- [ ] **Probe the API with `Copilot` login:**
  ```bash
  gh api repos/erikhunha/erik-portifolio/pulls/<pr_number>/requested_reviewers \
    --method POST \
    --field 'reviewers[]=Copilot'
  ```
  Expected outcomes:
  - **200/201:** `Copilot` is the correct login — use this in the CI YAML.
  - **422:** Try `copilot-pull-request-reviewer`:
    ```bash
    gh api repos/erikhunha/erik-portifolio/pulls/<pr_number>/requested_reviewers \
      --method POST \
      --field 'reviewers[]=copilot-pull-request-reviewer'
    ```
  - **422 again:** The API-based reviewer request may not be available for Copilot. Document as a known limitation; the passive auto-trigger is the fallback.

- [ ] **Record the correct login** (or the failure mode) before proceeding. Do not guess — a wrong login creates a 422 error on every PR open.

### D4.2 — Write CI job (only if API call succeeded)

- [ ] **If API call succeeded:** Edit `.github/workflows/ci.yml` — add this new job:

  ```yaml
  copilot-review-request:
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request' && github.event.action == 'opened'
    permissions:
      contents: read
      pull-requests: write
    timeout-minutes: 2
    steps:
      - name: Request Copilot review
        uses: actions/github-script@60a0d83039c74a4aee543508d2ffcb1c3799cdea # v7.0.1
        with:
          script: |
            await github.rest.pulls.requestReviewers({
              owner: context.repo.owner,
              repo: context.repo.repo,
              pull_number: context.issue.number,
              reviewers: ['<confirmed-login-from-D4.1>'],
            });
            core.info('Copilot review requested on PR #' + context.issue.number);
  ```

  Replace `<confirmed-login-from-D4.1>` with the confirmed login (e.g., `Copilot` or `copilot-pull-request-reviewer`).

  **Design decisions:**
  - `action == 'opened'` only (not `synchronize`): re-requesting on every push creates noise. The existing `feedback_copilot_rerequest_discipline` memory governs re-requests manually.
  - Non-required status check: this job must NOT be added to branch protection required checks — Copilot availability is a third-party dependency.
  - No new secrets: uses `GITHUB_TOKEN` with `pull-requests: write` permission.

- [ ] **If API call failed (422 on both logins):** document in DECISIONS.md and close the branch. The passive auto-trigger (Copilot triggers on PR open automatically) is the fallback. No CI YAML change needed.

### D4.3 — Verify on a real PR

- [ ] **Open a new test PR** after merging the `copilot-review-request` job.
- [ ] **Confirm:** within ~2 min of PR open, Copilot review appears automatically without manual intervention.
- [ ] **Confirm:** the `copilot-review-request` CI job appears in the Actions tab for the PR.

### D4.4 — ADR

- [ ] **Write DECISIONS.md entry:**
  ```
  2026-06-05 — CI-integrated Copilot review request (ci/copilot-review). API probe result: [Copilot / copilot-pull-request-reviewer / 422-both]. Decision: [implemented / fallback-to-passive]. Job fires on action=opened only (not synchronize — re-request discipline is manual per memory). Non-required status check. Reversibility: delete the copilot-review-request job from ci.yml.
  ```

---

## Group D Summary Checklist

| Sub-item | Research done | ADR written | Go-decision | Implementation PR |
|---|---|---|---|---|
| D1 — Argos CI | [ ] | [ ] | [ ] | [ ] |
| D2 — Build cache audit | [ ] | [ ] | [ ] | [ ] |
| D3 — Playwright workers | [ ] | [ ] | [ ] | [ ] |
| D4 — Copilot review | [ ] | [ ] | [ ] | [ ] |

**Rule:** No implementation PR is opened until the ADR is written and the go-decision is confirmed. The research tasks are the deliverable for this cycle.

---

## Failure Modes Checklist

| Risk | Mitigation |
|---|---|
| D1: Argos local macOS run produces spurious diffs (decisive criterion fails) | Do not migrate. Percy or committed PNGs remain the approach. |
| D1: Free tier (5000 screenshots/month) exceeded | 250 CI runs/month coverage. Monitor Argos dashboard. |
| D2: warm-cache always misses | Investigate cache key construction; consider lockfile-hash-only key |
| D3: parallel Playwright tests flake on shared state | Audit finds state; add `test.describe.configure({ mode: 'serial' })` or keep workers: 1 |
| D4: API returns 422 on both login attempts | Fallback: passive auto-trigger (already works). Document in ADR. |
| D4: Copilot requests on `synchronize` event (regression) | Job only fires on `action == 'opened'` — synchronize events don't match the condition |
