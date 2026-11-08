import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT_DIR = process.cwd();
const SCAN_ROOTS = ['tests', 'components', 'app', 'design-system'];
const SPEC_FILE = /\.(spec|e2e)\.[cm]?[jt]sx?$/;
const HARDCODED_ORIGIN = /localhost:3000/;
const SKIP_DIRS = new Set(['node_modules', '.next', 'test-results', 'playwright-report']);

function specFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    if (SKIP_DIRS.has(entry)) return [];
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return specFiles(full);
    return SPEC_FILE.test(entry) ? [full] : [];
  });
}

describe('end-to-end specs never name the default origin', () => {
  it('derives the origin from the project baseURL, since ci:predict serves on a random port', () => {
    const offenders = SCAN_ROOTS.flatMap((root) => specFiles(join(ROOT_DIR, root))).filter(
      // behavioral-test-allow: the spec sources are the inputs under test; the property is that they do not name an origin
      (file) => HARDCODED_ORIGIN.test(readFileSync(file, 'utf8')),
    );
    expect(
      offenders.map((file) => file.slice(ROOT_DIR.length + 1)),
      'a spec comparing against localhost:3000 asserts nothing on any other origin; read baseURL instead',
    ).toEqual([]);
  });
});
