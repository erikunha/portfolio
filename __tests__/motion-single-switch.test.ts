import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// behavioral-test-allow: the property under test is that no shipped stylesheet or source reads the operating system preference; jsdom cannot cascade CSS
const ROOT = path.resolve(__dirname, '..');
const SOURCE_DIRS = ['app', 'components', 'lib'];
const SOURCE_FILE = /\.(css|ts|tsx|mdx)$/;
const TEST_FILE = /\.(test|e2e)\.tsx?$/;
const OS_PREFERENCE_READERS = [
  /prefers-reduced-motion\s*:\s*(reduce|no-preference)/,
  /(?:^|[\s"'`[{(,])motion-(?:reduce|safe):/,
  /useReducedMotion/,
];

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : walk(full);
    return SOURCE_FILE.test(entry.name) && !TEST_FILE.test(entry.name) ? [full] : [];
  });
}

describe('the MOTION switch is the only motion control', () => {
  const files = SOURCE_DIRS.flatMap((dir) => walk(path.join(ROOT, dir)));

  it('finds the stylesheets and sources it guards', () => {
    expect(files.some((file) => file.endsWith('animations.css'))).toBe(true);
    expect(files.some((file) => file.endsWith('lib/motion.ts'))).toBe(true);
  });

  it.each(OS_PREFERENCE_READERS.map((reader) => [String(reader), reader] as const))(
    'no shipped file reads the operating system preference through %s',
    (_, reader) => {
      const offenders = files
        .filter((file) => reader.test(readFileSync(file, 'utf-8')))
        .map((file) => path.relative(ROOT, file));
      expect(
        offenders,
        'the OS reduce setting must not override the MOTION switch: key the rule off body[data-motion="reduce"] instead',
      ).toEqual([]);
    },
  );
});
