// Runner for the detect-changes job. Plain node, zero deps. Reads the pathspec
// manifest, runs git diff per category, and writes ai/app/ui to $GITHUB_OUTPUT.
// Pure decision helpers (canonicalJSON, computeCategories) are exported and unit
// tested; the git/IO lives in a thin main().

import { spawnSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { AI_PATHS, APP_PATHS, UI_PATHS } from './detect-changes-paths.mjs';

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

// Pure. Map the change signals to the three category outputs. app passes straight
// through; ui re-arms when the package.json render slice changed even if no literal
// ui path did (browserslist / pnpm.overrides); ai re-arms when an AI-code path
// changed OR the `ai` package's MAJOR version changed. The ai-major re-arm exists
// because AI_PATHS deliberately excludes package.json (to avoid burning Gateway
// credits on routine dep churn), which let dependabot #169 bump `ai` 6->7 as a
// deps-only change and merge green while breaking prod /api/ask — a breaking SDK
// major is exactly the change that MUST run ai-eval. Minor/patch bumps stay cheap.
export function computeCategories({
  aiChanged,
  appChanged,
  uiChanged,
  pkgRenderChanged,
  aiMajorChanged,
}) {
  return {
    ai: aiChanged || Boolean(aiMajorChanged),
    app: appChanged,
    ui: uiChanged || pkgRenderChanged,
  };
}

// Pure. Extract the MAJOR version of the `ai` dependency from a package.json
// string. Returns the integer major, or `null` when `ai` is absent or its
// specifier is unparseable (`workspace:*`, `latest`, a git URL, malformed JSON).
// A `null` on one ref that differs from the other's number over-arms ai-eval —
// fail-safe: never SKIP AI validation on a version-parse anomaly.
export function aiMajor(pkgJsonString) {
  try {
    const pkg = JSON.parse(pkgJsonString);
    // Precedence: pnpm.overrides FIRST. An override FORCES the resolved version
    // regardless of the dependency specifier, so a PR adding
    // `pnpm.overrides.ai: '7.0.0'` while leaving `dependencies.ai` at `^6` still
    // ships v7 — and this repo uses overrides for esbuild/postcss/etc., so this
    // is a live bypass path, not hypothetical. Reading deps first would miss it
    // (the `^6` spec is still present). Then dependencies, then devDependencies.
    const spec = pkg?.pnpm?.overrides?.ai ?? pkg?.dependencies?.ai ?? pkg?.devDependencies?.ai;
    if (typeof spec !== 'string') return null;
    // "first digit run" major: `^7.0.14` / `~6` / `>=7.0.0` / `npm:ai@7` → the
    // leading major. A semver OR-combinator (`6.0.0 || 7.0.0`) would read only the
    // first token; acceptable given the repo's single-caret pin style — revisit if
    // that ever changes.
    const major = Number.parseInt(spec.replace(/^\D+/, ''), 10);
    return Number.isNaN(major) ? null : major;
  } catch {
    return null;
  }
}

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
//
// WHY this swallows the git error to 'null' (a deliberate fail-OPEN, unlike the
// fail-CLOSED diffNonEmpty): this is exact parity with the replaced shell, and it
// is what makes the legitimate "package.json added at HEAD, absent at BASE" case
// (parity row 9) arm `ui` instead of throwing. The asymmetry is safe: `ui`
// over-arms (runs the visual suite) on a render-slice anomaly and never under-arms,
// and the `app` gate stays fail-closed via the literal diff. Do NOT "fix" this
// into a throw - it would break the added-package.json case.
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

// The `ai` package major at a git ref (mirrors renderSlice). `null` on a git-read
// error or an unparseable specifier — which, if it differs from the other ref,
// over-arms ai-eval (fail-safe).
function aiMajorAtRef(ref) {
  const res = spawnSync('git', ['show', `${ref}:package.json`], {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  if (res.error || res.status !== 0) return null;
  return aiMajor(res.stdout);
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
  const aiMajorChanged = aiMajorAtRef(base) !== aiMajorAtRef(head);
  writeOutputs(
    computeCategories({ aiChanged, appChanged, uiChanged, pkgRenderChanged, aiMajorChanged }),
  );
}

// Run only when invoked directly, not when imported by the unit test.
if (
  typeof process.argv[1] === 'string' &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    main();
  } catch (err) {
    process.stderr.write(`[detect-changes] ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  }
}
