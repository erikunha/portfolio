# Design: npmrc Safety Hardening + Dead Code Cleanup

**Date:** 2026-05-29
**Branch:** `chore/safety-hardening`
**Reversibility:** High — all changes are config edits or file deletions; nothing structural.

## Problem

Three independent issues accumulating in the repo:

1. `.npmrc` contains cargo-culted settings from a monorepo template (no workspace exists), misses supply chain attack defenses, and is too permissive on audit severity.
2. Two tracked files are permanently dead: `HANDOFF.md` (superseded by `.remember/`) and `scripts/migrations/migrate-tokens.mjs` (one-shot migration already executed).
3. 24 debug screenshots at repo root are gitignored but not deleted — they silently accumulate across sessions with no visibility. The gitignore rule conceals the problem rather than solving it.

## Scope

Config-only PR. No source, component, test, or build changes.

---

## Section 1: `.npmrc` Hardening

### Changes

| Setting | Before | After | Reason |
|---|---|---|---|
| `audit-level` | `high` | `moderate` | Catches moderate CVEs; high misses the majority of published advisories |
| `strict-peer-dependencies` | `false` | `true` | Fails loudly on peer conflicts at install time — catches dep mismatches before they reach CI |
| `save-workspace-protocol` | `rolling` | removed | No `pnpm-workspace.yaml`, no monorepo; flag is dead cargo |
| `public-hoist-pattern[]=*eslint*` | present | removed | Project uses Biome; no ESLint; pattern hoists nothing |
| `public-hoist-pattern[]=*prettier*` | present | removed | Project uses Biome; no Prettier; pattern hoists nothing |
| `ignore-workspace-root-check` | `true` | removed | No workspace; this flag suppresses a warning that doesn't fire |
| `registry` | absent | `https://registry.npmjs.org` | Explicit registry pin defends against misconfigured CI environments pointing at compromised mirrors |
| `verifyStoreIntegrity` | absent | `true` | pnpm v9+ default — making it explicit documents intent and protects against a future pnpm default change |

### Result

```ini
# Sets the minimum severity threshold for `pnpm audit`.
audit-level=moderate
auto-install-peers=true
strict-peer-dependencies=true
shamefully-hoist=false
prefer-frozen-lockfile=true
public-hoist-pattern[]=*types*
node-linker=isolated
registry=https://registry.npmjs.org
verifyStoreIntegrity=true
```

---

## Section 2: Supply Chain Hardening (`package.json`)

### Threat model

Install-script attacks are the highest-severity npm supply chain vector:

- A compromised package maintainer publishes a new version with a malicious `postinstall` that exfiltrates env vars or injects code.
- pnpm runs the script automatically on `pnpm install`.
- The lockfile protects against silent version bumps, but not against a lockfile update (i.e., any `pnpm up` or fresh install on a new semver-compatible version).

### Defense: `pnpm.onlyBuiltDependencies`

Whitelists which packages may run lifecycle scripts (`preinstall`, `install`, `postinstall`). Any package outside the list has its install scripts silently skipped — not errored, just ignored.

**Audit result:** scanning all `node_modules/.pnpm` — only two packages run legitimate install scripts:
- `esbuild` — downloads the native binary for the current platform
- `sharp` — compiles native image processing bindings

No other package in the dependency tree runs install scripts. The whitelist is minimal and correct.

### Change

Add to `package.json`:

```json
"pnpm": {
  "onlyBuiltDependencies": ["esbuild", "sharp"]
}
```

### Why this beats `ignore-scripts=true`

`ignore-scripts=true` breaks `esbuild` and `sharp` (no native binary = build fails). `onlyBuiltDependencies` achieves the same protection for all other packages while keeping the two legitimate scripts working.

---

## Section 3: Dead Tracked File Removal

### Files

| File | Status | Action |
|---|---|---|
| `HANDOFF.md` | Stale — superseded by `.remember/` memory system | `git rm` |
| `scripts/migrations/migrate-tokens.mjs` | One-shot CSS token migration, already executed; no callers, no CI reference | `git rm` |
| `scripts/migrations/` | Becomes empty after above | `git rm -r` |

### Verification before removal

- `grep -r 'migrate-tokens' --include='*.json' --include='*.ts' --include='*.mjs'` confirms zero references in CI or scripts.
- `HANDOFF.md` has no inbound links and is not referenced in any script or CI config.

---

## Section 4: Screenshot Cleanup + Gitignore Discipline

### Problem

`.gitignore` contains:
```
/*.png
/*.jpg
/*.jpeg
/*.webp
```

This causes debug screenshots (dumped to root by Playwright MCP sessions) to silently accumulate. They're invisible to `git status`, invisible in PRs, but present on disk. 24 such files exist now.

### Fix

1. Delete all 24 PNG files at repo root (working-tree only, not tracked by git).
2. Remove the four wildcard lines from `.gitignore`.

### Effect

Future screenshots dumped to root appear in `git status` as untracked files — visible noise that prompts cleanup rather than silently burying them. This restores the standard "untracked = should I commit this?" signal.

**Note:** `public/*.png` (favicons, OG image) and `tests/e2e/**/*.png` (visual regression baselines) are not affected — these are tracked by git explicitly and the removed lines only matched root-level files.

---

## Execution Plan

**Branch:** `chore/safety-hardening`
**Worktree:** isolated git worktree via `superpowers:using-git-worktrees`
**Mode:** two parallel subagents + main-context cleanup

| Agent | Task |
|---|---|
| A | Edit `.npmrc` (8 changes) + add `pnpm.onlyBuiltDependencies` to `package.json` |
| B | `git rm HANDOFF.md` + `git rm -r scripts/migrations/` |
| Main | `rm *.png` at root + edit `.gitignore` (remove 4 lines) |

**Verification after implementation:**
- `pnpm install --frozen-lockfile` — confirm strict-peer-dependencies doesn't break current lockfile
- `pnpm audit` — confirm audit-level=moderate works
- `pnpm ci:local` — full gate suite

**Commit structure:** single commit `chore(config): npmrc hardening, supply chain whitelist, dead file removal`

---

## Non-goals

- No changes to source, components, tests, or CI workflows.
- No new dependencies.
- No Socket.dev or external tooling integration (out of scope for this PR).
