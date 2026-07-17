---
name: visual-baseline-regen
description: Use when a push or PR may touch a Playwright screenshot baseline — any CSS, layout, typography, spacing, or rendering change. Page sections (hero, contact, shell, hottest-takes) are captured in `tests/visual/visual.spec.ts` and are CI-gated per-platform (darwin + linux). Design-system component baselines live in `tests/e2e/design-system-components.spec.ts` and are darwin-only (the spec is ignored in CI on Ubuntu). Covers assessing baseline impact before a push, the darwin regen path (`--update-snapshots` against a prod server), the linux regen path for `visual.spec.ts` baselines only (the `update_visual_baselines` CI dispatch + artifact download + per-project PNG copy), committing both platforms in one commit, the batch-to-one-push cost rule, and the inspect-before-commit rule.
---
> **Codex note:** hook activation is not configured in this repo, so every "the hook blocks", "enforced", "WIRED", or "exit 2" claim here — including in this file's description — is a **hard rule to self-enforce**, not an automated gate.


# Visual baseline regeneration

Two specs capture screenshot baselines with different CI treatment:

- **`tests/visual/visual.spec.ts`** (page sections: hero, contact, shell, hottest-takes) —
  CI-gated, per-platform (darwin + linux). A stale baseline fails the E2E visual project
  in CI. Requires full darwin + linux regen (Steps 1-3 below).
- **`tests/e2e/design-system-components.spec.ts`** (DS component baselines) — darwin-only.
  This spec is ignored in CI on Ubuntu (`testIgnore` in `playwright.config.ts`). Darwin regen
  only (Step 1 only; skip Steps 2-3).

The decision "does this push affect a baseline?" fires on EVERY push (kept inline in
AGENTS.md); this skill is the full procedure once the answer is YES.

## Step 0 — assess impact BEFORE every push (always)

Before any push, decide whether the change touches a baseline. **State the assessment explicitly.**

- **NO** baseline affected (e.g. a string moved to content with identical rendering):
  say so and push once. Done.
- **YES — `visual.spec.ts` baseline affected:** regenerate and commit baselines for BOTH
  platforms (darwin + linux) alongside the code so the first CI run is green. Continue
  through Steps 1-3.
- **YES — DS component baseline only (`design-system-components.spec.ts`) affected:**
  darwin regen only (Step 1). Skip Steps 2-3. No linux artifact needed — CI ignores this
  spec on Ubuntu.

Never defer baselines, the test suite, or runtime/perf (LHCI) gates pending a design or
"the shade might change" decision. Lock the decision, regenerate, run every gate, then
open the PR. If the decision is not locked, hold the PR — do not open a half-gated one.

## Step 1 — darwin baseline (local, applies to both specs)

Regenerate against a production server locally, then update snapshots:

    pnpm build
    DEPLOY_SALT=test pnpm start &
    # wait for server at localhost:3000, then run ONLY the spec being regenerated:

    # for visual.spec.ts baselines:
    pnpm test:e2e --project=<visual-project> tests/visual/visual.spec.ts --update-snapshots

    # for design-system-components.spec.ts baselines:
    pnpm test:e2e --project=<visual-project> tests/e2e/design-system-components.spec.ts --update-snapshots

`DEPLOY_SALT=test` prevents prod-mode salt resolution from hitting Upstash Redis
(see `lib/ip-hash.ts`). Use `pnpm start`, not `pnpm dev` — baselines must match
the production build. Scope the command to the specific spec to avoid regenerating
unrelated baselines.

This writes the `*-darwin.png` baselines.

## Step 2 — linux baseline for `visual.spec.ts` only (CI dispatch, artifacts UPLOADED not committed)

**Skip this step for `design-system-components.spec.ts` baselines — CI ignores that spec on Ubuntu.**

The linux runner's pixels differ from darwin; you cannot fake them locally. Dispatch the
CI regen workflow, wait, then pull the artifacts:

    gh workflow run "CI" -f update_visual_baselines=true --ref <branch>
    # wait for the run to finish, then download:
    # artifacts are named visual-baselines-<project>

Download each `visual-baselines-<project>` artifact and copy **each project's OWN**
`*-linux.png` into the repo. The CI workflow UPLOADS the baselines as artifacts — it does
NOT commit them. You commit them.

## Step 3 — commit both platforms together (for `visual.spec.ts` baselines)

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

- `tests/visual/visual.spec.ts` — CI-gated page sections (hero, contact, shell,
  hottest-takes); requires darwin + linux regen when changed.
- `tests/e2e/design-system-components.spec.ts` — design-system component baselines;
  darwin-only (spec is ignored on Ubuntu in CI); requires only darwin regen when changed.
- The runtime/perf (LHCI) and review-battery gates that also run before a push stay
  inline in AGENTS.md; this skill is only the baseline-regen mechanics.
