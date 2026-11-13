import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const CSS_DIR = path.resolve(__dirname, '../app/css');
const GLOBALS_CSS = path.resolve(__dirname, '../app/globals.css');
const HOME_CSS = path.join(CSS_DIR, 'home.css');
const FORCED_COLORS = 'forced-colors.css';
const GLOBALS_IMPORT = /@import\s+"\.\/css\/([^"]+\.css)";/g;
const HOME_IMPORT = /@import\s+"\.\/([^"]+\.css)";/g;

function imports(file: string, pattern: RegExp): string[] {
  // behavioral-test-allow: reads the shipped stylesheet entrypoints; jsdom cannot evaluate CSS cascade order
  return Array.from(readFileSync(file, 'utf-8').matchAll(pattern), (m) => m[1] ?? '');
}

describe('home stylesheet entry', () => {
  it('ends with forced-colors.css, so the forced-colors overrides still come after every home partial', () => {
    expect(
      imports(GLOBALS_CSS, GLOBALS_IMPORT).at(-1),
      'app/globals.css must import forced-colors.css last',
    ).toBe(FORCED_COLORS);
    expect(
      imports(HOME_CSS, HOME_IMPORT).at(-1),
      'app/css/home.css loads after app/globals.css on the home route, so its partials would outrank the forced-colors overrides of equal specificity (the contact send button, the fader thumb, the VU segments, the map pins) unless forced-colors.css is imported again as its last line.',
    ).toBe(FORCED_COLORS);
  });

  it('ships each components partial from exactly one entry', () => {
    const globals = imports(GLOBALS_CSS, GLOBALS_IMPORT).filter((f) => f.startsWith('components-'));
    const home = imports(HOME_CSS, HOME_IMPORT).filter((f) => f.startsWith('components-'));
    expect(
      home.filter((f) => globals.includes(f)),
      'a partial imported by both app/globals.css and app/css/home.css ships twice on the home route and its second copy reorders the cascade there',
    ).toEqual([]);
    expect(home.length, 'app/css/home.css must import the home section partials').toBeGreaterThan(
      0,
    );
  });
});
