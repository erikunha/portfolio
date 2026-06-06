# npmrc Safety Hardening + Dead Code Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden `.npmrc` against supply chain attacks and audit gaps, remove two permanently dead tracked files, and delete accumulated debug screenshots while removing the gitignore rule that was hiding them.

**Architecture:** Config-only changes across four files (`.npmrc`, `.gitignore`, `HANDOFF.md` removal, `scripts/migrations/` removal). No source, component, test, or build changes. Single commit on branch `chore/safety-hardening`.

**Tech Stack:** pnpm, git

---

## File Map

| File | Action | What changes |
|---|---|---|
| `.npmrc` | Modify | 6 settings removed/changed, 2 added |
| `.gitignore` | Modify | Remove comment + 4 image glob lines (lines 43–47) |
| `HANDOFF.md` | Delete | `git rm` — superseded by `.remember/` system |
| `scripts/migrations/migrate-tokens.mjs` | Delete | `git rm` — one-shot migration already executed |
| `scripts/migrations/` (dir) | Delete | Empty after above; `git rm -r` handles it |
| `*.png` at repo root | Delete | 24 untracked debug screenshots; `rm` only |

**Note:** `package.json` already has `pnpm.onlyBuiltDependencies: ["esbuild", "sharp", "@biomejs/biome"]`. Supply chain whitelist is in place — no change needed, just verify in Task 1.

---

## Task 1: Create branch and verify pre-conditions

**Files:** none modified

- [ ] **Step 1: Check current branch and ensure working tree is clean**

```bash
git status --short
git branch --show-current
```

Expected: clean working tree, on `fix/daw-mixer-mobile-arrow` (or main). If dirty, stash or commit first.

- [ ] **Step 2: Create and switch to the feature branch**

```bash
git checkout -b chore/safety-hardening
```

Expected: `Switched to a new branch 'chore/safety-hardening'`

- [ ] **Step 3: Verify supply chain whitelist is already in place**

```bash
node -e "const d=require('./package.json'); console.log(JSON.stringify(d.pnpm,null,2))"
```

Expected output includes:
```json
{
  "onlyBuiltDependencies": [
    "esbuild",
    "sharp",
    "@biomejs/biome"
  ]
}
```

If the `onlyBuiltDependencies` key is missing, add it before proceeding (per spec Section 2 — the whitelist is the highest-impact supply chain defense).

- [ ] **Step 4: Verify migrate-tokens has zero callers**

```bash
grep -r 'migrate-tokens' . --include='*.json' --include='*.ts' --include='*.mjs' --include='*.yml' --exclude-dir=node_modules
```

Expected: no output (zero matches). If matches exist, stop and investigate before removing the file.

- [ ] **Step 5: Count root PNGs to confirm scope**

```bash
ls *.png 2>/dev/null | wc -l
```

Expected: `24`. If different, note the actual count — the rm command in Task 4 is a glob so count doesn't affect execution.

---

## Task 2: Harden `.npmrc`

**Files:**
- Modify: `.npmrc`

Current file (15 lines):
```ini
# Sets the minimum severity threshold for `pnpm audit` (run explicitly via
# `pnpm audit` or `pnpm audit --fix`). Does NOT automatically audit on install;
# this is the default threshold so any team member running `pnpm audit` will
# see high/critical findings without needing to pass --audit-level manually.
audit-level=high
auto-install-peers=true
strict-peer-dependencies=false
shamefully-hoist=false
prefer-frozen-lockfile=true
save-workspace-protocol=rolling
public-hoist-pattern[]=*types*
public-hoist-pattern[]=*eslint*
public-hoist-pattern[]=*prettier*
ignore-workspace-root-check=true
node-linker=isolated
```

- [ ] **Step 1: Replace the entire `.npmrc` with the hardened version**

Write this exact content to `.npmrc`:

```ini
# Sets the minimum severity threshold for `pnpm audit`.
# moderate catches the majority of published advisories; high misses most.
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

Changes applied:
- `audit-level`: `high` → `moderate`
- `strict-peer-dependencies`: `false` → `true`
- `save-workspace-protocol=rolling`: removed (no pnpm-workspace.yaml)
- `public-hoist-pattern[]=*eslint*`: removed (project uses Biome, not ESLint)
- `public-hoist-pattern[]=*prettier*`: removed (project uses Biome, not Prettier)
- `ignore-workspace-root-check=true`: removed (no workspace)
- `registry=https://registry.npmjs.org`: added (explicit pin against compromised CI mirrors)
- `verifyStoreIntegrity=true`: added (pnpm v9+ default, made explicit)

- [ ] **Step 2: Verify the file looks exactly right**

```bash
cat .npmrc
```

