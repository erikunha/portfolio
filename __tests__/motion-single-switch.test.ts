import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// behavioral-test-allow: the property under test is that no shipped stylesheet or source reads the operating system preference; jsdom cannot cascade CSS
const ROOT = path.resolve(__dirname, '..');
const SOURCE_DIRS = ['app', 'components', 'design-system', 'lib'];
const NO_SCRIPT_REDUCE_MEDIA = '@media (scripting: none) and (prefers-reduced-motion: reduce)';
const NO_SCRIPT_STYLESHEET = 'animations.css';
const SOURCE_FILE = /\.(css|ts|tsx|mdx)$/;
const TEST_FILE = /\.(test|e2e)\.tsx?$/;
const OS_PREFERENCE_READERS = [
  /prefers-reduced-motion/,
  /(?:^|[^\w-])motion-(?:reduce|safe):/,
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

  it('keeps the one exempt block: the operating system setting applies only where no script can offer the switch', () => {
    const stylesheet = files.find((file) => file.endsWith(NO_SCRIPT_STYLESHEET));
    const css = readFileSync(stylesheet ?? '', 'utf-8');
    expect(css.split(NO_SCRIPT_REDUCE_MEDIA)).toHaveLength(2);
    const others = files.filter(
      (file) => file !== stylesheet && readFileSync(file, 'utf-8').includes(NO_SCRIPT_REDUCE_MEDIA),
    );
    expect(others.map((file) => path.relative(ROOT, file))).toEqual([]);
  });

  it.each(OS_PREFERENCE_READERS.map((reader) => [String(reader), reader] as const))(
    'no shipped file reads the operating system preference through %s',
    (_, reader) => {
      const offenders = files
        .filter((file) =>
          reader.test(readFileSync(file, 'utf-8').replaceAll(NO_SCRIPT_REDUCE_MEDIA, '')),
        )
        .map((file) => path.relative(ROOT, file));
      expect(
        offenders,
        'the OS reduce setting must not override the MOTION switch: key the rule off body[data-motion="reduce"] instead',
      ).toEqual([]);
    },
  );
});
