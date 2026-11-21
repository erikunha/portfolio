import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AI_MANUAL_PATHS, AI_PATHS, AI_ROOTS } from '../ci/detect-changes-paths.ts';
import { importClosure } from '../lib/import-closure.ts';

let fixtureRoot = '';

function write(relative: string, source: string): void {
  const target = join(fixtureRoot, relative);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, source);
}

beforeEach(() => {
  fixtureRoot = mkdtempSync(join(tmpdir(), 'import-closure-'));
});

afterEach(() => {
  rmSync(fixtureRoot, { recursive: true, force: true });
});

describe('importClosure', () => {
  it('returns the roots and every module they reach, sorted and without duplicates', () => {
    write('route.ts', "import { a } from '@/lib/a';\nimport { b } from '@/lib/b';\n");
    write('lib/a.ts', "import { c } from './c';\nexport const a = c;\n");
    write('lib/b.ts', "import { c } from './c';\nexport const b = c;\n");
    write('lib/c.ts', 'export const c = 1;\n');
    write('lib/unreached.ts', 'export const unreached = 1;\n');
    expect(importClosure(['route.ts'], fixtureRoot)).toEqual([
      'lib/a.ts',
      'lib/b.ts',
      'lib/c.ts',
      'route.ts',
    ]);
  });

  it('adds a module that a transitive import newly reaches (negative control)', () => {
    write('route.ts', "import { a } from '@/lib/a';\n");
    write('lib/a.ts', "import { c } from './c';\n");
    write('lib/c.ts', 'export const c = 1;\n');
    write('lib/d.ts', 'export const d = 1;\n');
    const before = importClosure(['route.ts'], fixtureRoot);
    expect(before).not.toContain('lib/d.ts');
    write('lib/c.ts', "import { d } from '@/lib/d';\nexport const c = d;\n");
    expect(importClosure(['route.ts'], fixtureRoot)).toEqual([...before, 'lib/d.ts'].sort());
  });

  it('resolves aliased, relative, explicit extension, index, tsx, dynamic and side effect imports', () => {
    write(
      'route.ts',
      [
        "import type { T } from '@/lib/types';",
        "export { x } from './ext.ts';",
        "import '@/lib/side-effect';",
        "const lazy = await import('@/components/widget');",
        "import { idx } from '@/lib/folder';",
        '',
      ].join('\n'),
    );
    write('lib/types.ts', 'export type T = string;\n');
    write('ext.ts', 'export const x = 1;\n');
    write('lib/side-effect.ts', 'export {};\n');
    write('components/widget.tsx', 'export const Widget = () => null;\n');
    write('lib/folder/index.ts', 'export const idx = 1;\n');
    expect(importClosure(['route.ts'], fixtureRoot)).toEqual([
      'components/widget.tsx',
      'ext.ts',
      'lib/folder/index.ts',
      'lib/side-effect.ts',
      'lib/types.ts',
      'route.ts',
    ]);
  });

  it('follows relative imports from a nested importer', () => {
    write('app/api/ask/route.ts', "import { h } from '../../../lib/helper';\n");
    write('lib/helper.ts', "import { s } from './shared/s';\n");
    write('lib/shared/s.ts', 'export const s = 1;\n');
    expect(importClosure(['app/api/ask/route.ts'], fixtureRoot)).toEqual([
      'app/api/ask/route.ts',
      'lib/helper.ts',
      'lib/shared/s.ts',
    ]);
  });

  it('skips package imports and specifiers that resolve to no file', () => {
    write(
      'route.ts',
      "import { z } from 'zod';\nimport { gone } from '@/lib/gone';\nimport { n } from 'node:fs';\n",
    );
    expect(importClosure(['route.ts'], fixtureRoot)).toEqual(['route.ts']);
  });

  it('terminates on an import cycle', () => {
    write('a.ts', "import { b } from './b';\n");
    write('b.ts', "import { a } from './a';\n");
    expect(importClosure(['a.ts'], fixtureRoot)).toEqual(['a.ts', 'b.ts']);
  });

  it('keeps a non-code file it reaches without scanning it for imports', () => {
    write('route.ts', "import data from '@/content/data.json';\n");
    write('content/data.json', '{"from": "\'@/lib/never\'"}\n');
    write('lib/never.ts', 'export {};\n');
    expect(importClosure(['route.ts'], fixtureRoot)).toEqual(['content/data.json', 'route.ts']);
  });

  it('names a root that does not exist instead of returning a smaller closure', () => {
    expect(() => importClosure(['missing/route.ts'], fixtureRoot)).toThrow('missing/route.ts');
  });
});

describe('AI_PATHS computed from the ask import closure', () => {
  const repositoryRoot = join(import.meta.dirname, '..', '..');
  const closure = importClosure(AI_ROOTS, repositoryRoot);
  const armedBy = (file: string) =>
    AI_PATHS.some((path) => (path.endsWith('/') ? file.startsWith(path) : file === path));

  it('roots the closure at the ask route and the eval runner', () => {
    expect(AI_ROOTS).toEqual(
      expect.arrayContaining(['app/api/ask/route.ts', 'scripts/eval/ask-eval.ts']),
    );
  });

  it.each([
    'app/api/ask/route.ts',
    'lib/ask/system-prompt.ts',
    'lib/eval/judge.ts',
    'lib/log-error.ts',
    'lib/time.ts',
    'content/brand.ts',
    'content/community.ts',
    'content/open-roles.ts',
    'content/schemas.ts',
    'scripts/eval/ask-eval.ts',
  ])('arms the ai jobs for %s', (file) => {
    expect(armedBy(file)).toBe(true);
  });

  it('arms every module in the closure', () => {
    expect(closure.filter((file) => !armedBy(file))).toEqual([]);
  });

  it('keeps by hand only entries the import walk cannot find', () => {
    const importedFiles = AI_MANUAL_PATHS.filter(
      (path) => !path.endsWith('/') && closure.includes(path),
    );
    expect(
      importedFiles,
      'a manual AI_MANUAL_PATHS entry is already in the import closure: delete it, the walk computes it',
    ).toEqual([]);
  });

  it('keeps the non-import entries the walk cannot see', () => {
    expect(AI_MANUAL_PATHS).toEqual(
      expect.arrayContaining(['.github/workflows/ci.yml', '__tests__/ask/']),
    );
  });

  it('lists no pathspec twice', () => {
    expect(AI_PATHS.filter((path, index) => AI_PATHS.indexOf(path) !== index)).toEqual([]);
  });
});
