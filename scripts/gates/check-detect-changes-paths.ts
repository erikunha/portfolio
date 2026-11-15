import { existsSync as fsExistsSync, readdirSync as fsReaddirSync } from 'node:fs';
import { basename, dirname } from 'node:path';
import { AI_PATHS, APP_PATHS, IGNORED_PATHS, UI_PATHS } from '../ci/detect-changes-paths.ts';
import { gitText } from '../lib/git.ts';
import { isMain } from '../lib/is-main.ts';

const EXCLUDE_PREFIX = ':(exclude)';
const TRAILING_GLOB_DIRECTORY = /\/\*\*$/;
const TRAILING_SLASH = /\/$/;
const GLOB_TAIL = /\*.*$/;
const GLOB_CHARACTER = '*';
const PATH_SEPARATOR = '/';
const SCRIPTS_PREFIX = 'scripts/';
const GATE_ERROR_EXIT = 2;
const NUL = '\0';
const LOG_PREFIX = '[detect-changes-paths]';

export type PathspecKind = 'literal' | 'glob' | 'exclude';
export interface Pathspec {
  kind: PathspecKind;
  base: string;
}
export type Verdict = { ok: true } | { ok: false; reason: string };
export interface FsDeps {
  existsSync?: (path: string) => boolean;
  readdirSync?: (path: string) => string[];
}

export function classifyPathspec(spec: string): Pathspec {
  if (spec.startsWith(EXCLUDE_PREFIX)) {
    const base = spec
      .slice(EXCLUDE_PREFIX.length)
      .replace(TRAILING_GLOB_DIRECTORY, '')
      .replace(TRAILING_SLASH, '');
    return { kind: 'exclude', base };
  }
  if (spec.includes(GLOB_CHARACTER)) return { kind: 'glob', base: spec };
  return { kind: 'literal', base: spec };
}

export function globMatches(spec: string, deps: FsDeps = {}): boolean {
  const existsSync = deps.existsSync ?? fsExistsSync;
  const readdirSync = deps.readdirSync ?? ((path: string) => fsReaddirSync(path));
  const dir = dirname(spec);
  const prefix = basename(spec).replace(GLOB_TAIL, '');
  if (!existsSync(dir)) return false;
  return readdirSync(dir).some((name) => name.startsWith(prefix));
}

export function assertResolves(spec: string, deps: FsDeps = {}): Verdict {
  const existsSync = deps.existsSync ?? fsExistsSync;
  const { kind, base } = classifyPathspec(spec);
  if (kind === 'glob') {
    return globMatches(spec, deps) ? { ok: true } : { ok: false, reason: 'glob matched no files' };
  }
  return existsSync(base) ? { ok: true } : { ok: false, reason: `${kind} path does not exist` };
}

function coversFile(spec: string, file: string): boolean {
  const { kind, base } = classifyPathspec(spec);
  if (kind === 'exclude') return false;
  if (kind === 'glob') return file.startsWith(base.replace(GLOB_TAIL, ''));
  return base.endsWith(PATH_SEPARATOR) ? file.startsWith(base) : file === base;
}

export function isGateScoped(file: string): boolean {
  return !file.includes(PATH_SEPARATOR) || file.startsWith(SCRIPTS_PREFIX);
}

export function unclassifiedFiles(files: readonly string[]): string[] {
  const specs = [...AI_PATHS, ...APP_PATHS, ...UI_PATHS, ...IGNORED_PATHS];
  return files.filter(
    (file) => isGateScoped(file) && !specs.some((spec) => coversFile(spec, file)),
  );
}

function trackedFilesNulSeparated(): string[] {
  return gitText(['ls-files', '-z'], { trim: false }).split(NUL).filter(Boolean);
}

function main(): void {
  const specs = [...new Set([...AI_PATHS, ...APP_PATHS, ...UI_PATHS, ...IGNORED_PATHS])];
  if (specs.length === 0) {
    console.error(`${LOG_PREFIX} GATE ERROR: manifest is empty; nothing to validate.`);
    process.exit(GATE_ERROR_EXIT);
  }
  const orphaned: string[] = [];
  for (const spec of specs) {
    const v = assertResolves(spec);
    if (!v.ok) orphaned.push(`${spec} (${v.reason})`);
  }
  if (orphaned.length > 0) {
    console.error(
      `${LOG_PREFIX} ORPHANED pathspec(s): a moved/renamed path left a detect-changes filter matching nothing, which would silently skip its gate:`,
    );
    for (const o of orphaned) console.error(`  x ${o}`);
    process.exit(GATE_ERROR_EXIT);
  }
  const unclassified = unclassifiedFiles(trackedFilesNulSeparated());
  if (unclassified.length > 0) {
    console.error(
      `${LOG_PREFIX} UNCLASSIFIED file(s): a tracked root or scripts file is in no filter and no ignore list, so a PR touching only it skips every gated job. Add it to APP_PATHS/UI_PATHS/AI_PATHS or IGNORED_PATHS:`,
    );
    for (const f of unclassified) console.error(`  x ${f}`);
    process.exit(GATE_ERROR_EXIT);
  }
  console.log(`${LOG_PREFIX} OK: all ${specs.length} pathspecs resolve.`);
}

if (isMain(import.meta.url)) {
  try {
    main();
  } catch (err) {
    console.error(`${LOG_PREFIX} GATE ERROR: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(GATE_ERROR_EXIT);
  }
}
