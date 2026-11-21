import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, normalize, posix, sep } from 'node:path';

const ALIAS_PREFIX = '@/';
const RELATIVE_PREFIX = /^\.{1,2}\//;
const IMPORT_SPECIFIER = /(?:from|import)\s*\(?\s*'((?:@\/|\.{1,2}\/)[^']+)'/g;
const SOURCE_FILE = /\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;
const RESOLVE_SUFFIXES = ['', '.ts', '.tsx', '/index.ts', '/index.tsx'];

const toPosix = (path: string): string => path.split(sep).join(posix.sep);

function isFile(path: string): boolean {
  return existsSync(path) && statSync(path).isFile();
}

function resolveSpecifier(specifier: string, importer: string, root: string): string | null {
  let base: string;
  if (specifier.startsWith(ALIAS_PREFIX)) {
    base = specifier.slice(ALIAS_PREFIX.length);
  } else if (RELATIVE_PREFIX.test(specifier)) {
    base = normalize(join(dirname(importer), specifier));
  } else {
    return null;
  }
  const found = RESOLVE_SUFFIXES.map((suffix) => `${base}${suffix}`).find((candidate) =>
    isFile(join(root, candidate)),
  );
  return found === undefined ? null : toPosix(found);
}

export function importClosure(roots: readonly string[], root: string): string[] {
  const seen = new Set<string>();
  const stack = roots.map(toPosix);
  for (const entry of stack) {
    if (!isFile(join(root, entry))) {
      throw new Error(`import closure root does not exist: ${entry}`);
    }
  }
  while (stack.length > 0) {
    const file = stack.pop() as string;
    if (seen.has(file)) continue;
    seen.add(file);
    if (!SOURCE_FILE.test(file)) continue;
    const source = readFileSync(join(root, file), 'utf8');
    for (const match of source.matchAll(IMPORT_SPECIFIER)) {
      const resolved = resolveSpecifier(match[1] ?? '', file, root);
      if (resolved !== null) stack.push(resolved);
    }
  }
  return [...seen].sort();
}
