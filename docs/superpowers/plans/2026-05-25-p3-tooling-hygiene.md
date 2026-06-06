# P3 Tooling Hygiene Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the remaining actionable P3 findings from the principal review migration spec: fix the sentinel duplication, enable the missing TS flag, add rgba leak detection, extract shared CSS scanner, and parallelize the quality CI job.

**Architecture:** Two PRs. PR-A contains low-risk fixes that touch 3 files (tsconfig, mock-backend, lint script). PR-B contains tooling infrastructure (shared script lib + CI job split). Both build on `main`; PR-A merges first.

**Tech Stack:** TypeScript strict, Node ESM scripts (.mjs), GitHub Actions workflow YAML, Vitest.

**Pre-verified (no work needed):**
- P3-4: `HiringProfileSchema.parse()` already called at module load in `lib/hiring-profile.ts`
- P3-7: `verbatimModuleSyntax: true` already in `tsconfig.json`
- P3-11: 43KB island gate is infeasible with Turbopack; `check-bundle-size.mjs` comment documents this

---

## PR-A: Quick wins (P3-5, P3-6, P3-13)

Branch: `chore/p3-quick-wins`

**Files:**
- Modify: `tests/e2e/_helpers/mock-backend.ts:30-33` — import sentinel from lib
- Modify: `tsconfig.json` — enable `noPropertyAccessFromIndexSignature`
- Modify: `scripts/lint-no-magic-values.mjs` — add rgba color-function check
- Modify: `scripts/lint-no-magic-values.allowlist.json` — add `color-functions` key with 29 existing values
- Modify: `__tests__/scripts/lint-no-magic-values.test.ts` (if it exists) or create it

---

### Task A1: Fix STREAM_ERR_SENTINEL duplication (P3-5)

**Files:**
- Modify: `tests/e2e/_helpers/mock-backend.ts`

The file currently duplicates the sentinel inline to avoid importing from the app. Since `lib/stream-protocol.ts` has no `server-only` guard and the root `tsconfig.json` has `paths: { "@/*": ["./*"] }` which Playwright respects, we import it directly. Use a relative path to be safe since no other e2e helper currently uses `@/` imports.

- [ ] **Step 1: Verify Playwright can resolve a relative lib import**

Run:
```bash
node -e "const p = require('./lib/stream-protocol'); console.log(p.STREAM_ERR_SENTINEL.charCodeAt(0));"
```
Expected output: `0` (NUL byte char code)

- [ ] **Step 2: Replace the inline constant with an import**

In `tests/e2e/_helpers/mock-backend.ts`, replace lines 29-33:

OLD:
```ts
import type { Page } from '@playwright/test';

// STREAM_ERR_SENTINEL matches lib/stream-protocol.ts. Duplicated here so the
// mock does not need to import from the app.
const STREAM_ERR_SENTINEL = '\x00ERR:';
```

NEW:
```ts
import type { Page } from '@playwright/test';
import { STREAM_ERR_SENTINEL } from '../../../lib/stream-protocol';
```

- [ ] **Step 3: Run E2E smoke test to verify sentinel still works**

```bash
pnpm test:e2e --project=chromium tests/e2e/observability-smoke.spec.ts 2>&1 | tail -10
```
Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/_helpers/mock-backend.ts
git commit -m "refactor(test): import STREAM_ERR_SENTINEL from lib instead of duplicating"
```

---

### Task A2: Enable noPropertyAccessFromIndexSignature (P3-6)

**Files:**
- Modify: `tsconfig.json`

Pre-verified: `npx tsc --noEmit` with this flag enabled produces 0 project-local errors.

- [ ] **Step 1: Flip the flag**

In `tsconfig.json`, change:
```json
"noPropertyAccessFromIndexSignature": false,
```
to:
```json
"noPropertyAccessFromIndexSignature": true,
```

- [ ] **Step 2: Verify typecheck passes**

```bash
pnpm typecheck 2>&1 | grep -E "error TS|Found [0-9]+ error"
```
Expected: no output (clean).

- [ ] **Step 3: Run unit tests**

```bash
pnpm test --run 2>&1 | tail -5
```
Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add tsconfig.json
git commit -m "chore(ts): enable noPropertyAccessFromIndexSignature"
```

---

### Task A3: Add rgba color-function detection (P3-13)

**Files:**
- Modify: `scripts/lint-no-magic-values.mjs`
- Modify: `scripts/lint-no-magic-values.allowlist.json`

