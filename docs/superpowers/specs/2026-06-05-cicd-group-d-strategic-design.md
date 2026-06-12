# CI/CD Group D — Strategic Improvements (Design Phase)

**Date:** 2026-06-05
**Status:** Design docs — no implementation code this cycle
**Effort:** Research/evaluation, not sprint-sized implementation
**Prerequisite:** Groups A, B, C merged and validated first

---

## Overview

These 3 items require vendor evaluation, configuration research, or spec audit work before
implementation. This document captures the design questions for each. Implementation PRs will
follow after each sub-item's research is complete and an ADR is written.

---

## D1 — External Visual Testing Service

### Problem

Visual regression baselines are stored as committed PNGs in `tests/visual/visual.spec.ts-snapshots/`.
This creates recurring friction:
- Darwin vs Linux rendering divergence: local baselines differ from CI baselines by 1-3px.
  Both must be maintained.
- Regen ceremony: changing CSS requires regenerating PNGs, inspecting each, committing binaries.
  A visual-affecting change adds 20-30 min of ceremony per PR.
- Binary merge conflicts: when two PRs both change CSS, the PNG conflicts are unresolvable
  without re-running the full regen cycle.

### Research Required

Evaluate 3 candidates:

**Argos CI** (`argos-ci.com`)
- Free tier: 5000 screenshots/month
- Setup: `@argos-ci/playwright` package + API token
- Integration: replace `--update-snapshots` workflow with Argos upload step
- Cost at scale: $30/month (50K screenshots)

**Percy** (`percy.io`)
- BrowserStack product
- Free tier: 5000 screenshots/month
- Setup: `@percy/playwright` package + `PERCY_TOKEN`
- Integration: Percy captures screenshots, stores baseline, shows diff in PR UI
- Cost at scale: $599/month at team tier (overkill)

**Chromatic** (`chromatic.com`)
- Storybook-native (Storybook not used here — extra setup complexity)
- Free tier: 5000 snapshots/month
- Less natural fit for Playwright-native projects

### Decision Criteria

1. **Controlled environment (decisive):** Does the service capture and compare in its own
   controlled Linux environment, eliminating the darwin-vs-linux dual-baseline problem entirely?
   For Argos/Percy: yes — they capture headlessly in their CI runner, not on the developer's Mac.
   Confirm this explicitly in step 4 by checking whether a darwin-captured local run triggers
   a diff versus their stored baseline. If not: the dual-baseline problem is solved.
2. Playwright integration quality: Argos has a first-party `@argos-ci/playwright` adapter.
   Percy has `@percy/playwright`. Chromatic requires storybook.
3. Free tier coverage: current visual suite takes ~20 screenshots per run (4 sections × 4 viewport
   combos ≈ likely fewer). 5000/month is 250 CI runs of coverage — adequate.
4. PR integration: does it post a PR comment with diff thumbnails?

**Recommended evaluation path:**
1. Create an Argos account (free tier).
2. Install `@argos-ci/playwright`, set `ARGOS_TOKEN` in repo secrets.
3. Replace `--update-snapshots` in `e2e-visual-chromium` job with Argos upload.
4. Run on a real PR AND run locally from macOS. Confirm: (a) Argos PR comment appears,
   (b) the local macOS run does NOT trigger spurious diffs vs. the CI baseline — this is
   the decisive criterion confirming the environment-isolation win.
5. If satisfactory: migrate `e2e-visual-webkit` to Argos as well (webkit baselines in Argos,
   not CI artifacts).
6. Remove all committed PNG baselines from git after migration is confirmed working.

### ADR Template

Before implementation, write `DECISIONS.md` entry:
- Date, decision, alternatives considered, why Argos (or Percy), reversibility note.
- Reversibility: committed PNGs can be restored from git history if the service goes away.

---

## D2 — Vercel Remote Build Cache

### Problem

The `build` CI job takes 6-8 min (cold). With Vercel's remote build cache, the Next.js `.next/cache`
directory is shared across deployments and CI branches. When the module graph hasn't changed
(only test files, docs, or CI config changed), the build completes in 1-2 min (cache hit).

### Research Required

**Prerequisites:**
- Vercel Pro plan is confirmed (`$20/month`).
- Remote caching: Vercel docs suggest this works through Turborepo's remote cache API or
  directly through the Vercel CLI's build cache.

**Configuration options to evaluate:**

**Option A: Turborepo Remote Cache via Vercel**
Requires adding Turborepo to the project. Overkill for a single-package app.

**Option B: actions/cache with Vercel-aware cache key**
The `build` job already has:
```yaml
- name: Cache Next.js build
  uses: actions/cache@...
  with:
    path: .next/cache
    key: nextjs-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml') }}-${{ hashFiles('app/**', 'components/**', ...) }}
```
This is the correct pattern. The cache is already configured.

