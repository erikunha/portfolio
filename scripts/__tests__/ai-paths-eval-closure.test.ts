import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AI_PATHS } from '../ci/detect-changes-paths.ts';

const ROOTS = ['app/api/ask/route.ts', 'scripts/eval/ask-eval.ts'];

const EXTENSIONS = ['.ts', '.tsx', '/index.ts', '/index.tsx'];

const IMPORT_SPECIFIER = /(?:from|import)\s*\(?\s*'((?:@\/|\.{1,2}\/)[^']+)'/g;

function resolveSpecifier(specifier: string, importer: string): string | null {
  const base = specifier.startsWith('@/')
    ? specifier.slice(2)
    : normalize(join(dirname(importer), specifier));
  return (
    EXTENSIONS.map((ext) => `${base}${ext}`).find((candidate) => existsSync(candidate)) ?? null
  );
}

function importClosure(roots: readonly string[]): string[] {
  const seen = new Set<string>();
  const stack = [...roots];
  while (stack.length > 0) {
    const file = stack.pop() as string;
    if (seen.has(file)) continue;
    seen.add(file);
    // behavioral-test-allow: walks the import graph to prove the CI path filter covers it
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(IMPORT_SPECIFIER)) {
      const resolved = resolveSpecifier(match[1] ?? '', file);
      if (resolved) stack.push(resolved);
    }
  }
  return [...seen].sort();
}

const covered = (file: string) =>
  AI_PATHS.some((p: string) =>
    p.includes('*')
      ? file.startsWith(p.replace(/\*.*$/, ''))
      : p.endsWith('/')
        ? file.startsWith(p)
        : file === p,
  );

function pasteLines(missing: readonly string[]): string {
  return missing.map((file) => `  '${file}',`).join('\n');
}

describe('AI_PATHS covers the import closure of the ask route and the eval runner', () => {
  it('walks both roots and finds the modules they import', () => {
    const closure = importClosure(ROOTS);
    expect(closure).toContain('lib/ask/system-prompt.ts');
    expect(closure).toContain('lib/eval/judge.ts');
  });

  it('arms the ai jobs for every module either root imports, relative imports included', () => {
    const missing = importClosure(ROOTS).filter((file) => !covered(file));
    expect(
      missing,
      `a module the ask route or the eval runner imports is outside AI_PATHS: a change to it skips the eval and calibration gate. Add these lines to AI_PATHS in scripts/ci/detect-changes-paths.ts:\n${pasteLines(missing)}`,
    ).toEqual([]);
  });

  it('prints one paste line per missing module, quoted and comma terminated', () => {
    expect(pasteLines(['lib/a.ts', 'lib/b/c.ts'])).toBe("  'lib/a.ts',\n  'lib/b/c.ts',");
  });
});
