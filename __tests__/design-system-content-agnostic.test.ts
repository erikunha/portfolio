import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const DESIGN_SYSTEM_DIR = join(process.cwd(), 'design-system');
const SOURCE_FILE = /\.(?:ts|tsx|mdx|js|jsx|mjs|cjs)$/;
const CONTENT_SPECIFIER =
  /(?:\bfrom|\bimport\s*\(|\brequire\s*\()\s*['"](?:@\/content(?:\/[^'"]*)?|(?:\.\.\/)+content(?:\/[^'"]*)?)['"]/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return SOURCE_FILE.test(entry) ? [path] : [];
  });
}

describe('design system is content-agnostic', () => {
  const files = sourceFiles(DESIGN_SYSTEM_DIR);

  it('scans the design-system source tree', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it('imports nothing from the app content layer', () => {
    const offenders = files
      .filter((file) => CONTENT_SPECIFIER.test(readFileSync(file, 'utf8')))
      .map((file) => relative(process.cwd(), file));
    expect(offenders, 'the design system stays content-agnostic; pass copy as props').toEqual([]);
  });
});
