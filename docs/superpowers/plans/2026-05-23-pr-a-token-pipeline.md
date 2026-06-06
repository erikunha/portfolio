> **Status: Superseded by PR #80** — Tailwind v4 migration replaces the CSS module + Style Dictionary system described here. See `docs/superpowers/specs/2026-05-31-tailwind-v4-migration-design.md` and `DECISIONS.md` (2026-05-31 entry).

# PR A — Token Pipeline + Migration Implementation Plan

> **HISTORICAL DOCUMENT — do not follow as implementation guidance.** This plan was authored before implementation and describes a design that partially diverged during execution. Specifically: `layer.json` and `--ds-layer-*` tokens were never created (the token is dead code per audit finding P3-2 in `docs/superpowers/specs/2026-05-25-principal-review-migration.md`); `tokens.ts` and `tokens.figma.json` were not added to the Style Dictionary output. The authoritative token surface is documented in `STANDARDS.md` Ch.12.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `app/css/_tokens.css` with a Style Dictionary–driven two-tier token pipeline; migrate all 31 `.module.css` files and 4 `.tsx` inline-style call sites to the new token names; add 4 CI lint gates; portfolio renders within visual baseline tolerance.

**Architecture:** JSON token files in `design-system/tokens/` are the source of truth. Style Dictionary reads them and generates `design-system/dist/tokens.css` (both tiers as CSS custom properties), `tokens.ts` (typed const tree), and `tokens.json` (flat key/value). `app/globals.css` imports the dist file. A codemod script renames all legacy token references. Four lint scripts (token-boundary, no-magic-values, contrast check, drift check) enforce the system in CI.

**Tech Stack:** Style Dictionary v5 (exact-pinned), Node ESM scripts (`.mjs`), pnpm, Biome, Vitest, Playwright, GitHub Actions CI

---

## File Map

**Created:**
- `design-system/tokens/color.json`
- `design-system/tokens/space.json`
- `design-system/tokens/typography.json`
- `design-system/tokens/motion.json`
- `design-system/tokens/layer.json`
- `design-system/tokens/border.json`
- `design-system/sd.config.ts`
- `design-system/dist/tokens.css` (committed — not gitignored)
- `design-system/dist/tokens.ts` (committed)
- `design-system/dist/tokens.json` (committed)
- `scripts/migrate-tokens.mjs`
- `scripts/lint-token-boundary.mjs`
- `scripts/lint-no-magic-values.mjs`
- `scripts/lint-no-magic-values.allowlist.json`
- `scripts/contrast-check.mjs`

**Modified:**
- `package.json` — add `tokens:build`, `tokens:check`, `prebuild` scripts
- `app/globals.css` — update token import path
- All 31 `.module.css` files (codemod-rewritten)
- `components/sections/HottestTakesSection.tsx` — refactor inline style to className
- `components/sections/ResponsibilitiesSection.tsx` — refactor inline style to className
- `.github/workflows/ci.yml` — 4 new gate steps
- `DECISIONS.md`, `ARCHITECTURE.md` — ADR entries

**Deleted:**
- `app/css/_tokens.css`

---

## Task 1: Install Style Dictionary and create directory structure

**Files:**
- Modify: `package.json`
- Create: `design-system/tokens/` (directory)
- Create: `design-system/dist/` (directory, will be populated in Task 4)

- [ ] **Step 1: Install Style Dictionary exact-pinned**

```bash
pnpm add -D -E style-dictionary
```

Expected output: `+ style-dictionary X.Y.Z` added to devDependencies with exact version.

- [ ] **Step 2: Create the design-system directory structure**

```bash
mkdir -p design-system/tokens design-system/dist design-system/lib design-system/components
```

- [ ] **Step 3: Verify package.json has exact-pinned style-dictionary**

