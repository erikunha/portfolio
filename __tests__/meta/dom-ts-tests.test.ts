import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { listFiles } from '@/scripts/lib/walk';
import { DOM_TS_TESTS } from '../../vitest.config';

const repoRoot = process.cwd();
const SKIP_DIRS: ReadonlySet<string> = new Set([
  'node_modules',
  '.next',
  '.claude',
  '.worktrees',
  '.git',
  'coverage',
]);
const TS_TEST_FILE = /\.test\.ts$/;
const BROWSER_GUARD = /typeof\s+(?:window|document)\b/;
const LOCAL_IMPORT =
  /(?:from|import\s*\(|mock\s*\()\s*['"]((?:\.{1,2}\/|@\/)[^'"]+)['"]|import\s+['"]((?:\.{1,2}\/|@\/)[^'"]+)['"]/g;
const ALIAS_PREFIX = '@/';
const SUFFIXES = ['', '.ts', '.tsx', '/index.ts', '/index.tsx'];

const NODE_BRANCH_ON_PURPOSE: readonly string[] = ['__tests__/rate-limit-getters.test.ts'];

function readSource(relativePath: string): string {
  // behavioral-test-allow: the property is about which modules a test imports and whether they guard on a browser global, which only the sources show
  return readFileSync(join(repoRoot, relativePath), 'utf8');
}

function resolveImport(fromFile: string, specifier: string): string | undefined {
  const base = specifier.startsWith(ALIAS_PREFIX)
    ? join(repoRoot, specifier.slice(ALIAS_PREFIX.length))
    : resolve(dirname(join(repoRoot, fromFile)), specifier);
  const found = SUFFIXES.map((suffix) => `${base}${suffix}`).find(
    (candidate) => existsSync(candidate) && !candidate.endsWith('/'),
  );
  return found === undefined ? undefined : found.slice(repoRoot.length + 1);
}

function directImports(testFile: string): string[] {
  const source = readSource(testFile);
  return [...source.matchAll(LOCAL_IMPORT)]
    .map((match) => match[1] ?? match[2] ?? '')
    .map((specifier) => resolveImport(testFile, specifier))
    .filter((imported): imported is string => imported !== undefined && /\.tsx?$/.test(imported));
}

function importsGuardedModule(testFile: string): boolean {
  return directImports(testFile).some((imported) => BROWSER_GUARD.test(readSource(imported)));
}

const nodeTsTests = listFiles(repoRoot, {
  include: (name) => TS_TEST_FILE.test(name),
  skipDirs: SKIP_DIRS,
}).filter((file) => !(DOM_TS_TESTS as readonly string[]).includes(file));

describe('the list of .ts tests that run under jsdom stays true to the disk', () => {
  it('names only files that exist and are .ts tests', () => {
    const broken = DOM_TS_TESTS.filter(
      (file) => !existsSync(join(repoRoot, file)) || !TS_TEST_FILE.test(file),
    );

    expect(broken).toEqual([]);
  });

  it('lists no file twice', () => {
    expect(new Set(DOM_TS_TESTS).size).toBe(DOM_TS_TESTS.length);
  });

  it('keeps a .ts test that imports a module guarding on window or document in the jsdom list', () => {
    const unlisted = nodeTsTests.filter(
      (file) => !NODE_BRANCH_ON_PURPOSE.includes(file) && importsGuardedModule(file),
    );

    expect(unlisted).toEqual([]);
  });

  it('keeps every deliberate node-branch test outside the jsdom list and on a guarded import', () => {
    const stale = NODE_BRANCH_ON_PURPOSE.filter(
      (file) => !nodeTsTests.includes(file) || !importsGuardedModule(file),
    );

    expect(stale).toEqual([]);
  });
});
