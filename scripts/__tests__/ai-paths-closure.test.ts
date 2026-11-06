import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AI_PATHS } from '../detect-changes-paths.mjs';

const ROOTS = [
  'app/api/ask/route.ts',
  ...readdirSync('lib/ask')
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
    .map((f) => `lib/ask/${f}`),
];

function resolveAlias(spec: string): string | null {
  if (!spec.startsWith('@/')) return null;
  const base = spec.slice(2);
  return [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`].find((c) => existsSync(c)) ?? null;
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
    for (const match of source.matchAll(/from '(@\/[^']+)'/g)) {
      const resolved = resolveAlias(match[1] ?? '');
      if (resolved) stack.push(resolved);
    }
  }
  return [...seen].sort();
}

const covered = (file: string) =>
  AI_PATHS.some((p: string) => file.startsWith(p.replace(/\*$/, '')));

describe('AI_PATHS covers the ask import closure', () => {
  it('arms the ai jobs for every module /api/ask and its prompt import', () => {
    const missing = importClosure(ROOTS).filter((f) => !covered(f));
    expect(
      missing,
      'a file the ask route or system prompt imports is outside AI_PATHS: a change to it skips the eval and calibration gate',
    ).toEqual([]);
  });
});
