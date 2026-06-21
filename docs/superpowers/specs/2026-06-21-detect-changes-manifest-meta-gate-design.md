# detect-changes manifest + stale-pathspec meta-gate - design

**Date:** 2026-06-21
**Status:** approved (brainstorming) - pending plan
**Class:** CI gate hardening (fail-open-on-stale-path prevention), continuous with #154 / #160 / #162

## Problem

The `detect-changes` job in `.github/workflows/ci.yml` (step "Detect changed file
categories", currently lines 510-573) decides which expensive gates run on a PR by
diffing the PR against its base over three hardcoded pathspec lists embedded in an
inline shell `run:` block:

- `ai` → gates the `ai-eval` job (AI Gateway credits).
- `app` → gates `performance`, `e2e-functional`, `e2e-visual-chromium`.
- `ui` → gates the visual / Argos job (a deliberate subset of `app`).

These pathspecs are the **fail-open-on-stale-path** class CLAUDE.md flags as a
top-priority recurring defect: if a watched file or directory is moved or renamed
and its pathspec is not updated in the same change, the filter silently evaluates
to "unchanged", the gate is skipped, GitHub branch protection treats the skipped
required check as satisfied, and a regression ships unguarded. This is the exact
class that leaked the `lib/eval/` ai-filter gap previously.

Today all ~30 pathspecs resolve (audited 2026-06-21), so this is **preventive**
hardening, not a live-bug fix: make a future orphaning fail CI loudly.

A secondary problem enables the fix: the pathspecs live inside an inline shell
block, so nothing can validate them. Hoisting them to an importable manifest makes
both the runner and the validator read one source of truth.

## Goals

1. A meta-gate that fails CI (loudly, exit 2 = infra) when any `detect-changes`
   pathspec no longer resolves to an existing path / matches no file.
2. A single source of truth for the pathspecs, importable by both the runner and
   the validator.
3. **Exact** behavior preservation of the current `ai` / `app` / `ui` decision -
   this is a load-bearing, fail-open-sensitive job.

## Non-goals

- Changing *which* paths are watched. This is a pure lift-and-shift of the current
  lists; any list edit is a separate change.
- Replacing GitHub's path-filter mechanics or branch-protection behavior.
- Validating that every watched path is *sufficient* (that is a human review
  concern, not mechanizable here).

## Architecture - three units

### Unit 1: manifest - `scripts/detect-changes-paths.mjs`

Plain node, zero third-party imports (the CI `detect-changes` and `quality-fast`
jobs must run it without `pnpm install`, same constraint as
`scripts/check-semgrep-fixture.mjs`). Exports three readonly string arrays of
git pathspecs, copied verbatim from the current shell block:

```js
export const AI_PATHS = [
  'app/api/ask/', 'lib/ask/', 'lib/ask-log.ts', 'lib/ip-hash.ts',
  'lib/stream-protocol.ts', 'lib/rate-limit.ts', 'lib/agent/', 'lib/hiring-profile.ts',
  'lib/eval/',
  'content/ask-eval-corpus.ts', 'content/ask-eval-calibration.ts',
  'content/perf-receipts.ts',
  'content/projects.ts', 'content/unknowns.ts', 'content/visa.ts',
  'scripts/ask-eval.ts', '__tests__/ask-*',
];

export const APP_PATHS = [
  'app/', 'components/', 'design-system/', 'lib/', 'content/', 'public/',
  'next.config.ts', '.github/workflows/', 'lighthouserc.json', 'lighthouserc.mobile.json',
  'scripts/check-bundle-size.mjs', 'playwright.config.ts',
  'package.json', 'pnpm-lock.yaml',
];

export const UI_PATHS = [
  'app/', 'components/', 'design-system/', 'lib/', 'content/', 'public/',
  'next.config.ts', 'playwright.config.ts', 'pnpm-lock.yaml',
  ':(exclude)lib/eval/**', ':(exclude)lib/__tests__/**',
];
```

The existing explanatory comments (why `ui` is a subset, why `package.json` is
excluded from the literal `ui` list but compared semantically, why `lib/eval/` is
excluded) move into the manifest as JSDoc above each array so the rationale travels
with the source of truth.

### Unit 2: runner - `scripts/detect-changes.mjs`

Replaces the inline shell. Plain node, no deps. Structure:

- **Pure core** `computeCategories({ aiChanged, appChanged, uiChanged, pkgRenderChanged })`
  → `{ ai: boolean, app: boolean, ui: boolean }`, where the first three inputs are
  the non-empty-ness of each git-diff result and `pkgRenderChanged` is the
  package.json render-slice comparison. Trivial boolean mapping
  (`ui = uiChanged || pkgRenderChanged`), but isolating it makes the decision
  unit-testable without git.
- **Pure helper** `canonicalJSON(value)` → a deterministic string with recursively
  sorted object keys (the node equivalent of `jq -cS`). Used to compare the
  `{ browserslist, pnpm }` slices of `package.json` between BASE and HEAD.
- **Thin `main()`** does the I/O:
  - If `process.env.EVENT_NAME !== 'pull_request'` → write `ai=true app=true ui=true`
    to `$GITHUB_OUTPUT`, return (the current non-PR shortcut).
  - Else `spawnSync('git', ['diff', '--name-only', `${BASE}...${HEAD}`, '--', ...PATHS])`
    per category; `pkgRenderChanged` from `git show BASE:package.json` /
    `HEAD:package.json` → `canonicalJSON({browserslist, pnpm})` compare, with the
    same `null`-on-missing-or-unparseable fallback as the `|| echo null` shell.
  - Write the three `name=value` lines to the file named by `process.env.GITHUB_OUTPUT`.
- Entry guard: the standardized
  `typeof process.argv[1] === 'string' && import.meta.url === pathToFileURL(process.argv[1]).href`.

The ci.yml step body collapses to `run: node scripts/detect-changes.mjs` with the
existing `env:` (BASE_SHA, HEAD_SHA, EVENT_NAME) plus `GITHUB_OUTPUT` available by
default. `id: check` and all downstream `needs.detect-changes.outputs.*` references
are unchanged. The job's scaffolding is unchanged too: `actions/checkout` with
`fetch-depth: 0` (both SHAs present for the diff), `timeout-minutes: 2`, and the
three `outputs:` mappings stay as-is. The job sets up **no** node/pnpm today and
needs none added: the runner uses only node builtins (`node:child_process`,
`node:fs`, `node:url`), so ubuntu-latest's preinstalled node runs it with no
`pnpm install` (same constraint the manifest and validator satisfy).

### Unit 3: validator (meta-gate) - `scripts/check-detect-changes-paths.mjs`

Plain node, no deps. Imports the manifest, validates every pathspec across all three
arrays (deduplicated), exits 2 with the orphaned spec named on the first failure,
exit 0 when all resolve.

- **Pure** `classifyPathspec(spec)` → `{ kind: 'literal' | 'glob' | 'exclude', base: string }`.
  - starts with `:(exclude)` → `exclude`, base = remainder minus a trailing `/**`.
  - contains `*` → `glob`.
  - else → `literal`.
- **`assertResolves(spec, { existsSync, globMatch })`** (deps injected for testing):
  - `literal` → `existsSync(base)` must be true.
  - `glob` → `globMatch(spec)` must return ≥1 path.
  - `exclude` → `existsSync(base)` must be true (a stale exclude silently stops
    excluding, re-arming `ui` spuriously - lower severity, still a real drift, so
    validated).
- `main()` iterates the union of the three arrays; collects all failures (does not
  stop at the first) and prints each as `[detect-changes-paths] ORPHANED: <spec> (<reason>)`,
  then `process.exit(2)`. Glob matching uses node `fs` (e.g. a small `readdirSync`
  prefix match scoped to the glob's directory) - no third-party glob dep.

Wired into the `quality-fast` job as a new step next to the other meta-gates
(`check:gate-health`, `check:doc-drift`), and exposed as `pnpm check:detect-changes-paths`
in `package.json` and folded into `ci:local`.

## Behavior preservation contract

The new runner MUST produce identical `ai` / `app` / `ui` to the current shell for:

| Scenario | ai | app | ui |
|---|---|---|---|
| non-PR event (push / dispatch) | true | true | true |
| content-only change (`content/projects.ts`) | true | true | true |
| `app/` component change | false | true | true |
| `.github/workflows/` only | false | true | false |
| `lib/eval/`-only change | true | true | false (excluded) |
| `package.json` `browserslist` bump (no lock diff) | false | true | true |
| docs-only (`*.md`) | false | false | false |

A parity check (Unit 2 runner vs. a faithful reproduction of the old shell) over
these scenarios is a mandatory pre-merge step, not just the unit tests.

## Error handling

- Validator: any unresolved pathspec → exit 2 (infra), all failures listed.
- Runner: a `git` spawn error or unreadable `$GITHUB_OUTPUT` → exit non-zero so the
  job fails loudly rather than silently emitting no outputs (which would make every
  downstream gate read its default and could skip a required gate). The non-PR
  shortcut and the `package.json`-missing fallback (`null`) are preserved exactly.

## Testing

- `computeCategories` - true/false per category; `ui = uiChanged || pkgRenderChanged`
  both ways; non-PR path covered via `main()` smoke.
- `canonicalJSON` - key-order independence, nested objects/arrays, primitives, `null`.
- `classifyPathspec` - literal / glob / exclude classification incl. base extraction.
- `assertResolves` - literal-missing fails, glob-no-match fails, stale-exclude fails,
  all-live passes (deps injected).
- Parity proof - the table above, runner output vs. reproduced shell, before merge.

`.mjs` scripts imported by `.ts` tests get co-located `.d.mts` declarations (the
established `check-semgrep-fixture.d.mts` pattern under `allowJs: false`).

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Rewriting a fail-open-sensitive job computes a category wrong → a required gate skips (fail-open) | Pure `computeCategories` is exhaustively unit-tested; the parity proof asserts byte-identical outputs vs. the old shell on the scenario table before merge. |
| `canonicalJSON` diverges from `jq -cS` semantics | Unit-tested for key-order independence; the `browserslist` bump scenario in the parity proof exercises it end-to-end. |
| The validator itself goes vacuous (imports an empty manifest, validates nothing) | Assert the manifest arrays are non-empty before iterating (same anti-vacuous discipline as #162). |
| Manifest drifts from ci.yml during the migration | After the cut-over the pathspecs exist ONLY in the manifest; ci.yml no longer contains them, so there is no second copy to drift. |

## Reversibility

Reversible: revert the ci.yml step to the inline shell and delete the three scripts;
no persisted state. ADR to `DECISIONS.md` on landing.
