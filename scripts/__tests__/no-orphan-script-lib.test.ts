import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
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

const TEST_PATH = /(^|\/)(__tests__|tests)\/|\.(test|spec)\.\w+$/;

const isTestFile = (path: string): boolean => TEST_PATH.test(path);

const BLOCK_COMMENT = /^[ \t]*\/\*[\s\S]*?\*\//gm;
const LINE_COMMENT = /(^|\s)\/\/.*$/gm;

const withoutComments = (text: string): string =>
  text.replace(BLOCK_COMMENT, '').replace(LINE_COMMENT, '$1');

const TEST_SUPPORT_LIBS: ReadonlyMap<string, string> = new Map();

function findOrphans(
  libFiles: readonly string[],
  corpus: ReadonlyMap<string, string>,
  testSupport: ReadonlyMap<string, string> = new Map(),
): string[] {
  return libFiles.filter((lib) => {
    const stem = basename(lib, extname(lib));
    const reference = new RegExp(`[/'"]${escapeRegExp(stem)}(\\.\\w+)?['"]`);
    const importers = [...corpus].filter(
      ([path, text]) => path !== lib && reference.test(withoutComments(text)),
    );
    return !importers.some(([path]) => testSupport.has(lib) || !isTestFile(path));
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

  it('does not count a test that is the only importer', () => {
    const corpus = new Map([
      ['scripts/__tests__/only.test.ts', "import { x } from '../lib/only';"],
    ]);
    expect(findOrphans(['scripts/lib/only.ts'], corpus)).toEqual(['scripts/lib/only.ts']);
  });

  it('does not count a root-level test or a spec as an importer either', () => {
    const corpus = new Map([
      ['__tests__/ci/only.test.ts', "import { x } from '../../scripts/lib/a';"],
      ['tests/e2e/b.spec.ts', "import { x } from '../../scripts/lib/b';"],
    ]);
    expect(findOrphans(['scripts/lib/a.ts', 'scripts/lib/b.ts'], corpus)).toEqual([
      'scripts/lib/a.ts',
      'scripts/lib/b.ts',
    ]);
  });

  it('counts a script as an importer next to a test that imports it too', () => {
    const corpus = new Map([
      ['scripts/__tests__/both.test.ts', "import { x } from '../lib/both';"],
      ['scripts/tool.ts', "import { x } from './lib/both';"],
    ]);
    expect(findOrphans(['scripts/lib/both.ts'], corpus)).toEqual([]);
  });

  it('does not count a mention in a line comment or a block comment', () => {
    const corpus = new Map([
      ['scripts/a.ts', "// import { x } from './lib/mentioned';\nexport const n = 1;"],
      ['scripts/b.ts', "/*\n * import from './lib/blocked'\n */\nexport const m = 2;"],
    ]);
    expect(findOrphans(['scripts/lib/mentioned.ts', 'scripts/lib/blocked.ts'], corpus)).toEqual([
      'scripts/lib/mentioned.ts',
      'scripts/lib/blocked.ts',
    ]);
  });

  it('counts an import that carries a trailing comment', () => {
    const corpus = new Map([['scripts/a.ts', "import { x } from './lib/used'; // the helper"]]);
    expect(findOrphans(['scripts/lib/used.ts'], corpus)).toEqual([]);
  });

  it('lets a declared test-support module be referenced by tests alone', () => {
    const corpus = new Map([
      ['scripts/__tests__/t.test.ts', "import { x } from '../lib/support';"],
    ]);
    const support = new Map([['scripts/lib/support.ts', 'only the guard tests parse with it']]);
    expect(findOrphans(['scripts/lib/support.ts'], corpus, support)).toEqual([]);
  });

  it('still reports a declared test-support module that nothing references at all', () => {
    const support = new Map([['scripts/lib/support.ts', 'only the guard tests parse with it']]);
    expect(findOrphans(['scripts/lib/support.ts'], new Map(), support)).toEqual([
      'scripts/lib/support.ts',
    ]);
  });

  it('every module under scripts/lib is referenced from a script, package.json or .github, or declared test support', () => {
    const libFiles = readdirSync(LIB_DIR).map((name) => join(LIB_DIR, name));
    const files = SEARCH_ROOTS.flatMap((root) => collect(root, []));
    const corpus = new Map(files.map((file) => [file, readFileSync(file, 'utf8')]));
    expect(
      findOrphans(libFiles, corpus, TEST_SUPPORT_LIBS),
      'a module under scripts/lib has no importer outside the tests: delete it, import it from the script that needs it, or declare it in TEST_SUPPORT_LIBS with its reason',
    ).toEqual([]);
  });

  it('declares a test-support module only while a test imports it and no script does', () => {
    const files = SEARCH_ROOTS.flatMap((root) => collect(root, []));
    const corpus = new Map(files.map((file) => [file, readFileSync(file, 'utf8')]));
    for (const lib of TEST_SUPPORT_LIBS.keys()) {
      expect(existsSync(lib), `${lib} is declared test support but does not exist`).toBe(true);
      const nonTest = new Map([...corpus].filter(([path]) => !isTestFile(path)));
      expect(
        findOrphans([lib], nonTest),
        `${lib} has a non-test importer now: drop it from TEST_SUPPORT_LIBS`,
      ).toEqual([lib]);
    }
  });
});
