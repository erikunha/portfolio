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
