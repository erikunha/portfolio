import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { componentsCssFiles, readComponentsCss } from './components-css';

const CSS_DIR = path.resolve(__dirname, '../../app/css');
const GLOBALS_CSS = path.resolve(__dirname, '../../app/globals.css');
const PARTIAL = /^components-.+\.css$/;

const HOTTEST_TAKES_MARKER = '#sec-hottest-takes > header h2';
const CAREER_MARKER = '.career-section';

function globalsImportOrder(): string[] {
  // behavioral-test-allow: reads the shipped stylesheet entrypoint; jsdom cannot evaluate CSS cascade order
  const globals = readFileSync(GLOBALS_CSS, 'utf-8');
  return Array.from(
    globals.matchAll(/@import\s+"\.\/css\/(components-[^"]+\.css)";/g),
    (m) => m[1] ?? '',
  );
}

describe('components partial order', () => {
  it('lists the partials in the app/globals.css @import order, not alphabetically', () => {
    expect(
      componentsCssFiles(),
      'the helper must return the partials in the order app/globals.css imports them, because that import order is the cascade order the browser resolves. An alphabetical order concatenates the stylesheet in an order no browser ever produces, so a last-match-wins assertion over it can disagree with the real cascade.',
    ).toEqual(globalsImportOrder());
  });

  it('orders the partials so a later @import wins the cascade for a same-specificity rule', () => {
    const files = componentsCssFiles();
    const hottestTakes = files.indexOf('components-hottest-takes.css');
    const career = files.indexOf('components-career.css');
    expect(
      hottestTakes,
      'components-hottest-takes.css is imported first and must be found',
    ).toBeGreaterThanOrEqual(0);
    expect(
      career,
      'components-career.css is imported fourth and must be found',
    ).toBeGreaterThanOrEqual(0);
    expect(
      hottestTakes,
      'components-hottest-takes.css is imported before components-career.css, so it must come first in the helper order. Alphabetically career comes first, which reverses the cascade for any selector both partials define.',
    ).toBeLessThan(career);

    const css = readComponentsCss();
    expect(
      css.indexOf(HOTTEST_TAKES_MARKER),
      'the hottest-takes rule must be in the concatenated stylesheet',
    ).toBeGreaterThanOrEqual(0);
    expect(
      css.indexOf(CAREER_MARKER),
      'the career rule must be in the concatenated stylesheet',
    ).toBeGreaterThanOrEqual(0);
    expect(
      css.indexOf(HOTTEST_TAKES_MARKER),
      'the concatenated stylesheet must place the hottest-takes rule before the career rule, so that a last-match-wins assertion sees the same cascade the browser resolves.',
    ).toBeLessThan(css.indexOf(CAREER_MARKER));
  });

  it('covers every components-*.css partial that exists on disk', () => {
    const onDisk = readdirSync(CSS_DIR).filter((f) => PARTIAL.test(f));
    expect(
      [...componentsCssFiles()].sort(),
      'every app/css/components-*.css partial must be imported by app/globals.css, because an unimported partial is never shipped and a stylesheet assertion that read it would pass against CSS the browser never loads.',
    ).toEqual([...onDisk].sort());
  });
});