Run: `grep "style-dictionary" package.json`
Expected: `"style-dictionary": "X.Y.Z"` (no `^` or `~` prefix)

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "feat(design-system): install style-dictionary for token pipeline"
```

---

## Task 2: Write color token file

**Files:**
- Create: `design-system/tokens/color.json`

The file uses DTCG token format (`$value`, `$type`). Primitive tokens are defined with raw values; semantic tokens reference primitives using `{token.name}` syntax.

- [ ] **Step 1: Write `design-system/tokens/color.json`**

```json
{
  "ds-green-50": { "$value": "#0a1f0d", "$type": "color" },
  "ds-green-100": { "$value": "rgba(0, 255, 65, 0.1)", "$type": "color" },
  "ds-green-150": { "$value": "rgba(0, 255, 65, 0.12)", "$type": "color" },
  "ds-green-300": { "$value": "rgba(0, 255, 65, 0.2)", "$type": "color" },
  "ds-green-400": { "$value": "rgba(0, 255, 65, 0.4)", "$type": "color" },
  "ds-green-500": { "$value": "#00FF41", "$type": "color" },
  "ds-green-700": { "$value": "#0a8a2a", "$type": "color" },
  "ds-text-100": { "$value": "#E6FFE6", "$type": "color" },
  "ds-text-300": { "$value": "#5AE07B", "$type": "color" },
  "ds-neutral-0": { "$value": "#000000", "$type": "color" },
  "ds-neutral-50": { "$value": "#050505", "$type": "color" },
  "ds-accent-amber": { "$value": "#ffd86b", "$type": "color" },
  "ds-accent-cyan": { "$value": "#7fe4ff", "$type": "color" },
  "ds-feedback-error": { "$value": "#ff8a8a", "$type": "color" },
  "ds-chrome-close": { "$value": "#ff5f57", "$type": "color" },
  "ds-chrome-minimize": { "$value": "#febc2e", "$type": "color" },
  "ds-chrome-maximize": { "$value": "#28c840", "$type": "color" },
  "ds-color-signal": { "$value": "{ds-green-500}", "$type": "color" },
  "ds-color-signal-subtle": { "$value": "{ds-green-400}", "$type": "color" },
  "ds-color-signal-quiet": { "$value": "{ds-green-100}", "$type": "color" },
  "ds-color-signal-faint": { "$value": "{ds-green-150}", "$type": "color" },
  "ds-color-text-body": { "$value": "{ds-text-100}", "$type": "color" },
  "ds-color-text-muted": { "$value": "{ds-green-400}", "$type": "color" },
  "ds-color-text-faint": { "$value": "{ds-text-300}", "$type": "color" },
  "ds-color-surface-base": { "$value": "{ds-neutral-0}", "$type": "color" },
  "ds-color-surface-shell": { "$value": "{ds-neutral-50}", "$type": "color" },
  "ds-color-border-default": { "$value": "{ds-green-300}", "$type": "color" },
  "ds-color-feedback-error": { "$value": "{ds-feedback-error}", "$type": "color" },
  "ds-color-accent-warm": { "$value": "{ds-accent-amber}", "$type": "color" },
  "ds-color-accent-cool": { "$value": "{ds-accent-cyan}", "$type": "color" },
  "ds-color-highlight-bg": { "$value": "{ds-green-500}", "$type": "color" },
  "ds-color-highlight-fg": { "$value": "{ds-neutral-0}", "$type": "color" }
}
```

Note on `ds-color-border-default`: maps to `--ds-green-300` (rgba(0,255,65,0.2)), which is what current `--border` resolves to.

- [ ] **Step 2: Commit**

```bash
git add design-system/tokens/color.json
git commit -m "feat(design-system): add color token definitions (primitives + semantic)"
```

---

## Task 3: Write remaining token files

**Files:**
- Create: `design-system/tokens/space.json`
- Create: `design-system/tokens/typography.json`
- Create: `design-system/tokens/motion.json`
- Create: `design-system/tokens/layer.json`
- Create: `design-system/tokens/border.json`

- [ ] **Step 1: Write `design-system/tokens/space.json`**

```json
{
  "ds-space-1": { "$value": "4px", "$type": "dimension" },
  "ds-space-2": { "$value": "8px", "$type": "dimension" },
  "ds-space-3": { "$value": "12px", "$type": "dimension" },
  "ds-space-4": { "$value": "16px", "$type": "dimension" },
  "ds-space-5": { "$value": "20px", "$type": "dimension" },
  "ds-space-6": { "$value": "24px", "$type": "dimension" },
  "ds-space-8": { "$value": "32px", "$type": "dimension" },
  "ds-space-10": { "$value": "40px", "$type": "dimension" },
  "ds-space-12": { "$value": "48px", "$type": "dimension" },
  "ds-space-16": { "$value": "64px", "$type": "dimension" },
  "ds-space-pad": { "$value": "{ds-space-6}", "$type": "dimension" },
  "ds-space-pad-tight": { "$value": "{ds-space-3}", "$type": "dimension" },
  "ds-space-rhythm": { "$value": "{ds-space-16}", "$type": "dimension" },
  "ds-space-rhythm-tight": { "$value": "{ds-space-4}", "$type": "dimension" },
  "ds-layout-maxw": { "$value": "1200px", "$type": "dimension" }
}
```

- [ ] **Step 2: Write `design-system/tokens/typography.json`**

```json
{
  "ds-text-size-2xs": { "$value": "9px", "$type": "dimension" },
  "ds-text-size-xs": { "$value": "11px", "$type": "dimension" },
  "ds-text-size-sm": { "$value": "12px", "$type": "dimension" },
  "ds-text-size-base": { "$value": "14px", "$type": "dimension" },
  "ds-text-size-md": { "$value": "16px", "$type": "dimension" },
  "ds-text-size-lg": { "$value": "22px", "$type": "dimension" },
  "ds-text-size-xl": { "$value": "32px", "$type": "dimension" },
  "ds-text-size-2xl": { "$value": "48px", "$type": "dimension" },
  "ds-text-size-3xl": { "$value": "78px", "$type": "dimension" },
  "ds-text-leading-tight": { "$value": "1.2", "$type": "number" },
  "ds-text-leading-base": { "$value": "1.55", "$type": "number" },
  "ds-text-leading-relaxed": { "$value": "1.85", "$type": "number" },
  "ds-font-size-2xs": { "$value": "{ds-text-size-2xs}", "$type": "dimension" },
  "ds-font-size-xs": { "$value": "{ds-text-size-xs}", "$type": "dimension" },
  "ds-font-size-sm": { "$value": "{ds-text-size-sm}", "$type": "dimension" },
  "ds-font-size-body": { "$value": "{ds-text-size-base}", "$type": "dimension" },
  "ds-font-size-md": { "$value": "{ds-text-size-md}", "$type": "dimension" },
  "ds-font-size-heading-sm": { "$value": "{ds-text-size-lg}", "$type": "dimension" },
  "ds-font-size-heading-md": { "$value": "{ds-text-size-xl}", "$type": "dimension" },
  "ds-font-size-heading-lg": { "$value": "{ds-text-size-2xl}", "$type": "dimension" },
  "ds-font-size-heading-xl": { "$value": "{ds-text-size-3xl}", "$type": "dimension" },
  "ds-font-family-mono": { "$value": "var(--font-mono), ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", "$type": "fontFamily" },
  "ds-font-family-display": { "$value": "var(--font-display), ui-sans-serif, system-ui, sans-serif", "$type": "fontFamily" }
}
```

- [ ] **Step 3: Write `design-system/tokens/motion.json`**

```json
{
  "ds-duration-fast": { "$value": "80ms", "$type": "duration" },
  "ds-duration-base": { "$value": "200ms", "$type": "duration" },
  "ds-duration-slow": { "$value": "300ms", "$type": "duration" },
  "ds-ease-out": { "$value": "ease-out", "$type": "cubicBezier" },
  "ds-ease-in": { "$value": "ease-in", "$type": "cubicBezier" },
  "ds-ease-in-out": { "$value": "ease-in-out", "$type": "cubicBezier" }
}
```

- [ ] **Step 4: Write `design-system/tokens/layer.json`**

```json
{
  "ds-layer-base": { "$value": "0", "$type": "number" },
  "ds-layer-sticky": { "$value": "50", "$type": "number" },
  "ds-layer-overlay": { "$value": "100", "$type": "number" },
  "ds-layer-headline": { "$value": "150", "$type": "number" }
}
```

- [ ] **Step 5: Write `design-system/tokens/border.json`**

```json
{
  "ds-radius-none": { "$value": "0", "$type": "dimension" },
  "ds-radius-sharp": { "$value": "2px", "$type": "dimension" },
  "ds-border-width-default": { "$value": "1px", "$type": "dimension" },
  "ds-border-style-solid": { "$value": "solid", "$type": "string" },
  "ds-border-style-dashed": { "$value": "dashed", "$type": "string" }
}
```

- [ ] **Step 6: Commit all token files**

```bash
git add design-system/tokens/
git commit -m "feat(design-system): add space, typography, motion, layer, border tokens"
```

---

## Task 4: Write Style Dictionary config and generate dist

**Files:**
- Create: `design-system/sd.config.ts`
- Create: `design-system/dist/tokens.css` (generated)
- Create: `design-system/dist/tokens.ts` (generated)
- Create: `design-system/dist/tokens.json` (generated)

- [ ] **Step 1: Write `design-system/sd.config.ts`**

```typescript
import StyleDictionary from 'style-dictionary';

