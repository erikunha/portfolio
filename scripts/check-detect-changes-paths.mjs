import { spawnSync } from 'node:child_process';
import { existsSync as fsExistsSync, readdirSync as fsReaddirSync, realpathSync } from 'node:fs';
import { basename, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { AI_PATHS, APP_PATHS, IGNORED_PATHS, UI_PATHS } from './detect-changes-paths.mjs';

export function classifyPathspec(spec) {
  if (spec.startsWith(':(exclude)')) {
    const base = spec
      .slice(':(exclude)'.length)
      .replace(/\/\*\*$/, '')
      .replace(/\/$/, '');
    return { kind: 'exclude', base };
  }
  if (spec.includes('*')) return { kind: 'glob', base: spec };
  return { kind: 'literal', base: spec };
}

export function globMatches(spec, deps = {}) {
  const existsSync = deps.existsSync ?? fsExistsSync;
  const readdirSync = deps.readdirSync ?? fsReaddirSync;
  const dir = dirname(spec);
  const prefix = basename(spec).replace(/\*.*$/, '');
  if (!existsSync(dir)) return false;
  return readdirSync(dir).some((name) => name.startsWith(prefix));
}

export function assertResolves(spec, deps = {}) {
  const existsSync = deps.existsSync ?? fsExistsSync;
  const { kind, base } = classifyPathspec(spec);
  if (kind === 'glob') {
    return globMatches(spec, deps) ? { ok: true } : { ok: false, reason: 'glob matched no files' };
  }
  return existsSync(base) ? { ok: true } : { ok: false, reason: `${kind} path does not exist` };
}

function coversFile(spec, file) {
  const { kind, base } = classifyPathspec(spec);
  if (kind === 'exclude') return false;
  if (kind === 'glob') return file.startsWith(base.replace(/\*.*$/, ''));
  return base.endsWith('/') ? file.startsWith(base) : file === base;
}

export function isGateScoped(file) {
  return !file.includes('/') || file.startsWith('scripts/');
}

export function unclassifiedFiles(files) {
  const specs = [...AI_PATHS, ...APP_PATHS, ...UI_PATHS, ...IGNORED_PATHS];
  return files.filter(
    (file) => isGateScoped(file) && !specs.some((spec) => coversFile(spec, file)),
  );
}

function trackedFiles() {
  const res = spawnSync('git', ['ls-files', '-z'], {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  if (res.error || res.status !== 0) throw new Error('git ls-files failed');
  return res.stdout.split('\0').filter(Boolean);
}

function main() {
  const specs = [...new Set([...AI_PATHS, ...APP_PATHS, ...UI_PATHS, ...IGNORED_PATHS])];
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
  const unclassified = unclassifiedFiles(trackedFiles());
  if (unclassified.length > 0) {
    console.error(
      '[detect-changes-paths] UNCLASSIFIED file(s): a tracked root or scripts file is in no filter and no ignore list, so a PR touching only it skips every gated job. Add it to APP_PATHS/UI_PATHS/AI_PATHS or IGNORED_PATHS:',
    );
    for (const f of unclassified) console.error(`  x ${f}`);
    process.exit(2);
  }
  console.log(`[detect-changes-paths] OK: all ${specs.length} pathspecs resolve.`);
}

if (
  typeof process.argv[1] === 'string' &&
  import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href
) {
  try {
    main();
  } catch (err) {
    console.error(
      `[detect-changes-paths] GATE ERROR: ${err instanceof Error ? err.message : String(err)}`,
    );
    process.exit(2);
  }
}
