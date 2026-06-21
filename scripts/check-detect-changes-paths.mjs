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
    const base = spec
      .slice(':(exclude)'.length)
      .replace(/\/\*\*$/, '')
      .replace(/\/$/, '');
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
  // literal + exclude both require their base path to exist. A stale exclude is
  // harmless at runtime (it subtracts nothing the gate depends on), unlike a
  // stale literal/glob which silently skips a gate - but we still validate it so
  // a removed excluded dir forces a deliberate manifest edit rather than leaving
  // a dead pathspec. WHY: the false-positive cost is one manual edit; it can
  // never fail-open, which keeps the manifest honest at negligible risk.
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

if (
  typeof process.argv[1] === 'string' &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  // Map an unexpected fs throw (permissions, ENOTDIR) to exit 2 so the gate's
  // taxonomy holds (2 = gate cannot run / infra), not node's default exit 1.
  try {
    main();
  } catch (err) {
    console.error(
      `[detect-changes-paths] GATE ERROR: ${err instanceof Error ? err.message : String(err)}`,
    );
    process.exit(2);
  }
}