const sd = new StyleDictionary({
  source: ['design-system/tokens/**/*.json'],
  platforms: {
    css: {
      transformGroup: 'css',
      prefix: '',
      buildPath: 'design-system/dist/',
      files: [
        {
          destination: 'tokens.css',
          format: 'css/variables',
          options: {
            selector: ':root',
            outputReferences: true,
          },
        },
      ],
    },
    ts: {
      transformGroup: 'js',
      buildPath: 'design-system/dist/',
      files: [
        {
          destination: 'tokens.ts',
          format: 'javascript/es6',
        },
      ],
    },
    json: {
      buildGroup: 'json',
      buildPath: 'design-system/dist/',
      files: [
        {
          destination: 'tokens.json',
          format: 'json/flat',
        },
      ],
    },
  },
});

await sd.buildAllPlatforms();
```

- [ ] **Step 2: Add scripts to `package.json`**

In the `"scripts"` object, add these entries (after `"validate-content"`):

```json
"tokens:build": "tsx design-system/sd.config.ts",
"tokens:check": "tsx design-system/sd.config.ts && git diff --exit-code design-system/dist/"
```

Also add `"prebuild": "pnpm tokens:build"` so `pnpm build` always regenerates tokens.

- [ ] **Step 3: Run the token build**

```bash
pnpm tokens:build
```

Expected: Style Dictionary prints build success for three platforms (css, ts, json). Files appear in `design-system/dist/`.

- [ ] **Step 4: Verify the generated CSS**

```bash
head -30 design-system/dist/tokens.css
```

Expected: `:root {` with `--ds-green-50: #0a1f0d;` and semantic refs like `--ds-color-signal: var(--ds-green-500);`.

- [ ] **Step 5: Commit dist files and config**

```bash
git add design-system/sd.config.ts design-system/dist/ package.json
git commit -m "feat(design-system): style-dictionary config + generated token dist"
```

---

## Task 5: Write the token migration codemod

**Files:**
- Create: `scripts/migrate-tokens.mjs`

The codemod renames all old token names to new names across `.module.css` and `.tsx` files. It processes every file and writes back only if changed.

- [ ] **Step 1: Write `scripts/migrate-tokens.mjs`**

```javascript
#!/usr/bin/env node
// Renames legacy CSS custom property names to design-system token names.
// Run once; idempotent on subsequent runs.
import { readFileSync, writeFileSync } from 'node:fs';
import { glob } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');

// Order matters: longer names first to prevent partial matches.
// e.g. --signal-dim-2 before --signal-dim before --signal
const RENAME_MAP = [
  ['--signal-dim-2', '--ds-color-signal-quiet'],
  ['--signal-faint', '--ds-color-signal-faint'],
  ['--signal-dim', '--ds-color-signal-subtle'],
  ['--signal', '--ds-color-signal'],
  ['--muted-dim', '--ds-color-text-faint'],
  ['--muted', '--ds-color-text-muted'],
  ['--fg', '--ds-color-text-body'],
  ['--highlight-bg', '--ds-color-highlight-bg'],
  ['--highlight-fg', '--ds-color-highlight-fg'],
  ['--border', '--ds-color-border-default'],
  ['--red', '--ds-chrome-close'],
  ['--yellow', '--ds-chrome-minimize'],
  ['--green-light', '--ds-chrome-maximize'],
  ['--shell-bg', '--ds-color-surface-shell'],
  ['--accent-warm', '--ds-color-accent-warm'],
  ['--accent-cool', '--ds-color-accent-cool'],
  ['--error-soft', '--ds-color-feedback-error'],
  ['--bg', '--ds-color-surface-base'],
  ['--pad', '--ds-space-pad'],
  ['--maxw', '--ds-layout-maxw'],
  ['--vrhythm', '--ds-space-rhythm'],
  ['--font-mono-stack', '--ds-font-family-mono'],
  ['--font-display-stack', '--ds-font-family-display'],
  ['--fs-2xs', '--ds-font-size-2xs'],
  ['--fs-xs', '--ds-font-size-xs'],
  ['--fs-sm', '--ds-font-size-sm'],
  ['--fs-base', '--ds-font-size-body'],
  ['--fs-md', '--ds-font-size-md'],
  ['--fs-lg', '--ds-font-size-heading-sm'],
  ['--fs-xl', '--ds-font-size-heading-md'],
  ['--fs-2xl', '--ds-font-size-heading-lg'],
  ['--fs-3xl', '--ds-font-size-heading-xl'],
];

// Build a single regex that matches any legacy name in a var() context.
// For CSS: var(--signal) | For TSX inline: 'var(--signal)' or "var(--signal)"
const legacyNames = RENAME_MAP.map(([from]) => from.replace(/[-]/g, '\\$&'));
const pattern = new RegExp(`(${legacyNames.join('|')})(?=[^-a-zA-Z0-9]|$)`, 'g');

function applyRenames(content) {
  return content.replace(pattern, (match) => {
    const entry = RENAME_MAP.find(([from]) => from === match);
    return entry ? entry[1] : match;
  });
}

// Process all .module.css files and .tsx files with inline style var() refs
const cssFiles = await Array.fromAsync(glob('**/*.module.css', { cwd: ROOT, ignore: ['node_modules/**', '.next/**', '.claude/**'] }));
const tsxFiles = [
  'components/sections/HottestTakesSection.tsx',
  'components/sections/ResponsibilitiesSection.tsx',
];
const allFiles = [...cssFiles, ...tsxFiles];

let changed = 0;
for (const rel of allFiles) {
  const abs = path.join(ROOT, rel);
  const original = readFileSync(abs, 'utf8');
  const updated = applyRenames(original);
  if (updated !== original) {
    writeFileSync(abs, updated, 'utf8');
    console.log(`  updated: ${rel}`);
    changed++;
  }
}

console.log(`\nMigration complete: ${changed} file(s) updated.`);
```

- [ ] **Step 2: Run the codemod (dry run — read output before committing)**

```bash
node scripts/migrate-tokens.mjs
```

Expected: List of updated files. Should be ~31 `.module.css` files plus 4 `.tsx` files.

- [ ] **Step 3: Verify a sample file was transformed correctly**

```bash
grep "ds-color-signal\|ds-font-size" components/sections/Hero.module.css | head -10
```

Expected: `var(--ds-color-signal)`, `var(--ds-font-size-heading-md)`, etc. No remaining `--signal`, `--fg`, `--fs-xl`.

- [ ] **Step 4: Check for any orphan references to legacy token names**

```bash
grep -r "\-\-signal\b\|\-\-fg\b\|\-\-muted\b\|\-\-pad\b\|\-\-bg\b\|\-\-vrhythm\b\|\-\-fs-\|\-\-red\b\|\-\-yellow\b\|\-\-green-light\b" --include="*.module.css" --include="*.tsx" --include="*.ts" --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.claude --exclude-dir=design-system/dist . 2>/dev/null
```

Expected: No output. If any legacy names remain, the codemod missed them — investigate and fix.

- [ ] **Step 5: Commit codemod script and transformed files**

```bash
git add scripts/migrate-tokens.mjs
git commit -m "feat(design-system): add token migration codemod"
git add -u
git commit -m "refactor(tokens): migrate all module.css + tsx inline styles to ds-* token names"
```

---

## Task 6: Update globals.css and delete the old tokens file

**Files:**
- Modify: `app/globals.css`
- Delete: `app/css/_tokens.css`

- [ ] **Step 1: Update the import in `app/globals.css`**

Open `app/globals.css`. Change:
```css
@import "./css/_tokens.css";
```
To:
```css
@import "../design-system/dist/tokens.css";
```

- [ ] **Step 2: Delete `app/css/_tokens.css`**

```bash
rm app/css/_tokens.css
```

- [ ] **Step 3: Verify the build still works**

```bash
pnpm build
```

Expected: Build succeeds. The design-system tokens are loaded via globals.css. Zero errors.

- [ ] **Step 4: Commit**

```bash
git add app/globals.css
git rm app/css/_tokens.css
git commit -m "refactor(tokens): import from design-system/dist; delete legacy _tokens.css"
```

---

## Task 7: Write lint-token-boundary script

**Files:**
- Create: `scripts/lint-token-boundary.mjs`

Rejects any `.module.css` file that references a CSS primitive that has a semantic alias — enforcing the two-tier discipline.

- [ ] **Step 1: Write `scripts/lint-token-boundary.mjs`**

```javascript
#!/usr/bin/env node
// Rejects direct primitive references in .module.css when a semantic alias exists.
// Run: node scripts/lint-token-boundary.mjs
import { readFileSync } from 'node:fs';
import { glob } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');

// Patterns that are FORBIDDEN (primitives that have semantic aliases).
// Use negative lookahead to avoid matching numeric-suffix tokens that
// look like typography names (--ds-text-size-* is allowed; --ds-text-\d+ is not).
const FORBIDDEN = [
  { pattern: /var\(--ds-green-\d+\)/g, hint: 'use --ds-color-* semantic alias' },
  { pattern: /var\(--ds-text-\d+\)/g, hint: 'use --ds-color-text-* semantic alias' },
  { pattern: /var\(--ds-neutral-\d+\)/g, hint: 'use --ds-color-surface-* semantic alias' },
  { pattern: /var\(--ds-accent-[a-z]+\)/g, hint: 'use --ds-color-accent-* semantic alias' },
  { pattern: /var\(--ds-feedback-[a-z]+\)/g, hint: 'use --ds-color-feedback-* semantic alias' },
  { pattern: /var\(--ds-space-\d+\)/g, hint: 'use --ds-space-pad/rhythm semantic alias' },
  { pattern: /var\(--ds-text-size-[a-z0-9-]+\)/g, hint: 'use --ds-font-size-* semantic alias' },
  { pattern: /var\(--ds-text-leading-[a-z-]+\)/g, hint: 'use --ds-font-family-* or line-height value' },
];

// Scan all .module.css files except the dist/tokens.css file (primitives are valid there).
const files = await Array.fromAsync(glob('**/*.module.css', {
  cwd: ROOT,
  ignore: ['node_modules/**', '.next/**', '.claude/**', 'design-system/dist/**'],
}));

let violations = 0;
for (const rel of files) {
  const abs = path.join(ROOT, rel);
  const content = readFileSync(abs, 'utf8');
  for (const { pattern, hint } of FORBIDDEN) {
    const matches = content.match(pattern);
    if (matches) {
      for (const m of matches) {
        console.error(`BOUNDARY VIOLATION in ${rel}: ${m} — ${hint}`);
        violations++;
      }
    }
  }
}

if (violations > 0) {
  console.error(`\n${violations} token boundary violation(s). Fix before merging.`);
  process.exit(1);
}
console.log(`Token boundary check passed (${files.length} files).`);
```

- [ ] **Step 2: Run and verify it passes**

```bash
node scripts/lint-token-boundary.mjs
```

Expected: `Token boundary check passed (31 files).` — no violations after the codemod in Task 5.

- [ ] **Step 3: Add script to package.json and commit**

In `package.json` scripts, add: `"lint:token-boundary": "node scripts/lint-token-boundary.mjs"`

Wire as a separate CI step in `.github/workflows/ci.yml` (not into the `verify` chain). The `verify` script covers Biome + typecheck + content + client-naming + dep-pinning + tests; token gates run as independent steps after `Token drift check` in the CI workflow.

```bash
git add scripts/lint-token-boundary.mjs package.json
git commit -m "feat(design-system): add token boundary lint gate"
```

---

## Task 8: Write lint-no-magic-values script

**Files:**
- Create: `scripts/lint-no-magic-values.mjs`
- Create: `scripts/lint-no-magic-values.allowlist.json`

- [ ] **Step 1: Create the allowlist**

```json
{
  "_comment": "Documented exceptions to the no-magic-values lint rule.",
  "hex-colors": [],
  "px-values": [
    { "value": "0px", "reason": "zero is not a magic value" },
    { "value": "1px", "reason": "border width, semantic — no 1px token needed" },
    { "value": "2px", "reason": "sub-pixel tweak / max corner radius (--ds-radius-sharp)" }
  ],
  "duration-values": [],
  "z-index-values": ["0"]
}
```

- [ ] **Step 2: Write `scripts/lint-no-magic-values.mjs`**

```javascript
#!/usr/bin/env node
// Rejects hardcoded magic values in .module.css: hex colors, non-token px,
// hardcoded ms/s durations, raw z-index integers.
import { readFileSync } from 'node:fs';
import { glob } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const allowlist = JSON.parse(
  readFileSync(path.join(ROOT, 'scripts/lint-no-magic-values.allowlist.json'), 'utf8')
);

const allowedPx = new Set(allowlist['px-values'].map((e) => e.value));
const allowedZIndex = new Set(allowlist['z-index-values']);

// Patterns to detect; each returns { match, message } or null
const checks = [
  // Hex colors outside var() arguments
  {
    pattern: /(?<!var\([^)]*?)#[0-9a-fA-F]{3,8}\b/g,
    message: (m) => `hardcoded hex color ${m} — use a --ds-color-* token`,
  },
  // Raw ms/s durations (not inside var())
  {
    pattern: /(?<!var\([^)]*?)\b\d+(?:\.\d+)?(?:ms|s)\b/g,
    message: (m) => `hardcoded duration ${m} — use var(--ds-duration-*)`,
  },
  // Raw px values not in allowlist (not inside var())
  {
    pattern: /(?<!var\([^)]*?)\b(\d+px)\b/g,
    filter: (m) => !allowedPx.has(m),
    message: (m) => `magic px value ${m} — use a --ds-space-* token or add to allowlist`,
  },
  // Hardcoded z-index integers
  {
    pattern: /z-index\s*:\s*(\d+)/g,
    extract: (m, p1) => p1,
    filter: (m) => !allowedZIndex.has(m),
    message: (m) => `hardcoded z-index ${m} — use var(--ds-layer-*)`,
  },
];

const files = await Array.fromAsync(glob('**/*.module.css', {
  cwd: ROOT,
  ignore: ['node_modules/**', '.next/**', '.claude/**', 'design-system/dist/**'],
}));

let violations = 0;
for (const rel of files) {
  const abs = path.join(ROOT, rel);
  const content = readFileSync(abs, 'utf8');
  for (const check of checks) {
    for (const match of content.matchAll(check.pattern)) {
      const val = check.extract ? check.extract(match[0], match[1]) : match[0];
      if (check.filter && !check.filter(val)) continue;
      console.error(`MAGIC VALUE in ${rel}: ${check.message(val)}`);
      violations++;
    }
  }
}

if (violations > 0) {
  console.error(`\n${violations} magic value(s) found. Fix or add to allowlist.`);
  process.exit(1);
}
console.log(`No-magic-values check passed (${files.length} files).`);
```

- [ ] **Step 3: Run — expect violations, then fix or allowlist them**

```bash
node scripts/lint-no-magic-values.mjs 2>&1 | head -40
```

Expected: Some violations (raw px values like `9px`, `12px`, etc. that are already token-equivalent). For each:
- If the value corresponds to a token (e.g., `12px` = `--ds-space-3`), replace it in the CSS.
- If it's a genuine exception (e.g., `4px` for a border-radius or animation offset), add it to the allowlist.

Iterate until the check passes.

- [ ] **Step 4: Add scripts and commit**

Add to `package.json`: `"lint:no-magic-values": "node scripts/lint-no-magic-values.mjs"`
Wire as a separate CI step in `.github/workflows/ci.yml` (not into the `verify` chain). Same pattern as `lint:token-boundary`.

```bash
git add scripts/lint-no-magic-values.mjs scripts/lint-no-magic-values.allowlist.json package.json
git add -u  # picks up any .module.css edits from the fix step
git commit -m "feat(design-system): add no-magic-values lint gate + allowlist"
```

---

## Task 9: Write contrast-check script

**Files:**
- Create: `scripts/contrast-check.mjs`

Computes WCAG contrast ratios for defined semantic text/surface pairs and fails on any pair below threshold.

- [ ] **Step 1: Write `scripts/contrast-check.mjs`**

```javascript
#!/usr/bin/env node
// Verifies WCAG AA contrast for defined semantic token pairs.
// Reads resolved values from design-system/dist/tokens.json.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tokens = JSON.parse(
  readFileSync(path.join(ROOT, 'design-system/dist/tokens.json'), 'utf8')
);

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const len = h.length === 3 ? 1 : 2;
  return [0, 1, 2].map((i) => parseInt(h.substring(i * len, i * len + len).padEnd(2, h[i * len]), 16));
}

function relativeLuminance([r, g, b]) {
  return [r, g, b].reduce((sum, c, i) => {
    const s = c / 255;
    const lin = s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    return sum + lin * [0.2126, 0.7152, 0.0722][i];
  }, 0);
}

function contrastRatio(hex1, hex2) {
  const L1 = relativeLuminance(hexToRgb(hex1));
  const L2 = relativeLuminance(hexToRgb(hex2));
  const [light, dark] = L1 > L2 ? [L1, L2] : [L2, L1];
  return (light + 0.05) / (dark + 0.05);
}

function resolveToken(name) {
  // tokens.json has flat key-value; keys use the CSS custom property name (with --)
  return tokens[`--${name}`] || tokens[name];
}

// Pairs: [foreground token, background token, min ratio, label]
const PAIRS = [
  ['ds-color-text-body', 'ds-color-surface-base', 4.5, 'body text on base'],
  ['ds-color-text-muted', 'ds-color-surface-base', 4.5, 'muted text on base'],
  ['ds-color-text-faint', 'ds-color-surface-base', 4.5, 'faint text on base'],
  ['ds-color-signal', 'ds-color-surface-base', 3.0, 'signal on base (large text)'],
  ['ds-color-text-body', 'ds-color-surface-shell', 4.5, 'body text on shell'],
  ['ds-color-signal', 'ds-color-surface-shell', 3.0, 'signal on shell (large text)'],
];

let failures = 0;
for (const [fg, bg, minRatio, label] of PAIRS) {
  const fgVal = resolveToken(fg);
  const bgVal = resolveToken(bg);
  if (!fgVal || !bgVal) {
    console.error(`MISSING TOKEN: ${fg} or ${bg}`);
    failures++;
    continue;
  }
  // Skip rgba values (can't compute without blending — rgba tokens are for non-text uses)
  if (fgVal.startsWith('rgba') || bgVal.startsWith('rgba')) {
    console.log(`SKIP: ${label} — rgba token (${fgVal} / ${bgVal})`);
    continue;
  }
  const ratio = contrastRatio(fgVal, bgVal);
  const pass = ratio >= minRatio;
  console.log(`${pass ? 'PASS' : 'FAIL'} ${label}: ${ratio.toFixed(2)}:1 (min ${minRatio}:1)`);
  if (!pass) failures++;
}

if (failures > 0) {
  console.error(`\n${failures} contrast failure(s).`);
  process.exit(1);
}
console.log('\nContrast check passed.');
```

- [ ] **Step 2: Run and verify**

```bash
node scripts/contrast-check.mjs
```

Expected: All PASS lines. If any FAIL, the token value needs to be adjusted.

- [ ] **Step 3: Add to package.json and commit**

Add: `"lint:contrast": "node scripts/contrast-check.mjs"`
Wire as a separate CI step in `.github/workflows/ci.yml` (not into the `verify` chain). Same pattern as `lint:token-boundary`.

```bash
git add scripts/contrast-check.mjs package.json
git commit -m "feat(design-system): add WCAG contrast check gate"
```

---

## Task 10: Add 4 CI gates to the workflow

**Files:**
- Modify: `.github/workflows/ci.yml`

Add four new steps to the `build-and-gate` job, after the existing `Validate content` step and before the `Build` step.

- [ ] **Step 1: Add the 4 new gate steps to `ci.yml`**

After the `- name: Dependency-pinning gate` step, add:

```yaml
      - name: Token build
        run: pnpm tokens:build

      - name: Token drift check
        run: pnpm tokens:check

      - name: Token boundary lint
        run: pnpm lint:token-boundary

      - name: No-magic-values lint
        run: pnpm lint:no-magic-values

      - name: Contrast check
        run: pnpm lint:contrast
```

(Five steps: token:build, drift, boundary, magic-values, contrast — the spec said 4 but boundary + magic-values + contrast + drift = 4 content gates; the build step is infrastructure.)

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add token pipeline gates (build, drift, boundary, contrast)"
```

---

## Task 11: Run full local verification and regenerate visual baselines

- [ ] **Step 1: Run full local CI gate**

```bash
pnpm ci:local
```

Expected: All checks pass (biome, typecheck, validate-content, client-naming, dep-pinning, token-boundary, no-magic-values, contrast, unit tests).

- [ ] **Step 2: Run a local build to confirm tokens wire correctly**

```bash
pnpm build
```

Expected: Build succeeds. No token-related errors.

- [ ] **Step 3: Regenerate Playwright visual baselines**

Start the preview server, then regenerate baselines for all 4 browser/viewport combinations:

```bash
pnpm build && pnpm start &
sleep 5
pnpm playwright test tests/e2e/visual.spec.ts --update-snapshots --project=chromium
pnpm playwright test tests/e2e/visual.spec.ts --update-snapshots --project=chromium-mobile
pnpm playwright test tests/e2e/visual.spec.ts --update-snapshots --project=webkit-desktop
pnpm playwright test tests/e2e/visual.spec.ts --update-snapshots --project=webkit-mobile
kill %1
```

Expected: Updated snapshot files in `tests/e2e/visual.spec.ts-snapshots/`.

- [ ] **Step 4: Commit updated baselines**

```bash
git add tests/e2e/visual.spec.ts-snapshots/
git commit -m "test(visual): regenerate baselines after token migration"
```

---

## Task 12: Update docs and DECISIONS.md

**Files:**
- Modify: `DECISIONS.md`
- Modify: `ARCHITECTURE.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add ADR entry to DECISIONS.md**

Add a bullet:

```
- 2026-05-23: Adopted two-tier token pipeline (Style Dictionary, design-system/tokens/*.json → dist/tokens.css). Replaces app/css/_tokens.css. Reversible via `git revert` + baseline regen. See design spec.
```

- [ ] **Step 2: Update ARCHITECTURE.md CSS section**

Add one line noting that `app/css/_tokens.css` is deleted and tokens now live in `design-system/dist/tokens.css`.

- [ ] **Step 3: Update CLAUDE.md stack section**

Change the CSS tokens line from `_tokens.css` to `design-system/dist/tokens.css`.

- [ ] **Step 4: Commit**

```bash
git add DECISIONS.md ARCHITECTURE.md CLAUDE.md
git commit -m "docs: update ADR + architecture for design-system token pipeline"
```

---

## Self-Review Checklist (run before opening PR)

- [ ] `pnpm ci:local` passes
- [ ] `pnpm build` succeeds
- [ ] `pnpm lint:token-boundary` passes (no primitive leakage)
- [ ] `pnpm lint:no-magic-values` passes (no orphan hex/px/ms values)
- [ ] `pnpm lint:contrast` passes (all WCAG AA pairs pass)
- [ ] `grep -r "\-\-signal\b\|\-\-fg\b\|\-\-pad\b\|\-\-bg\b\|\-\-fs-" --include="*.module.css" .` → no output
- [ ] `app/css/_tokens.css` is deleted (`git status` should not show it)
- [ ] `design-system/dist/tokens.css` is committed
- [ ] Visual baselines regenerated and committed