Expected output:
```
# Sets the minimum severity threshold for `pnpm audit`.
# moderate catches the majority of published advisories; high misses most.
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

- [ ] **Step 3: Confirm pnpm install still works with frozen lockfile**

```bash
pnpm install --frozen-lockfile 2>&1 | tail -5
```

Expected: exits 0. `strict-peer-dependencies=true` only fires during resolution (i.e., `pnpm add` or unfrozen `pnpm install`), not during frozen installs, so the existing lockfile is safe.

If this fails with peer dependency errors, set `strict-peer-dependencies=false` temporarily, run `pnpm install` to let pnpm fix peers in the lockfile, then re-enable strict. Document any peer fixes in the commit message.

---

## Task 3: Remove dead tracked files

**Files:**
- Delete: `HANDOFF.md`
- Delete: `scripts/migrations/migrate-tokens.mjs`
- Delete: `scripts/migrations/` (directory, becomes empty)

- [ ] **Step 1: Remove HANDOFF.md from git tracking**

```bash
git rm HANDOFF.md
```

Expected: `rm 'HANDOFF.md'`

- [ ] **Step 2: Remove the migrations directory from git tracking**

```bash
git rm -r scripts/migrations/
```

Expected:
```
rm 'scripts/migrations/migrate-tokens.mjs'
```

- [ ] **Step 3: Confirm the directory is gone**

```bash
ls scripts/migrations/ 2>&1
```

Expected: `ls: scripts/migrations/: No such file or directory`

- [ ] **Step 4: Confirm no other scripts reference migrate-tokens**

```bash
grep -r 'migrations' scripts/ --include='*.mjs' --include='*.ts' 2>/dev/null
```

Expected: no output.

---

## Task 4: Delete root PNGs and patch `.gitignore`

**Files:**
- Delete: all `*.png` at repo root (untracked, gitignored — `rm` only, no `git rm` needed)
- Modify: `.gitignore` (remove lines 43–47: comment + 4 image glob patterns)

- [ ] **Step 1: Delete all PNG screenshots at repo root**

```bash
rm -f *.png
```

Expected: silent success. Verify:

```bash
ls *.png 2>&1
```

Expected: `zsh: no matches found: *.png` (or equivalent shell error indicating no files).

- [ ] **Step 2: Remove the image glob lines from `.gitignore`**

Current lines 43–47 in `.gitignore`:
```
# verification/playwright MCP screenshots dumped to repo root during development
/*.png
/*.jpg
/*.jpeg
/*.webp
```

Remove those six lines (comment + 4 patterns + the trailing blank line on line 48). Removing the trailing blank prevents a double-blank-line between `.playwright-mcp/` and `tsconfig.tsbuildinfo`.

After editing, the relevant portion of `.gitignore` should look like:

```
# playwright mcp session logs
.playwright-mcp/

tsconfig.tsbuildinfo
```

- [ ] **Step 3: Verify the gitignore change**

```bash
grep -n 'png\|jpg\|jpeg\|webp' .gitignore
```

Expected: no output (zero matches). Any match means the removal was incomplete.

- [ ] **Step 4: Confirm tracked PNGs (public/, tests/) are unaffected**

```bash
git ls-files -- '*.png' | head -10
```

Expected: only `public/` favicons and `tests/e2e/**/*-snapshots/*.png` files. The root-level PNGs were never tracked, so nothing changes for git — this step just confirms no regression.

---

## Task 5: Verify gates + single commit

**Files:** none modified

- [ ] **Step 1: Run pnpm audit with new threshold**

```bash
pnpm audit --audit-level=moderate 2>&1 | tail -10
```

Expected: exits 0 with no moderate/high/critical advisories, or prints advisories that exist (non-zero exit). If advisories appear, note them — they pre-existed and are now visible because the threshold dropped from high to moderate. Don't block the commit on pre-existing advisories; file a follow-up.

- [ ] **Step 2: Run full local CI gate**

```bash
pnpm ci:local 2>&1 | tail -10
```

Expected: exits 0. This runs lint + typecheck + content validation + client-naming + dep-pinning + harness-size + section-order + unit tests.

If `strict-peer-dependencies=true` surfaced a peer error during this run that prevents install, see the fallback in Task 2 Step 3.

- [ ] **Step 3: Confirm git status is clean except staged changes**

```bash
git status --short
```

Expected: staged deletions for `HANDOFF.md` and `scripts/migrations/migrate-tokens.mjs`, plus modified `.npmrc` and `.gitignore`. No unexpected files.

- [ ] **Step 4: Stage all changes**

```bash
git add -u
git add .npmrc .gitignore
```

The `-u` flag stages tracked file changes and deletions. The explicit adds catch `.npmrc` and `.gitignore` if not already staged.

- [ ] **Step 5: Commit**

```bash
git commit -m "chore(config): npmrc hardening, supply chain whitelist, dead file removal

- audit-level: high → moderate (catches majority of advisories)
- strict-peer-dependencies: false → true (loud on peer conflicts)
- registry pinned to registry.npmjs.org (defense against CI mirror confusion)
- verifyStoreIntegrity=true explicit (pnpm v9+ default, now documented)
- removed: save-workspace-protocol, eslint/prettier hoist patterns, ignore-workspace-root-check (all monorepo cargo on a single-package project)
- git rm HANDOFF.md (superseded by .remember/ memory system)
- git rm scripts/migrations/ (migrate-tokens.mjs was a one-shot; already executed)
- rm 24 root-level debug PNGs; removed /*.png|jpg|jpeg|webp from .gitignore so future screenshots surface in git status instead of silently accumulating"
```

- [ ] **Step 6: Confirm the commit looks right**

```bash
git show --stat HEAD
```

Expected: shows `.npmrc`, `.gitignore`, `HANDOFF.md`, `scripts/migrations/migrate-tokens.mjs` in the diff. No source files, no test files.
