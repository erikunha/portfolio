import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { findUtilityClassCollisions, listScannedCss, scanRepo } from '../gates/lint-css-tokens';

const sheet = (css: string) => [{ file: 'app/css/components-mixer.css', css }];
const names = (theme: string, css: string): string[] =>
  findUtilityClassCollisions(theme, sheet(css)).map((hit) => hit.literal);

describe('findUtilityClassCollisions', () => {
  it.each([
    ['mx-fader', '@theme { --spacing-fader: 1rem; }', '.mx-fader { width: 5rem; }'],
    ['w-wide', '@theme { --spacing-wide: 9rem; }', '.mixer .w-wide:hover { top: 0; }'],
    ['bg-wash', '@theme { --color-wash: red; }', '@media print { .bg-wash { color: blue; } }'],
    ['rounded-pill', '@theme { --radius-pill: 1rem; }', '.rounded-pill { color: blue; }'],
    ['text-huge', '@theme { --text-huge: 4rem; }', '.text-huge { color: blue; }'],
  ])('flags %s', (literal, theme, css) => {
    expect(names(theme, css)).toEqual([literal]);
  });

  it.each([
    [
      'a prefix with no matching token',
      '@theme { --spacing-lane: 1rem; }',
      '.mx-fader { top: 0; }',
    ],
    ['a token of another namespace', '@theme { --color-fader: red; }', '.mx-fader { top: 0; }'],
    ['a sub-property token', '@theme { --text-huge--line-height: 1; }', '.text-huge { top: 0; }'],
    [
      'a rule that only sets a custom property',
      '@theme { --text-huge: 4rem; }',
      '.text-huge { --leading: 1; }',
    ],
    ['a longer class name', '@theme { --spacing-fader: 1rem; }', '.mx-fader-thumb { top: 0; }'],
  ])('passes %s', (_label, theme, css) => {
    expect(names(theme, css)).toEqual([]);
  });

  it('flags a rule that mixes a custom property with a real one', () => {
    expect(
      names('@theme { --spacing-fader: 1rem; }', '.mx-fader { --a: 1; width: 5rem; }'),
    ).toEqual(['mx-fader']);
  });

  it('reports the sheet and the line of the rule', () => {
    const hits = findUtilityClassCollisions(
      '@theme { --spacing-fader: 1rem; }',
      sheet('.a { top: 0; }\n\n.mx-fader { top: 0; }'),
    );
    expect(hits).toEqual([{ file: 'app/css/components-mixer.css', line: 3, literal: 'mx-fader' }]);
  });
});

describe('scanRepo class collisions', () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'css-collision-'));
    mkdirSync(join(root, 'app/css'), { recursive: true });
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('flags a component class that a theme token turns into a utility', () => {
    writeFileSync(join(root, 'app/css/theme.css'), '@theme { --spacing-fader: 1rem; }');
    writeFileSync(join(root, 'app/css/components-mixer.css'), '.mx-fader { width: 5rem; }');
    const hits = scanRepo(root, ['components-mixer.css']).collisions;
    expect(hits.map((hit) => `${hit.file}:${hit.literal}`)).toEqual([
      'app/css/components-mixer.css:mx-fader',
    ]);
  });

  it('finds none in the repository stylesheets', () => {
    const cwd = process.cwd();
    expect(scanRepo(cwd, listScannedCss(cwd)).collisions).toEqual([]);
  });
});