The 29 unique rgba values currently in use need to go into the allowlist so existing code keeps passing. The check prevents future unallowlisted rgba additions.

- [ ] **Step 1: Add the `color-functions` key to the allowlist**

In `scripts/lint-no-magic-values.allowlist.json`, add a new top-level key `"color-functions"` after `"z-index-values"`. Each entry follows the existing `{ "value": "...", "reason": "..." }` shape:

```json
"color-functions": [
  { "value": "rgba(0, 0, 0, 0)", "reason": "transparent black — gradient endpoint" },
  { "value": "rgba(0, 0, 0, 0.38)", "reason": "vignette overlay — CRT corner darkening" },
  { "value": "rgba(0, 0, 0, 0.45)", "reason": "CRT scanline pixel stop — exact opacity required" },
  { "value": "rgba(0, 0, 0, 0.55)", "reason": "module backdrop scrim — no semantic overlay token" },
  { "value": "rgba(0, 0, 0, 0.6)", "reason": "dialog/overlay scrim" },
  { "value": "rgba(0, 0, 0, 0.85)", "reason": "heavy scrim — near-opaque backdrop" },
  { "value": "rgba(0, 0, 0, 0.92)", "reason": "dock backdrop — near-black translucent surface" },
  { "value": "rgba(0, 80, 20, 0.12)", "reason": "CRT phosphor glow radial — dark green ambient, no token" },
  { "value": "rgba(0, 255, 0, 0.06)", "reason": "CRT RGB sub-pixel green channel — exact geometry required" },
  { "value": "rgba(0, 255, 65, 0.015)", "reason": "signal-green opacity variant — hairline glow" },
  { "value": "rgba(0, 255, 65, 0.02)", "reason": "signal-green opacity variant — barely-visible tint" },
  { "value": "rgba(0, 255, 65, 0.025)", "reason": "signal-green opacity variant" },
  { "value": "rgba(0, 255, 65, 0.03)", "reason": "signal-green opacity variant — subtle tint" },
  { "value": "rgba(0, 255, 65, 0.04)", "reason": "signal-green opacity variant — hover/focus surface" },
  { "value": "rgba(0, 255, 65, 0.06)", "reason": "signal-green opacity variant — light surface" },
  { "value": "rgba(0, 255, 65, 0.1)", "reason": "signal-green opacity variant" },
  { "value": "rgba(0, 255, 65, 0.12)", "reason": "signal-green opacity variant — dock highlight" },
  { "value": "rgba(0, 255, 65, 0.15)", "reason": "signal-green opacity variant" },
  { "value": "rgba(0, 255, 65, 0.18)", "reason": "signal-green opacity variant" },
  { "value": "rgba(0, 255, 65, 0.25)", "reason": "signal-green opacity variant" },
  { "value": "rgba(0, 255, 65, 0.3)", "reason": "signal-green opacity variant" },
  { "value": "rgba(0, 255, 65, 0.35)", "reason": "signal-green opacity variant" },
  { "value": "rgba(0, 255, 65, 0.4)", "reason": "signal-green opacity variant" },
  { "value": "rgba(0, 255, 65, 0.45)", "reason": "signal-green opacity variant" },
  { "value": "rgba(0, 255, 65, 0.5)", "reason": "signal-green opacity variant" },
  { "value": "rgba(0, 255, 65, 0.55)", "reason": "signal-green opacity variant" },
  { "value": "rgba(0, 255, 65, 0.6)", "reason": "signal-green opacity variant" },
  { "value": "rgba(0, 0, 255, 0.06)", "reason": "CRT RGB sub-pixel blue channel — exact geometry required" },
  { "value": "rgba(255, 0, 0, 0.06)", "reason": "CRT RGB sub-pixel red channel — exact geometry required" }
]
```

- [ ] **Step 2: Load the new allowlist key in the script**

In `scripts/lint-no-magic-values.mjs`, after the existing allowlist variable declarations (around line 20), add:

```js
const allowedColorFunctions = new Set(
  (allowlist['color-functions'] ?? []).map((e) => e.value),
);
```

- [ ] **Step 3: Add the rgba check to the checks array**

In `scripts/lint-no-magic-values.mjs`, inside the `const checks = [...]` array, add after the hex-colors check:

```js
// rgba / rgb / hsl color function calls — each variant must be allowlisted with a reason
{
  pattern: /\b(?:rgba?|hsla?)\s*\([^)]*\)/g,
  extract: (m) => m.replace(/\s+/g, ' ').trim(),
  filter: (m) => !allowedColorFunctions.has(m),
  message: (m) =>
    `hardcoded color function ${m} — use a --ds-color-* token or add to allowlist with a reason`,
},
```

