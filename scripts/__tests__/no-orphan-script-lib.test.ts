import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

const LIB_DIR = 'scripts/lib';

const SEARCH_ROOTS = ['scripts', '__tests__', 'tests', '.github', 'package.json'];

const SKIPPED_DIRS = new Set(['node_modules', '.next', '.git']);

const TEXT_EXTENSIONS = new Set(['.ts', '.tsx', '.mjs', '.mts', '.js', '.json', '.yml', '.yaml']);

function collect(path: string, into: string[]): string[] {
  if (statSync(path).isDirectory()) {
    for (const entry of readdirSync(path)) {
      if (!SKIPPED_DIRS.has(entry)) collect(join(path, entry), into);
    }
  } else if (TEXT_EXTENSIONS.has(extname(path))) {
    into.push(path);
  }
  return into;
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function findOrphans(libFiles: readonly string[], corpus: ReadonlyMap<string, string>): string[] {
  return libFiles.filter((lib) => {
    const stem = basename(lib, extname(lib));
    const reference = new RegExp(`[/'"]${escapeRegExp(stem)}(\\.\\w+)?['"]`);
    return ![...corpus].some(([path, text]) => path !== lib && reference.test(text));
  });
}

describe('scripts/lib has no orphan module', () => {
  it('flags a module nothing references', () => {
    const corpus = new Map([['scripts/a.ts', "import { x } from './lib/used';"]]);
    expect(findOrphans(['scripts/lib/used.ts', 'scripts/lib/lonely.ts'], corpus)).toEqual([
      'scripts/lib/lonely.ts',
    ]);
  });

  it('does not count a module referencing itself', () => {
    const corpus = new Map([['scripts/lib/self.ts', "export const n = './self';"]]);
    expect(findOrphans(['scripts/lib/self.ts'], corpus)).toEqual(['scripts/lib/self.ts']);
  });

  it('every module under scripts/lib is referenced from scripts, tests, package.json or .github', () => {
    const libFiles = readdirSync(LIB_DIR).map((name) => join(LIB_DIR, name));
    const files = SEARCH_ROOTS.flatMap((root) => collect(root, []));
    const corpus = new Map(files.map((file) => [file, readFileSync(file, 'utf8')]));
    expect(
      findOrphans(libFiles, corpus),
      'a module under scripts/lib has no importer: delete it, or import it from the script that needs it',
    ).toEqual([]);
  });
});
