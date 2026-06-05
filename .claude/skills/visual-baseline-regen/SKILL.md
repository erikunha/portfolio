---
name: visual-baseline-regen
description: Use when a push or PR may touch a Playwright screenshot baseline — any CSS, layout, typography, spacing, or rendering change. Page sections (hero, contact, shell, hottest-takes) are captured in `tests/visual/visual.spec.ts`; design-system component baselines live in `tests/e2e/design-system-components.spec.ts`. Covers assessing baseline impact before a push, the darwin regen path (`--update-snapshots` against a prod server), the linux regen path (the `update_visual_baselines` CI dispatch + artifact download + per-project PNG copy), committing both platforms in one commit, the batch-to-one-push cost rule, and the inspect-before-commit rule.
---

# Visual baseline regeneration

A stale visual-regression baseline fails the E2E visual project in CI. Baselines are
per-platform (darwin + linux) and per-project. The decision "does this push affect a
baseline?" fires on EVERY push (kept inline in CLAUDE.md); this skill is the full
procedure once the answer is YES.

## Step 0 — assess impact BEFORE every push (always)

Before any push, decide whether the change touches a Playwright screenshot baseline — a
page section captured in `tests/visual/visual.spec.ts` (hero, contact, shell,
hottest-takes) OR a design-system component captured in
`tests/e2e/design-system-components.spec.ts`. **State the assessment explicitly.**

- **NO** baseline affected (e.g. a string moved to content with identical rendering):
  say so and push once. Done.
- **YES**: regenerate and commit baselines for BOTH platforms alongside the code so the
  first CI run is green. Continue below.

Never defer baselines, the test suite, or runtime/perf (LHCI) gates pending a design or
"the shade might change" decision. Lock the decision, regenerate, run every gate, then
open the PR. If the decision is not locked, hold the PR — do not open a half-gated one.

## Step 1 — darwin baseline (local)

Regenerate against a production server locally, then update snapshots:

    pnpm build
    # serve the prod build, then:
    pnpm test:e2e --project=<visual-project> --update-snapshots

This writes the `*-darwin.png` baselines.

## Step 2 — linux baseline (CI dispatch, artifacts are UPLOADED not committed)

The linux runner's pixels differ from darwin; you cannot fake them locally. Dispatch the
CI regen workflow, wait, then pull the artifacts:

    gh workflow run "CI" -f update_visual_baselines=true --ref <branch>
    # wait for the run to finish, then download:
    # artifacts are named visual-baselines-<project>

Download each `visual-baselines-<project>` artifact and copy **each project's OWN**
`*-linux.png` into the repo. The CI workflow UPLOADS the baselines as artifacts — it does
NOT commit them. You commit them.

## Step 3 — commit both platforms together

Commit the darwin + linux PNGs **in the same commit as the code change** so the first CI
run is green. Do not push the code first and let CI fail.

## Hard rules

- **Inspect before committing.** Always Read the regenerated PNG before committing — never
  blind-update. A wrong baseline locks in a regression.
- **Batch visual tweaks to one push.** NEVER push code that knowingly leaves a stale
  baseline, let CI fail, then dispatch a regen, then push again — that is 3 paid runs
  (build + dual-LHCI ~9min + 4 visual jobs) for what should be 1. Batch all visual tweaks
  so the whole regen cycle happens once.
- **Never revert an unedited section's baseline as "noise."** A Tailwind utility change
  can reflow any captured section by 1px; commit ALL changed darwin baselines, not only
  the section you intended to touch.
- A local Docker generator that produces linux pixels in one push is desirable, but only
  if its output is first validated to match the CI runner — do not commit an unvalidated
  one; it churns review.

## Related

- `tests/visual/visual.spec.ts` — captured page sections (hero, contact, shell,
  hottest-takes). `tests/e2e/design-system-components.spec.ts` — design-system component
  baselines. Both are screenshot baselines that a visual change can invalidate.
- The runtime/perf (LHCI) and review-battery gates that also run before a push stay
  inline in CLAUDE.md; this skill is only the baseline-regen mechanics.
