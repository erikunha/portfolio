---
paths:
  - ".github/**"
  - ".husky/**"
  - "scripts/**"
  - "biome.json"
  - "vitest.config.ts"
  - "playwright.config.ts"
  - "lighthouserc*.json"
---

# CI, hooks and gate configuration

Path-scoped: loads only when working on these files.

## Moving or extracting code

A file move or an extraction (relocating code or a symbol into a new module, even without
`git mv`) needs a consumer scan across two surfaces before the plan is written:

1. Code callers: `grep -r 'OldPath' --include='*.ts' --include='*.tsx'`.
2. The surface that hard-codes paths: `.github/workflows/**` (the `detect-changes` path filters
   above all), `.husky/**`, `scripts/**`, and any allowlist, pathspec or glob.

Update every match, test files included, and fix stale path comments in moved files. A path filter
left pointing at the old location fails open: the gate reads "unchanged", skips, and a regression
ships unguarded.

## Gates

- A gate that routine `--no-verify` or override bypasses are working around is miscalibrated.
  Narrow its predicate to what it protects instead of weakening it for everyone.
- Never raise a threshold or add an ignore entry to turn a gate green. Fix the measured property.
- A job added to `ci.yml` joins the `needs` list of `ci-gate` (`__tests__/scripts/ci-gate-job.test.ts`). A `quality-fast` step belongs in `pnpm verify` or in the named CI-only list (`scripts/__tests__/ci-verify-parity.test.ts`), so a check that passes locally cannot fail only in CI.
- Every workflow declares a top-level `permissions` block, never `write-all`, and pins each action to a commit SHA (`__tests__/scripts/workflow-permissions.test.ts`, `__tests__/scripts/workflow-action-sha-sync.test.ts`). In `ci.yml`, a job that runs a repository command gets no OIDC, attestation or pull-request write scope (`__tests__/scripts/ci-privilege-split.test.ts`).
- The control surfaces (workflows, `.husky/pre-push`, dependency manifests and lockfile, `biome.json`, `vercel.json`, `proxy.ts`) keep an owner line in `.github/CODEOWNERS` (`__tests__/scripts/codeowners-coverage.test.ts`).
- A job or action added to `ci.yml` needs an entry in `scripts/lib/ci-predict-policy.ts` (`JOB_POLICIES`, `ACTION_CLASSES`); `scripts/__tests__/ci-predict.test.ts` fails until it has one, so `pnpm ci:predict` never skips a job it cannot see. A new `ci.yml` construct the parser does not execute (a job or step key, an expression context, a shell) makes the predictor throw instead of skipping it; teach `scripts/lib/ci-workflow.ts` or the drift guard stays red. The predictor's child processes get an environment allowlist (`allowedEnv` in `scripts/lib/ci-predict-process.ts`), not the shell's: a variable a CI step needs from the environment goes in the step `env:` or on that list. An e2e spec never names `localhost:3000`: read `baseURL`, because the predictor serves on a random port (`__tests__/meta/e2e-origin.test.ts`).