**Question:** Is the existing `actions/cache` for `.next/cache` sufficient, or is Vercel's
remote build cache a separate/additional mechanism?

**Corrected premise:** The existing `build` job already has `restore-keys` fallback tiers
(`.github/workflows/ci.yml:274-281`). With `restore-keys`, a push that changes source files
does NOT fully bust the cache — Next.js receives a warm `.next/cache` from the nearest
prior cache. This is already functional incremental caching. The binary "hit or miss" framing
in the D2 problem statement is wrong.

**Revised research task:** Measure the INCREMENTAL build time when the `restore-keys` warm-cache
path fires (not the exact-key hit path — that requires an identical source hash). Steps:
- Push a source change (not lockfile, not CI config).
- Check `build` job for "Cache restored from key: nextjs-${{ runner.os }}-..." (partial match).
- Observe the build duration. If it is meaningfully faster than a cold build (6-8 min → < 4 min),
  the warm-cache is working. If it is roughly the same as cold, the restore-keys are not effective
  and investigation is needed.

**Success metric (corrected):** Build job shows a `restore-keys` warm-start in >70% of pushes
that don't change `pnpm-lock.yaml`. Wall-clock build time with warm cache < 4 min.

### ADR Template

Write DECISIONS.md entry after the baseline measurement confirms the gap (if any).

---

## D3 — Playwright Workers: 1 → 2

### Problem

Each `e2e-functional` matrix job and `e2e-visual-chromium` job runs Playwright with the default
1 worker (or `process.env.CI ? 1 : undefined`). Increasing to 2 workers would reduce test
runtime ~35% for jobs with many test files.

### Research Required

**Shared state audit:** Identify all test files that could conflict under parallel execution:

**State shared between tests:**
- `port 3000`: all tests hit the same server. Stateless GET requests are safe. POST requests
  to `/api/contact` or `/api/ask` could conflict if they share Upstash Redis state. In CI,
  Redis is not connected (no Redis credentials) — the routes fail-open. No conflict.
- Visual regression screenshots: Playwright serializes visual comparisons internally. Safe.
- `test-results/` directory: Playwright uses unique paths per test. Safe.

**Potential conflicts to verify:**
- `tests/e2e/observability-smoke.spec.ts`: reads `/api/healthz` — stateless, safe.
- `tests/e2e/cross-cutting.spec.ts`: reads various routes — stateless, safe.
- `tests/a11y/axe.spec.ts`: reads DOM — stateless, safe.
- `design-system/**/*.e2e.ts` (chromium-components project): these may have shared state
  if they mutate DOM or check for elements that other tests create. Audit each file.

**Audit method (corrected):**
```bash
# Case-insensitive; tighter patterns to avoid grep noise (setAttribute, setTimeout, etc.)
grep -rni 'localStorage\|sessionStorage\|document\.cookie\|indexedDB\|\.post(\|fetch.*POST' \
  tests/e2e/ tests/a11y/
find design-system -name '*.e2e.ts' -exec grep -Hin 'localStorage\|sessionStorage\|POST\|mutation' {} +
```

**Go/no-go decision before implementing:** Wall-clock CI time is UNCHANGED because the 5 matrix
legs already run in parallel. The only gain is tail-latency per leg (~15 min → ~10 min per leg,
which affects the slowest leg's contribution to the overall CI wait). This is a thin cost/benefit.
Before implementing, explicitly decide: is 5 min of tail-latency reduction worth the flaky-test
risk of parallel execution? If yes, proceed. If no, close D3.

**Implementation plan (only if go-decision is made after audit):**
- If no conflicts found: `playwright.config.ts` → `workers: process.env.CI ? 2 : undefined`
- If conflicts found: add `test.describe.configure({ mode: 'serial' })` to conflicting test
  groups and set `workers: 2` globally.

**Expected outcome:** Each e2e-functional matrix leg: ~15 min → ~10 min. Aggregate CI wait
unchanged (legs run in parallel). Net gain: tail-latency only.

### ADR Template

Write DECISIONS.md entry after the shared-state audit, noting which test files required serial
mode and why.

---

## Implementation Timeline

| Sub-item | Effort estimate | Prerequisite |
|---|---|---|
| D1 (Argos CI evaluation) | 2-3 hours (eval + ADR) | None |
| D1 (Argos CI migration PR) | 4-6 hours | ADR approved |
| D2 (build cache audit) | 30 min | Group A merged |
| D2 (build cache fix PR) | 1-2 hours | Audit shows gap |
| D3 (spec audit) | 1-2 hours | None |
| D3 (workers PR) | 1-2 hours | Audit clean |

---

## Success Criteria

- D1: committed PNGs removed from repo; visual regression caught by Argos in next CSS PR
- D2: `build` CI job shows "Cache hit" in >50% of PRs that don't touch app source files
- D3: e2e-functional legs complete in <10 min with no new test failures
