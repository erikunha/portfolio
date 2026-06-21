# detect-changes Manifest + Stale-Pathspec Meta-Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hoist the `detect-changes` job's git pathspecs into an importable manifest, replace the inline shell with a plain-node runner that exactly preserves the `ai`/`app`/`ui` decision, and add a meta-gate that fails CI when any pathspec goes stale.

**Architecture:** Three plain-node (zero-dep) scripts under `scripts/`: a manifest of pathspec arrays (single source of truth), a runner that reads the manifest + runs `git diff` and writes `$GITHUB_OUTPUT`, and a validator that asserts every pathspec resolves. Decision logic is isolated into pure functions (`computeCategories`, `canonicalJSON`, `classifyPathspec`, `assertResolves`) so it is unit-testable without git; a temp-git-repo integration test proves byte-parity with the old shell.

**Tech Stack:** Node ESM `.mjs` (builtins only: `node:child_process`, `node:fs`, `node:path`, `node:url`), Vitest, co-located `.d.mts` declarations (allowJs:false), GitHub Actions YAML.

## Global Constraints

- Plain node, ZERO third-party imports in all three scripts (CI runs them without `pnpm install`). Builtins only.
- Exit-code taxonomy (from #162): **2 = gate cannot run / orphaned (infra)**, **1 = unexpected runner error**, **0 = clean**.
- Entry guard verbatim: `typeof process.argv[1] === 'string' && import.meta.url === pathToFileURL(process.argv[1]).href` (standardized in #161).
- `.mjs` imported by a `.ts` test needs a co-located `.d.mts` (the `check-semgrep-fixture.d.mts` pattern).
- No em-dash (`-`) anywhere; use a hyphen.
- Pure lift-and-shift: the pathspec lists are copied VERBATIM from `ci.yml` lines 523-566; do not add/remove/reorder paths.
- `git add` only the specific files each task creates/modifies; never `git add .`/`-A`.

---

### Task 1: Manifest (single source of truth)

**Files:**
- Create: `scripts/detect-changes-paths.mjs`
- Create: `scripts/detect-changes-paths.d.mts`
- Test: `scripts/__tests__/detect-changes-paths.test.ts`

**Interfaces:**
- Produces: `AI_PATHS: string[]`, `APP_PATHS: string[]`, `UI_PATHS: string[]` (arrays of git pathspecs, incl. `:(exclude)…` magic in `UI_PATHS`).

- [ ] **Step 1: Write the failing test**

```ts
// scripts/__tests__/detect-changes-paths.test.ts
import { describe, expect, it } from 'vitest';
import { AI_PATHS, APP_PATHS, UI_PATHS } from '../detect-changes-paths.mjs';

describe('detect-changes manifest', () => {
  it('exports non-empty path arrays (anti-vacuous)', () => {
    expect(AI_PATHS.length).toBeGreaterThan(0);
    expect(APP_PATHS.length).toBeGreaterThan(0);
    expect(UI_PATHS.length).toBeGreaterThan(0);
  });

  it('keeps the load-bearing anchor pathspecs (guards against a truncated copy)', () => {
    expect(AI_PATHS).toContain('lib/eval/');
    expect(AI_PATHS).toContain('__tests__/ask-*');
    expect(APP_PATHS).toContain('.github/workflows/');
    expect(APP_PATHS).toContain('package.json');
    expect(UI_PATHS).toContain(':(exclude)lib/eval/**');
    expect(UI_PATHS).toContain(':(exclude)lib/__tests__/**');
  });

  it('keeps ui a subset of app for the literal (non-exclude, non-pkg) entries', () => {
    const literal = (xs: string[]) => xs.filter((p) => !p.startsWith(':(exclude)') && p !== 'package.json');
    for (const p of literal(UI_PATHS)) expect(APP_PATHS).toContain(p);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run scripts/__tests__/detect-changes-paths.test.ts`
Expected: FAIL - cannot resolve `../detect-changes-paths.mjs`.

- [ ] **Step 3: Write the manifest**

```js
// scripts/detect-changes-paths.mjs
// Single source of truth for the detect-changes job's git pathspecs. Plain node,
// zero deps: the CI detect-changes job and the quality-fast meta-gate run it
// without pnpm install. These lists live ONLY here; the ci.yml shell no longer
// holds a copy, so there is nothing to drift against.

// `ai` gates the ai-eval job (AI Gateway credits). package.json/pnpm-lock are
// intentionally excluded (avoid burning credits on lockfile churn).
export const AI_PATHS = [
  'app/api/ask/',
  'lib/ask/',
  'lib/ask-log.ts',
  'lib/ip-hash.ts',
  'lib/stream-protocol.ts',
  'lib/rate-limit.ts',
  'lib/agent/',
  'lib/hiring-profile.ts',
  'lib/eval/',
  'content/ask-eval-corpus.ts',
  'content/ask-eval-calibration.ts',
  'content/perf-receipts.ts',
  'content/projects.ts',
  'content/unknowns.ts',
  'content/visa.ts',
  'scripts/ask-eval.ts',
  '__tests__/ask-*',
];

// `app` gates performance, e2e-functional, e2e-visual-chromium.
export const APP_PATHS = [
  'app/',
  'components/',
  'design-system/',
  'lib/',
  'content/',
  'public/',
  'next.config.ts',
  '.github/workflows/',
  'lighthouserc.json',
  'lighthouserc.mobile.json',
  'scripts/check-bundle-size.mjs',
  'playwright.config.ts',
  'package.json',
  'pnpm-lock.yaml',
];

// `ui` gates the visual/Argos job and is a deliberate SUBSET of app: it drops
// .github/workflows/, lighthouserc*, and the bundle-size script (they affect
// build/e2e/perf but cannot change a rendered pixel). package.json is NOT in this
// literal list; the runner compares its { browserslist, pnpm } slices semantically
// instead (a script-only package.json edit must not trip the visual suite, but a
// browserslist or pnpm.overrides change can change emitted CSS/JS). lib/eval and
// lib/__tests__ are excluded: never in the Next runtime, cannot change a pixel,
// yet live under lib/ and would otherwise trip spurious Argos diffs.
export const UI_PATHS = [
  'app/',
  'components/',
  'design-system/',
  'lib/',
  'content/',
  'public/',
  'next.config.ts',
  'playwright.config.ts',
  'pnpm-lock.yaml',
  ':(exclude)lib/eval/**',
  ':(exclude)lib/__tests__/**',
];
```

- [ ] **Step 4: Write the declaration file**

```ts
// scripts/detect-changes-paths.d.mts
export const AI_PATHS: readonly string[];
export const APP_PATHS: readonly string[];
export const UI_PATHS: readonly string[];
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run scripts/__tests__/detect-changes-paths.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add scripts/detect-changes-paths.mjs scripts/detect-changes-paths.d.mts scripts/__tests__/detect-changes-paths.test.ts
git commit -m "feat(ci): detect-changes pathspec manifest (single source of truth)"
```

---

### Task 2: `canonicalJSON` (jq -cS parity, pure)

**Files:**
- Create: `scripts/detect-changes.mjs` (initial: only `canonicalJSON`)
- Create: `scripts/detect-changes.d.mts`
- Test: `scripts/__tests__/detect-changes.test.ts`

**Interfaces:**
- Produces: `canonicalJSON(value: unknown): string` - deterministic, whitespace-free, recursively sorted object keys, preserved array order; `undefined` serializes as `null`.

- [ ] **Step 1: Write the failing test**

```ts
// scripts/__tests__/detect-changes.test.ts
import { describe, expect, it } from 'vitest';
import { canonicalJSON } from '../detect-changes.mjs';

describe('canonicalJSON', () => {
  it('sorts object keys recursively (key order does not matter)', () => {
    expect(canonicalJSON({ b: 1, a: 2 })).toBe(canonicalJSON({ a: 2, b: 1 }));
    expect(canonicalJSON({ a: 2, b: 1 })).toBe('{"a":2,"b":1}');
  });

  it('preserves array order (order DOES matter for browserslist)', () => {
    expect(canonicalJSON(['chrome >= 95', 'firefox'])).toBe('["chrome >= 95","firefox"]');
    expect(canonicalJSON(['chrome >= 95', 'firefox'])).not.toBe(
      canonicalJSON(['firefox', 'chrome >= 95']),
    );
  });

  it('serializes null and (the null-fill hazard) treats undefined as null', () => {
    expect(canonicalJSON({ browserslist: null, pnpm: null })).toBe('{"browserslist":null,"pnpm":null}');
    // A naive JSON.stringify of { x: undefined } omits x; canonicalJSON must emit null.
    expect(canonicalJSON({ x: undefined })).toBe('{"x":null}');
  });

  it('is whitespace-free for nested structures', () => {
    expect(canonicalJSON({ pnpm: { overrides: { zod: '4.4.3' } } })).toBe(
      '{"pnpm":{"overrides":{"zod":"4.4.3"}}}',
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run scripts/__tests__/detect-changes.test.ts`
Expected: FAIL - cannot resolve `../detect-changes.mjs`.

- [ ] **Step 3: Write `canonicalJSON`**

```js
// scripts/detect-changes.mjs
// Runner for the detect-changes job. Plain node, zero deps. Reads the pathspec
// manifest, runs git diff per category, and writes ai/app/ui to $GITHUB_OUTPUT.
// Pure decision helpers (canonicalJSON, computeCategories) are exported and unit
// tested; the git/IO lives in a thin main().

// Pure. Deterministic, whitespace-free JSON with recursively sorted OBJECT keys
// and PRESERVED array order (the node equivalent of `jq -cS`). undefined -> null
// so an absent field is not silently omitted (the omit-vs-null hazard that would
// flip the ui decision).
export function canonicalJSON(value) {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJSON).join(',')}]`;
  }
  if (value !== null && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJSON(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value === undefined ? null : value);
}
```

- [ ] **Step 4: Write the declaration file**

```ts
// scripts/detect-changes.d.mts
export function canonicalJSON(value: unknown): string;

export interface ChangeSignals {
  aiChanged: boolean;
  appChanged: boolean;
  uiChanged: boolean;
  pkgRenderChanged: boolean;
}
export interface Categories {
  ai: boolean;
  app: boolean;
  ui: boolean;
}
export function computeCategories(signals: ChangeSignals): Categories;
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run scripts/__tests__/detect-changes.test.ts -t canonicalJSON`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add scripts/detect-changes.mjs scripts/detect-changes.d.mts scripts/__tests__/detect-changes.test.ts
git commit -m "feat(ci): canonicalJSON helper (jq -cS parity for package.json render slice)"
```

---

### Task 3: `computeCategories` (decision mapping + parity table, pure)

**Files:**
- Modify: `scripts/detect-changes.mjs` (add `computeCategories`)
- Test: `scripts/__tests__/detect-changes.test.ts` (add the boolean-mapping table)

**Interfaces:**
- Consumes: nothing new.
- Produces: `computeCategories({ aiChanged, appChanged, uiChanged, pkgRenderChanged }) -> { ai, app, ui }` where `ui = uiChanged || pkgRenderChanged`, `ai = aiChanged`, `app = appChanged`.

- [ ] **Step 1: Write the failing test**

```ts
// append to scripts/__tests__/detect-changes.test.ts
import { computeCategories } from '../detect-changes.mjs';

describe('computeCategories', () => {
  const S = (o: Partial<Record<'aiChanged' | 'appChanged' | 'uiChanged' | 'pkgRenderChanged', boolean>>) => ({
    aiChanged: false, appChanged: false, uiChanged: false, pkgRenderChanged: false, ...o,
  });

  it('maps ai/app straight through and ui = uiChanged || pkgRenderChanged', () => {
    expect(computeCategories(S({ aiChanged: true }))).toEqual({ ai: true, app: false, ui: false });
    expect(computeCategories(S({ appChanged: true }))).toEqual({ ai: false, app: true, ui: false });
    expect(computeCategories(S({ uiChanged: true }))).toEqual({ ai: false, app: false, ui: true });
  });

  it('re-arms ui from pkgRenderChanged alone (browserslist/pnpm bump, no other ui diff)', () => {
    expect(computeCategories(S({ appChanged: true, pkgRenderChanged: true }))).toEqual({
      ai: false, app: true, ui: true,
    });
  });

  it('all-false yields all-false (docs-only PR)', () => {
    expect(computeCategories(S({}))).toEqual({ ai: false, app: false, ui: false });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run scripts/__tests__/detect-changes.test.ts -t computeCategories`
Expected: FAIL - `computeCategories` is not a function.

- [ ] **Step 3: Implement `computeCategories`**

```js
// add to scripts/detect-changes.mjs (after canonicalJSON)

// Pure. Map the four change signals to the three category outputs. ai/app pass
// straight through; ui re-arms when the package.json render slice changed even if
// no literal ui path did (browserslist / pnpm.overrides).
export function computeCategories({ aiChanged, appChanged, uiChanged, pkgRenderChanged }) {
  return {
    ai: aiChanged,
    app: appChanged,
    ui: uiChanged || pkgRenderChanged,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run scripts/__tests__/detect-changes.test.ts`
Expected: PASS (all canonicalJSON + computeCategories tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/detect-changes.mjs scripts/__tests__/detect-changes.test.ts
git commit -m "feat(ci): computeCategories decision mapping for detect-changes"
```

---

### Task 4: Runner `main()` (git I/O + $GITHUB_OUTPUT) and ci.yml wiring

**Files:**
- Modify: `scripts/detect-changes.mjs` (add `diffNonEmpty`, `renderSlice`, `writeOutputs`, `main`, entry guard)
- Modify: `.github/workflows/ci.yml` (replace the inline shell in the `detect-changes` step)

**Interfaces:**
- Consumes: `AI_PATHS`/`APP_PATHS`/`UI_PATHS` from the manifest; `canonicalJSON`, `computeCategories`.
- Produces: a CLI that writes `ai=`/`app=`/`ui=` lines to `$GITHUB_OUTPUT`.

- [ ] **Step 1: Write the failing test (the output writer + non-PR shortcut)**

```ts
// append to scripts/__tests__/detect-changes.test.ts
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

describe('runner main() via subprocess', () => {
  const runner = new URL('../detect-changes.mjs', import.meta.url).pathname;

  it('non-PR event writes ai=true app=true ui=true and exits 0', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dc-nonpr-'));
    try {
      const out = join(dir, 'gh_output');
      execFileSync('node', [runner], {
        env: { ...process.env, EVENT_NAME: 'push', GITHUB_OUTPUT: out },
      });
      expect(readFileSync(out, 'utf8')).toBe('ai=true\napp=true\nui=true\n');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run scripts/__tests__/detect-changes.test.ts -t "runner main"`
Expected: FAIL - the script has no `main()`/entry guard yet, so nothing is written to `gh_output`.

- [ ] **Step 3: Implement the I/O and entry guard**

```js
// add imports at the TOP of scripts/detect-changes.mjs (above canonicalJSON):
import { spawnSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { AI_PATHS, APP_PATHS, UI_PATHS } from './detect-changes-paths.mjs';

// ...canonicalJSON and computeCategories defined above...

// True iff `git diff --name-only BASE...HEAD -- <paths>` lists any file. Throws on
// a real git error (fail-closed: the job must fail loudly, not emit empty output).
function diffNonEmpty(base, head, paths) {
  const res = spawnSync('git', ['diff', '--name-only', `${base}...${head}`, '--', ...paths], {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  if (res.error || res.status === null) {
    throw new Error(`git diff failed: ${res.error?.message ?? 'no exit status'}`);
  }
  if (res.status !== 0) {
    throw new Error(`git diff exited ${res.status}: ${res.stderr?.slice(0, 400) ?? ''}`);
  }
  return res.stdout.trim().length > 0;
}

// jq -cS '{browserslist,pnpm}' equivalent for one ref. Null-fills the projection
// so an absent field is `null` (matching jq), then canonicalizes. A missing or
// unparseable package.json at the ref returns the literal 'null' (the shell's
// `git show ... 2>/dev/null || echo null`).
function renderSlice(ref) {
  const res = spawnSync('git', ['show', `${ref}:package.json`], {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  if (res.error || res.status !== 0) return 'null';
  try {
    const pkg = JSON.parse(res.stdout);
    return canonicalJSON({ browserslist: pkg.browserslist ?? null, pnpm: pkg.pnpm ?? null });
  } catch {
    return 'null';
  }
}

function writeOutputs({ ai, app, ui }) {
  const file = process.env.GITHUB_OUTPUT;
  if (!file) throw new Error('GITHUB_OUTPUT is not set');
  appendFileSync(file, `ai=${ai}\napp=${app}\nui=${ui}\n`);
}

function main() {
  if (process.env.EVENT_NAME !== 'pull_request') {
    // Non-PR (push to main / workflow_dispatch): run every gate.
    writeOutputs({ ai: true, app: true, ui: true });
    return;
  }
  const base = process.env.BASE_SHA;
  const head = process.env.HEAD_SHA;
  if (!base || !head) throw new Error('BASE_SHA / HEAD_SHA not set');
  const aiChanged = diffNonEmpty(base, head, AI_PATHS);
  const appChanged = diffNonEmpty(base, head, APP_PATHS);
  const uiChanged = diffNonEmpty(base, head, UI_PATHS);
  const pkgRenderChanged = renderSlice(base) !== renderSlice(head);
  writeOutputs(computeCategories({ aiChanged, appChanged, uiChanged, pkgRenderChanged }));
}

// Run only when invoked directly, not when imported by the unit test.
if (typeof process.argv[1] === 'string' && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (err) {
    process.stderr.write(`[detect-changes] ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run scripts/__tests__/detect-changes.test.ts -t "runner main"`
Expected: PASS - `gh_output` contains `ai=true\napp=true\nui=true\n`.

- [ ] **Step 5: Replace the inline shell in ci.yml**

In `.github/workflows/ci.yml`, the `detect-changes` job's "Detect changed file categories" step currently contains a multi-line `run: |` shell block (the `if [[ "$EVENT_NAME" ... ]]` ... `git diff` ... `>> "$GITHUB_OUTPUT"` logic). Replace ONLY the `run:` body with the runner call. Keep `name`, `id: check`, and the `env:` block (BASE_SHA, HEAD_SHA, EVENT_NAME) unchanged.

Replace:
```yaml
      - name: Detect changed file categories
        id: check
        env:
          BASE_SHA: ${{ github.event.pull_request.base.sha }}
          HEAD_SHA: ${{ github.event.pull_request.head.sha }}
          EVENT_NAME: ${{ github.event_name }}
        run: |
          if [[ "$EVENT_NAME" != "pull_request" ]]; then
            echo "ai=true" >> "$GITHUB_OUTPUT"
            ...   # the entire existing shell block
            || echo "ui=false" >> "$GITHUB_OUTPUT"
```
with:
```yaml
      - name: Detect changed file categories
        id: check
        env:
          BASE_SHA: ${{ github.event.pull_request.base.sha }}
          HEAD_SHA: ${{ github.event.pull_request.head.sha }}
          EVENT_NAME: ${{ github.event_name }}
        # Pathspecs live in scripts/detect-changes-paths.mjs (single source of
        # truth, validated by check:detect-changes-paths). The runner uses only
        # node builtins, so ubuntu's preinstalled node runs it with no pnpm install.
        run: node scripts/detect-changes.mjs
```

The job's `actions/checkout` (`fetch-depth: 0`), `timeout-minutes: 2`, and `outputs:` mappings are unchanged.

- [ ] **Step 6: Verify the new runner produces the right output on a real diff**

Run (compares the new runner against the live working tree using HEAD~1..HEAD as a stand-in PR):
```bash
GH=$(mktemp); EVENT_NAME=pull_request BASE_SHA=$(git rev-parse HEAD~1) HEAD_SHA=$(git rev-parse HEAD) GITHUB_OUTPUT=$GH node scripts/detect-changes.mjs; cat "$GH"; rm -f "$GH"
```
Expected: three lines `ai=<bool>`, `app=<bool>`, `ui=<bool>` with no error. (This commit touches `scripts/` only, so `app`/`ui` will be `false` and `ai` `false` unless the range includes an ai/app path - the point is it RUNS and writes three well-formed lines.)

- [ ] **Step 7: Commit**

```bash
git add scripts/detect-changes.mjs .github/workflows/ci.yml
git commit -m "feat(ci): node runner replaces inline detect-changes shell"
```

---

### Task 5: Parity proof (temp-git-repo integration test)

**Files:**
- Test: `scripts/__tests__/detect-changes.parity.test.ts`

**Interfaces:**
- Consumes: the runner CLI (`scripts/detect-changes.mjs`) via subprocess against a throwaway git repo.

This is the mandatory pre-merge parity proof from the spec: it exercises REAL `git diff` pathspec + `:(exclude)` semantics and the real `canonicalJSON` package.json compare, so it proves the node runner matches what the old shell would have decided. It builds a temp git repo, seeds files at the manifest paths, makes a BASE and a HEAD commit per scenario, runs the runner, and asserts `ai/app/ui`.

- [ ] **Step 1: Write the failing test**

```ts
// scripts/__tests__/detect-changes.parity.test.ts
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const runner = new URL('../detect-changes.mjs', import.meta.url).pathname;

let repo: string;
const git = (args: string[]) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' });
const write = (rel: string, body: string) => {
  const abs = join(repo, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, body);
};

// Seed the BASE tree, commit; apply `mutate`, commit HEAD; run the runner; parse.
function runScenario(seed: () => void, mutate: () => void) {
  seed();
  git(['add', '-A']);
  git(['commit', '-q', '-m', 'base']);
  const base = git(['rev-parse', 'HEAD']).trim();
  mutate();
  git(['add', '-A']);
  git(['commit', '-q', '-m', 'head']);
  const head = git(['rev-parse', 'HEAD']).trim();
  const out = join(repo, 'gh_output');
  writeFileSync(out, '');
  execFileSync('node', [runner], {
    cwd: repo,
    env: { ...process.env, EVENT_NAME: 'pull_request', BASE_SHA: base, HEAD_SHA: head, GITHUB_OUTPUT: out },
  });
  const text = readFileSync(out, 'utf8');
  const get = (k: string) => /true|false/.exec(text.split('\n').find((l) => l.startsWith(`${k}=`)) ?? '')?.[0];
  return { ai: get('ai'), app: get('app'), ui: get('ui') };
}

const PKG = (extra: object = {}) =>
  JSON.stringify({ name: 'x', version: '1.0.0', browserslist: ['chrome >= 95'], ...extra });

describe('detect-changes parity (real git)', () => {
  beforeEach(() => {
    repo = mkdtempSync(join(tmpdir(), 'dc-parity-'));
    git(['init', '-q']);
    git(['config', 'user.email', 't@t']);
    git(['config', 'user.name', 't']);
  });
  afterEach(() => rmSync(repo, { recursive: true, force: true }));

  const baseSeed = () => {
    write('package.json', PKG());
    write('app/page.tsx', 'export default () => null;\n');
    write('lib/eval/x.ts', 'export const x = 1;\n');
    write('README.md', 'hi\n');
  };

  it('row 5: lib/eval-only change -> ui suppressed by exclude', () => {
    expect(runScenario(baseSeed, () => write('lib/eval/x.ts', 'export const x = 2;\n'))).toEqual({
      ai: 'true', app: 'true', ui: 'false',
    });
  });

  it('row 6: lib/eval + app change -> ui stays true (exclude does not suppress)', () => {
    expect(
      runScenario(baseSeed, () => {
        write('lib/eval/x.ts', 'export const x = 2;\n');
        write('app/page.tsx', 'export default () => null; // edit\n');
      }),
    ).toEqual({ ai: 'true', app: 'true', ui: 'true' });
  });

  it('row 7: browserslist bump (no other diff) -> ui re-armed via render slice', () => {
    expect(
      runScenario(baseSeed, () => write('package.json', PKG({ browserslist: ['chrome >= 96'] }))),
    ).toEqual({ ai: 'false', app: 'true', ui: 'true' });
  });

  it('row 8: pnpm.overrides bump (no lock diff) -> ui re-armed via render slice', () => {
    expect(
      runScenario(baseSeed, () => write('package.json', PKG({ pnpm: { overrides: { zod: '4.4.3' } } }))),
    ).toEqual({ ai: 'false', app: 'true', ui: 'true' });
  });

  it('row 9: package.json absent at BASE (added) -> null fallback, no throw', () => {
    const seedNoPkg = () => {
      write('app/page.tsx', 'export default () => null;\n');
      write('README.md', 'hi\n');
    };
    expect(runScenario(seedNoPkg, () => write('package.json', PKG()))).toEqual({
      ai: 'false', app: 'true', ui: 'true',
    });
  });

  it('row 10: lighthouserc.json only -> app yes, ui no (app-minus-ui member)', () => {
    expect(
      runScenario(
        () => {
          baseSeed();
          write('lighthouserc.json', '{}\n');
        },
        () => write('lighthouserc.json', '{ "x": 1 }\n'),
      ),
    ).toEqual({ ai: 'false', app: 'true', ui: 'false' });
  });

  it('row 11: docs-only -> all false', () => {
    expect(runScenario(baseSeed, () => write('README.md', 'bye\n'))).toEqual({
      ai: 'false', app: 'false', ui: 'false',
    });
  });
});
```

- [ ] **Step 2: Run the test**

Run: `pnpm vitest run scripts/__tests__/detect-changes.parity.test.ts`
Expected: PASS (7 scenarios). If any FAILS, the node runner diverges from the intended pathspec/render semantics - fix the runner (Task 4), not the test. (Rows 1-4 are covered by the `computeCategories` unit test + the non-PR subprocess test; rows 5-11 here exercise the git-pathspec/exclude/render edges the architect gate flagged.)

- [ ] **Step 3: Commit**

```bash
git add scripts/__tests__/detect-changes.parity.test.ts
git commit -m "test(ci): detect-changes parity proof over real git (exclude + render slice)"
```

---

### Task 6: Validator meta-gate + CI/script wiring + ADR

**Files:**
- Create: `scripts/check-detect-changes-paths.mjs`
- Create: `scripts/check-detect-changes-paths.d.mts`
- Test: `scripts/__tests__/check-detect-changes-paths.test.ts`
- Modify: `package.json` (add `check:detect-changes-paths` script; fold into `verify`)
- Modify: `.github/workflows/ci.yml` (new `quality-fast` step)
- Modify: `DECISIONS.md` (ADR)

**Interfaces:**
- Consumes: `AI_PATHS`/`APP_PATHS`/`UI_PATHS` from the manifest.
- Produces: `classifyPathspec(spec) -> { kind, base }`, `globMatches(spec, deps?) -> boolean`, `assertResolves(spec, deps?) -> { ok } | { ok:false, reason }`.

- [ ] **Step 1: Write the failing test**

```ts
// scripts/__tests__/check-detect-changes-paths.test.ts
import { describe, expect, it } from 'vitest';
import {
  assertResolves,
  classifyPathspec,
  globMatches,
} from '../check-detect-changes-paths.mjs';

describe('classifyPathspec', () => {
  it('classifies literal, glob, and exclude pathspecs with the right base', () => {
    expect(classifyPathspec('lib/ask/')).toEqual({ kind: 'literal', base: 'lib/ask/' });
    expect(classifyPathspec('__tests__/ask-*')).toEqual({ kind: 'glob', base: '__tests__/ask-*' });
    expect(classifyPathspec(':(exclude)lib/eval/**')).toEqual({ kind: 'exclude', base: 'lib/eval' });
    expect(classifyPathspec(':(exclude)lib/__tests__/**')).toEqual({
      kind: 'exclude', base: 'lib/__tests__',
    });
  });
});

describe('globMatches', () => {
  const fs = { existsSync: () => true, readdirSync: () => ['ask-a.test.ts', 'other.test.ts'] };
  it('matches when >=1 entry shares the prefix', () => {
    expect(globMatches('__tests__/ask-*', fs)).toBe(true);
  });
  it('does not match when no entry shares the prefix', () => {
    expect(globMatches('__tests__/zzz-*', fs)).toBe(false);
  });
  it('does not match when the directory is missing', () => {
    expect(globMatches('__tests__/ask-*', { existsSync: () => false, readdirSync: () => [] })).toBe(false);
  });
});

describe('assertResolves', () => {
  it('passes a literal whose path exists', () => {
    expect(assertResolves('lib/ask/', { existsSync: () => true })).toEqual({ ok: true });
  });
  it('fails a literal whose path is missing (the orphaned-filter case)', () => {
    const v = assertResolves('lib/moved/', { existsSync: () => false });
    expect(v.ok).toBe(false);
    expect(v.ok === false && v.reason).toContain('literal');
  });
  it('fails a glob with no matches', () => {
    const v = assertResolves('__tests__/zzz-*', { existsSync: () => true, readdirSync: () => ['a'] });
    expect(v.ok).toBe(false);
    expect(v.ok === false && v.reason).toContain('glob');
  });
  it('fails a stale exclude whose base is gone', () => {
    const v = assertResolves(':(exclude)lib/eval/**', { existsSync: () => false });
    expect(v.ok).toBe(false);
    expect(v.ok === false && v.reason).toContain('exclude');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run scripts/__tests__/check-detect-changes-paths.test.ts`
Expected: FAIL - cannot resolve `../check-detect-changes-paths.mjs`.

- [ ] **Step 3: Write the validator**

```js
// scripts/check-detect-changes-paths.mjs
// Meta-gate: every detect-changes pathspec must resolve to an existing path. A
// moved/renamed path that orphans a filter would make the filter silently match
// nothing, skip its gate, and ship a regression unguarded (the fail-open-on-stale-
// path class). Plain node, zero deps. Exit 2 = orphaned/infra, 0 = all resolve.
import { existsSync as fsExistsSync, readdirSync as fsReaddirSync } from 'node:fs';
import { basename, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { AI_PATHS, APP_PATHS, UI_PATHS } from './detect-changes-paths.mjs';

// Pure. Classify a git pathspec. `:(exclude)<base>/**` -> exclude with the base
// dir; anything containing `*` -> glob; otherwise literal.
export function classifyPathspec(spec) {
  if (spec.startsWith(':(exclude)')) {
    const base = spec.slice(':(exclude)'.length).replace(/\/\*\*$/, '').replace(/\/$/, '');
    return { kind: 'exclude', base };
  }
  if (spec.includes('*')) return { kind: 'glob', base: spec };
  return { kind: 'literal', base: spec };
}

// Does a `<dir>/<prefix>*` glob match >=1 entry? Supports only the single
// trailing-segment prefix glob the manifest uses (e.g. '__tests__/ask-*').
export function globMatches(spec, deps = {}) {
  const existsSync = deps.existsSync ?? fsExistsSync;
  const readdirSync = deps.readdirSync ?? fsReaddirSync;
  const dir = dirname(spec);
  const prefix = basename(spec).replace(/\*.*$/, '');
  if (!existsSync(dir)) return false;
  return readdirSync(dir).some((name) => name.startsWith(prefix));
}

// Verdict for one spec. fs deps injected for testing.
export function assertResolves(spec, deps = {}) {
  const existsSync = deps.existsSync ?? fsExistsSync;
  const { kind, base } = classifyPathspec(spec);
  if (kind === 'glob') {
    return globMatches(spec, deps) ? { ok: true } : { ok: false, reason: 'glob matched no files' };
  }
  // literal + exclude both require their base path to exist.
  return existsSync(base) ? { ok: true } : { ok: false, reason: `${kind} path does not exist` };
}

function main() {
  const specs = [...new Set([...AI_PATHS, ...APP_PATHS, ...UI_PATHS])];
  // Anti-vacuous runtime guard: an empty manifest must fail, never pass silently.
  if (specs.length === 0) {
    console.error('[detect-changes-paths] GATE ERROR: manifest is empty; nothing to validate.');
    process.exit(2);
  }
  const orphaned = [];
  for (const spec of specs) {
    const v = assertResolves(spec);
    if (!v.ok) orphaned.push(`${spec} (${v.reason})`);
  }
  if (orphaned.length > 0) {
    console.error(
      '[detect-changes-paths] ORPHANED pathspec(s): a moved/renamed path left a detect-changes filter matching nothing, which would silently skip its gate:',
    );
    for (const o of orphaned) console.error(`  x ${o}`);
    process.exit(2);
  }
  console.log(`[detect-changes-paths] OK: all ${specs.length} pathspecs resolve.`);
}

if (typeof process.argv[1] === 'string' && import.meta.url === pathToFileURL(process.argv[1]).href) main();
```

- [ ] **Step 4: Write the declaration file**

```ts
// scripts/check-detect-changes-paths.d.mts
export type Pathspec = { kind: 'literal' | 'glob' | 'exclude'; base: string };
export type Verdict = { ok: true } | { ok: false; reason: string };
export interface FsDeps {
  existsSync?: (p: string) => boolean;
  readdirSync?: (p: string) => string[];
}
export function classifyPathspec(spec: string): Pathspec;
export function globMatches(spec: string, deps?: FsDeps): boolean;
export function assertResolves(spec: string, deps?: FsDeps): Verdict;
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run scripts/__tests__/check-detect-changes-paths.test.ts`
Expected: PASS (all classify/glob/assert tests).

- [ ] **Step 6: Verify the gate passes on the real tree**

Run: `node scripts/check-detect-changes-paths.mjs; echo "EXIT=$?"`
Expected: `[detect-changes-paths] OK: all <N> pathspecs resolve.` and `EXIT=0`.

- [ ] **Step 7: Wire the npm script and `verify` chain**

In `package.json` `scripts`, add `check:detect-changes-paths` and insert it into `verify` right after `check:gate-health`:
```json
"check:detect-changes-paths": "node scripts/check-detect-changes-paths.mjs",
```
`verify` becomes (insert the new gate after `check:gate-health`):
```
... && pnpm check:gate-health && pnpm check:detect-changes-paths && pnpm lint:css-tokens && pnpm test
```

- [ ] **Step 8: Add the CI quality-fast step**

In `.github/workflows/ci.yml`, in the `quality-fast` job, add a step immediately after the "Gate-health meta-gate (hook/script references resolve)" step:
```yaml
      - name: Detect-changes pathspec gate (no orphaned filters)
        run: pnpm check:detect-changes-paths
```

- [ ] **Step 9: Verify the gate fires on a simulated orphan (negative proof)**

Run (temporarily rename a watched path, expect exit 2, then restore):
```bash
git mv lib/hiring-profile.ts lib/hiring-profile.moved.ts
node scripts/check-detect-changes-paths.mjs; echo "EXIT=$?"   # expect ORPHANED + EXIT=2
git mv lib/hiring-profile.moved.ts lib/hiring-profile.ts
node scripts/check-detect-changes-paths.mjs; echo "EXIT=$?"   # expect OK + EXIT=0
```
Expected: first run prints `ORPHANED ... lib/hiring-profile.ts (literal path does not exist)` and `EXIT=2`; after restoring, `OK` and `EXIT=0`.

- [ ] **Step 10: Add the ADR to DECISIONS.md**

Prepend an entry under the running ADR log (one bullet, dated, reversibility note), e.g.:
```
- **2026-06-21** - **detect-changes pathspecs hoisted to a manifest + a stale-pathspec meta-gate.** The job's git pathspecs moved from an inline ci.yml shell block to `scripts/detect-changes-paths.mjs` (single source of truth), the shell was replaced by `scripts/detect-changes.mjs` (a plain-node runner; behavior proven identical by a temp-git-repo parity test over 11 scenarios incl. the exclude + browserslist/pnpm render-slice edges), and `scripts/check-detect-changes-paths.mjs` now fails CI (exit 2) when any pathspec stops resolving. Closes the fail-open-on-stale-path class (the lib/eval ai-filter gap) for this job; continuous with the #154/#160/#162 vestigial-gate hardening. _Reversible: revert the ci.yml step to the inline shell and delete the three scripts; no persisted state._
```

- [ ] **Step 11: Full local verification + commit**

Run: `pnpm ci:local 2>&1 | tail -5`
Expected: all gates + tests pass (the new `check:detect-changes-paths` runs inside `verify`).

```bash
git add scripts/check-detect-changes-paths.mjs scripts/check-detect-changes-paths.d.mts scripts/__tests__/check-detect-changes-paths.test.ts package.json .github/workflows/ci.yml DECISIONS.md
git commit -m "feat(ci): stale-pathspec meta-gate for detect-changes filters"
```

---

## Failure-mode checklist (from thinking-inversion + architect gate)

Each is covered by a task above; verify before declaring done:

- [ ] Runner mis-computes a category -> a required gate silently skips (fail-open). **Covered:** Task 3 unit table + Task 5 real-git parity (rows 5-11).
- [ ] `canonicalJSON` diverges from `jq -cS` (sort keys, preserve array order, null-fill). **Covered:** Task 2 tests + Task 5 rows 7-9.
- [ ] Three-dot `BASE...HEAD` ported as two-dot. **Covered:** runner uses `${base}...${head}`; Task 5 exercises it.
- [ ] `$GITHUB_OUTPUT` written wrong (append vs overwrite, delimiter). **Covered:** Task 4 subprocess test asserts exact bytes.
- [ ] Runner errors silently -> empty output -> downstream falsy -> gates skip. **Covered:** Task 4 `main()` throws + entry guard exits 1 on any error.
- [ ] Validator vacuous (empty manifest passes). **Covered:** Task 6 runtime non-empty guard.
- [ ] Validator false-positive on glob/exclude. **Covered:** Task 6 classify/glob/exclude tests + Step 6 real-tree OK.
- [ ] Validator false-negative (deleted literal passes). **Covered:** Task 6 literal-missing test + Step 9 negative proof.
- [ ] Manifest/runner import triggers main in tests. **Covered:** entry guards; Task 4/6 import the pure exports without side effects.
- [ ] `package.json` null fallback not preserved. **Covered:** Task 2 null-fill test + Task 5 row 9.

## Self-Review notes

- **Spec coverage:** Unit 1 -> Task 1; Unit 2 -> Tasks 2-4; Unit 3 -> Task 6; behavior-preservation parity -> Task 5; wiring (package.json/ci.yml/DECISIONS) -> Tasks 4 & 6.
- **Type consistency:** `computeCategories` signature identical in `.d.mts` (Task 2) and impl (Task 3); `assertResolves`/`classifyPathspec`/`globMatches` signatures identical across `.d.mts`, impl, and tests (Task 6).
- **Exit codes:** validator 2/0; runner 1 on error; consistent with the Global Constraints taxonomy.
