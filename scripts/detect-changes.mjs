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
