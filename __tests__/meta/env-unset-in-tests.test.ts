import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { listFiles } from '@/scripts/lib/walk';

const ROOTS = ['__tests__', 'scripts/__tests__', 'lib', 'components', 'evals', 'app'];
const SKIP_DIRS: ReadonlySet<string> = new Set(['node_modules', 'fixtures']);
const TEST_FILE = /\.test\.(ts|tsx|mjs)$/;
const ENV_SET_TO_UNDEFINED = /process\.env(\.[A-Za-z_][A-Za-z0-9_]*|\[[^\]]+\])\s*=\s*undefined\b/;
const PROBE_KEY = 'ENV_UNSET_GUARD_PROBE';
const THIS_FILE = '__tests__/meta/env-unset-in-tests.test.ts';

function offenders(): string[] {
  const files = new Set<string>();
  for (const root of ROOTS) {
    for (const path of listFiles(join(process.cwd(), root), {
      include: TEST_FILE,
      skipDirs: SKIP_DIRS,
    })) {
      files.add(`${root}/${path}`);
    }
  }
  return [...files].sort().filter((path) => {
    if (path === THIS_FILE) return false;
    const text = readFileSync(join(process.cwd(), path), 'utf8');
    return ENV_SET_TO_UNDEFINED.test(text);
  });
}

describe('tests that unset an environment variable', () => {
  it('rely on a Node behaviour: assigning undefined stores the string "undefined"', () => {
    Reflect.set(process.env, PROBE_KEY, undefined);
    try {
      expect(process.env[PROBE_KEY]).toBe('undefined');
    } finally {
      delete process.env[PROBE_KEY];
    }
  });

  it('match the assignment the guard looks for', () => {
    expect(ENV_SET_TO_UNDEFINED.test('process.env.PSI_API_KEY = undefined;')).toBe(true);
    expect(ENV_SET_TO_UNDEFINED.test("process.env['A_KEY'] = undefined;")).toBe(true);
    expect(ENV_SET_TO_UNDEFINED.test('delete process.env.PSI_API_KEY;')).toBe(false);
  });

  it('use delete, never an assignment of undefined', () => {
    expect(
      offenders(),
      'process.env coerces every value to a string, so `= undefined` leaves the variable set to "undefined" and the code under test takes the configured path (a real network call in __tests__/redis-singleton.test.ts); use `delete process.env.NAME` or vi.stubEnv',
    ).toEqual([]);
  });
});