- [ ] **Step 4: Run the lint script to verify it passes on the current codebase**

```bash
node scripts/lint-no-magic-values.mjs 2>&1 | tail -5
```
Expected: `No-magic-values check passed (N files).`

If any violations appear, the value is missing from the allowlist — add it following the existing format and re-run.

- [ ] **Step 5: Verify the check catches a new unlisted rgba**

Create a temp file and test:
```bash
echo '.test { color: rgba(1, 2, 3, 0.99); }' > /tmp/test.module.css
# Temporarily point the glob to catch it:
node -e "
const {readFileSync} = require('fs');
const script = readFileSync('scripts/lint-no-magic-values.mjs', 'utf8');
console.log(script.includes('allowedColorFunctions') ? 'check present' : 'MISSING');
"
```
Expected: `check present`

- [ ] **Step 6: Run all unit tests**

```bash
pnpm test --run 2>&1 | tail -5
```
Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add scripts/lint-no-magic-values.mjs scripts/lint-no-magic-values.allowlist.json
git commit -m "feat(lint): add rgba/color-function leak detection to no-magic-values gate"
```

---

### Task A4: PR-A gate and open PR

- [ ] **Step 1: Run local CI chain**

```bash
pnpm ci:local 2>&1 | tail -10
```
Expected: all checks pass.

- [ ] **Step 2: Check PR size**

```bash
pnpm pr-size 2>&1 | tail -5
```

- [ ] **Step 3: Open PR**

```bash
gh pr create --title "chore(quality): P3 quick wins — tsconfig flag, sentinel dedup, rgba detection" \
  --body "$(cat .github/pull_request_template.md)"
```
Fill every section. Then:
```bash
pnpm validate-pr-body <pr-number>
```

---

## PR-B: Tooling infrastructure (P3-9, P3-10)

Branch: `chore/p3-tooling`

**Files:**
- Create: `scripts/lib/scan-css.mjs` — shared CSS file globbing + comment stripping
- Modify: `scripts/lint-no-magic-values.mjs` — consume shared lib
- Modify: `scripts/lint-token-boundary.mjs` — consume shared lib
- Modify: `.github/workflows/ci.yml` — split quality job into parallel fast-checks + typecheck

---

### Task B1: Extract shared CSS scanner (P3-9)

**Files:**
- Create: `scripts/lib/scan-css.mjs`
- Modify: `scripts/lint-no-magic-values.mjs`
- Modify: `scripts/lint-token-boundary.mjs`

Both lint scripts share: ROOT path resolution, the identical glob call with the same ignore list, and the `stripComments` function. Extracting these ensures the ignore list never drifts between the two scripts.

- [ ] **Step 1: Write the shared module**

Create `scripts/lib/scan-css.mjs`:
```js
#!/usr/bin/env node
// Shared utilities for CSS module scanning scripts.
import { readFileSync } from 'node:fs';
import { glob } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const CSS_IGNORE = ['node_modules/**', '.next/**', '.claude/**', 'design-system/dist/**'];

/** Strip block comments, preserving line count. */
export function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, ' '));
}

/**
 * Glob all *.module.css files under ROOT.
 * Returns array of { rel, abs, raw, stripped } objects.
 * `stripped` has comments removed. Callers apply additional preprocessing.
 */
export async function scanCssModules() {
  const files = await Array.fromAsync(
    glob('**/*.module.css', { cwd: ROOT, ignore: CSS_IGNORE }),
  );
  return files.sort().map((rel) => {
    const abs = path.join(ROOT, rel);
    const raw = readFileSync(abs, 'utf8');
    return { rel, abs, raw, stripped: stripComments(raw) };
  });
}
```

- [ ] **Step 2: Update lint-token-boundary.mjs to consume the shared module**

Replace the top of `scripts/lint-token-boundary.mjs` from:
```js
import { readFileSync } from 'node:fs';
import { glob } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
```
to:
```js
import { scanCssModules } from './lib/scan-css.mjs';
```

Replace the glob + file loop:
```js
const files = await Array.fromAsync(
  glob('**/*.module.css', {
    cwd: ROOT,
    ignore: ['node_modules/**', '.next/**', '.claude/**', 'design-system/dist/**'],
  }),
);

