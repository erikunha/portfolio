import { spawnSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { AI_PATHS, APP_PATHS, UI_PATHS } from './detect-changes-paths.mjs';

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

export function aiMajor(pkgJsonString) {
  try {
    const pkg = JSON.parse(pkgJsonString);
    const spec = pkg?.pnpm?.overrides?.ai ?? pkg?.dependencies?.ai ?? pkg?.devDependencies?.ai;
    if (typeof spec !== 'string') return null;
    const major = Number.parseInt(spec.replace(/^\D+/, ''), 10);
    return Number.isNaN(major) ? null : major;
  } catch {
    return null;
  }
}

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
