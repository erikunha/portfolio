import { existsSync as fsExistsSync, readdirSync as fsReaddirSync } from 'node:fs';
import { basename, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { AI_PATHS, APP_PATHS, UI_PATHS } from './detect-changes-paths.mjs';

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

function main() {
  const specs = [...new Set([...AI_PATHS, ...APP_PATHS, ...UI_PATHS])];
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

if (
  typeof process.argv[1] === 'string' &&
  import.meta.url === pathToFileURL(process.argv[1]).href
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