let violations = 0;
for (const rel of files) {
  const abs = path.join(ROOT, rel);
  const content = readFileSync(abs, 'utf8');
  for (const { pattern, hint } of FORBIDDEN) {
```
with:
```js
const cssFiles = await scanCssModules();

let violations = 0;
for (const { rel, stripped: content } of cssFiles) {
  for (const { pattern, hint } of FORBIDDEN) {
```

Update the footer log from `files.length` to `cssFiles.length`:
```js
console.log(`Token boundary check passed (${cssFiles.length} files).`);
```

- [ ] **Step 3: Update lint-no-magic-values.mjs to consume the shared module**

Replace the top imports in `scripts/lint-no-magic-values.mjs`:
```js
import { readFileSync } from 'node:fs';
import { glob } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
```
with:
```js
import { readFileSync } from 'node:fs';
import { ROOT, scanCssModules } from './lib/scan-css.mjs';
```
(Keep `readFileSync` for the allowlist file read.)

Replace the glob + loop section:
```js
const files = await Array.fromAsync(
  glob('**/*.module.css', {
    cwd: ROOT,
    ignore: ['node_modules/**', '.next/**', '.claude/**', 'design-system/dist/**'],
  }),
);

let violations = 0;
for (const rel of files.sort()) {
  const abs = path.join(ROOT, rel);
  const raw = readFileSync(abs, 'utf8');
  const content = stripVarCalls(stripMediaConditions(stripComments(raw)));
```
with:
```js
const cssFiles = await scanCssModules();

let violations = 0;
for (const { rel, raw } of cssFiles) {
  const content = stripVarCalls(stripMediaConditions(raw));
```
Note: `scanCssModules()` already calls `stripComments` internally — remove the `stripComments(raw)` call from the pipeline here since `raw` is already comment-stripped in `stripped`, but we're using `raw` and then applying `stripMediaConditions` + `stripVarCalls`. Actually, keep using `raw` and call the full pipeline — just remove the explicit `stripComments` import from this script since it now comes from the shared lib if needed, or inline as before. 

Actually, the cleanest approach is: `scanCssModules()` provides `raw` (original) and `stripped` (comments removed). `lint-no-magic-values.mjs` needs to apply `stripMediaConditions` and `stripVarCalls` on top of the comment-stripped content. So:

```js
for (const { rel, stripped } of cssFiles) {
  const content = stripVarCalls(stripMediaConditions(stripped));
```

Update the footer:
```js
console.log(`No-magic-values check passed (${cssFiles.length} files).`);
```

- [ ] **Step 4: Verify both lint scripts still pass**

```bash
pnpm lint:token-boundary 2>&1 | tail -3
pnpm lint:no-magic-values 2>&1 | tail -3
```
Expected: both report 0 violations.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/scan-css.mjs scripts/lint-token-boundary.mjs scripts/lint-no-magic-values.mjs
git commit -m "refactor(scripts): extract shared CSS scanner to scripts/lib/scan-css.mjs"
```

---

### Task B2: Parallelize CI quality job (P3-10)

**Files:**
- Modify: `.github/workflows/ci.yml`

Split the single `quality` job (13 sequential steps, ~37s) into two parallel jobs:
- `quality-fast`: all checks except `tsc` (~8-10s)
- `typecheck`: `tsc --noEmit` only (~25s)

Both run on every push. Jobs that depend on `quality` (none currently) would need to depend on both.

- [ ] **Step 1: Read the current quality job**

```bash
sed -n '29,110p' .github/workflows/ci.yml
```
Confirm the steps list matches what's in this plan.

- [ ] **Step 2: Replace the quality job with two parallel jobs**

In `.github/workflows/ci.yml`, replace the entire `quality:` job (lines ~30-108) with:

```yaml
  quality-fast:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: read
    timeout-minutes: 8
    concurrency:
      group: quality-fast-${{ github.ref }}
      cancel-in-progress: true
    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 0

      - uses: pnpm/action-setup@v6

      - uses: actions/setup-node@v6
        with:
          node-version: 22
          cache: pnpm

      - name: Install
        run: pnpm install --frozen-lockfile

      - name: Lint branch name
        env:
          BRANCH: ${{ github.head_ref || github.ref_name }}
        run: |
          echo "$BRANCH" | grep -qE '^(feat|fix|chore|docs|refactor|perf|test|build|ci|style|revert|dependabot|design-system)/.+$|^main$' \
            || (echo "Invalid branch name: $BRANCH" && exit 1)

      - name: Lint commit messages
        if: github.event_name == 'pull_request'
        run: npx commitlint --from ${{ github.event.pull_request.base.sha }} --to ${{ github.event.pull_request.head.sha }} --verbose

      - name: Biome check
        run: pnpm biome ci .

      - name: Validate content
        run: pnpm validate-content

      - name: Client-naming gate
        run: pnpm check:client-naming

      - name: Dependency-pinning gate
        run: pnpm check:dep-pinning

      - name: Harness size gate
        run: node scripts/check-harness-size.mjs

      - name: Component docs coverage
        run: pnpm check:component-docs

      - name: Token drift check
        run: pnpm tokens:check

      - name: Token boundary lint
        run: pnpm lint:token-boundary

      - name: No-magic-values lint
        run: pnpm lint:no-magic-values

      - name: Contrast check
        run: pnpm lint:contrast

      - name: Package age check (supply-chain, info-only)
        run: node scripts/check-pkg-age.mjs --warn-only

      - name: PR comment merge gate
        if: github.event_name == 'pull_request'
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: pnpm tsx scripts/check-pr-comments.ts ${{ github.event.pull_request.number }}

  typecheck:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    concurrency:
      group: typecheck-${{ github.ref }}
      cancel-in-progress: true
    steps:
      - uses: actions/checkout@v6

      - uses: pnpm/action-setup@v6

      - uses: actions/setup-node@v6
        with:
          node-version: 22
          cache: pnpm

      - name: Install
        run: pnpm install --frozen-lockfile

      - name: Type check
        run: pnpm tsc --noEmit
```

- [ ] **Step 3: Update scripts/check-branch-protection.ts if it references the quality job name**

```bash
grep -n "quality" scripts/check-branch-protection.ts scripts/ready-to-merge.ts 2>/dev/null
```
If any script hard-codes `"quality"` as a required status check name, update to `"quality-fast"` (or add both). GitHub branch protection required status checks are configured in the repo settings, not in YAML — this step is just a sanity check.

- [ ] **Step 4: Push to a test branch and verify CI runs both jobs**

```bash
git push origin chore/p3-tooling
```
Then:
```bash
gh run list --branch chore/p3-tooling --limit 1 2>&1 | head -5
```
Wait for the run to show `quality-fast` and `typecheck` as separate jobs.

- [ ] **Step 5: Verify the quality job referenced in pnpm ready-to-merge still resolves**

```bash
grep -n "quality" scripts/ready-to-merge.ts scripts/check-branch-protection.ts
```
If `"quality"` is used as a required check name in either script, change to `"quality-fast"`.

Note: GitHub's required status checks in branch protection must be updated in repo settings to use `quality-fast` and `typecheck` instead of `quality`. After merging PR-B, update branch protection via:
```bash
# Informational — repo owner must update branch protection settings manually
# Settings → Branches → main → Require status checks → replace "quality" with "quality-fast" + "typecheck"
```

- [ ] **Step 6: Run ci:local to verify nothing local is broken**

```bash
pnpm ci:local 2>&1 | tail -10
```

- [ ] **Step 7: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: split quality job into parallel quality-fast + typecheck"
```

---

### Task B3: PR-B gate and open PR

- [ ] **Step 1: Run local CI chain**

```bash
pnpm ci:local 2>&1 | tail -10
```
Expected: all checks pass.

- [ ] **Step 2: Open PR**

```bash
gh pr create --title "chore(ci): P3 tooling — shared CSS scanner + parallel quality CI" \
  --body "$(cat .github/pull_request_template.md)"
```
Fill every section. Then:
```bash
pnpm validate-pr-body <pr-number>
```

---

## Deferred (per spec + scope assessment)

| ID | Finding | Reason deferred |
|---|---|---|
| P3-1 | Token enforcement aspirational | Large blast radius — touches all 31 .module.css files; separate PR |
| P3-3 | `_base.css` cascade pollution | Spec says scope creep; touches every component |
| P3-8 | CLAUDE.md line ceiling | Separate maintenance PR; no runtime impact |
| P3-12 | DS docs gate semantic (ts-morph) | Build tooling investment; separate PR |
| P3-11 | 43KB island CI gate | Infeasible with Turbopack; `check-bundle-size.mjs` documents this |

---

## Notes for the executor

- Run `pnpm lint:no-magic-values` after every CSS change to confirm no new violations
- After PR-B merges, **manually update GitHub branch protection** to replace the required check `quality` with `quality-fast` + `typecheck` — this cannot be automated without admin API token
- The rgba allowlist in Task A3 is exhaustive for the current codebase; any new rgba value added to a `.module.css` without an allowlist entry will fail the gate
