import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  type AllowEntry,
  findRawColorFunctions,
  findRawColors,
  findRawFocusRing,
  findRawZIndex,
  listScannedCss,
  scanRepo,
} from '../scripts/lint-css-tokens';

const ROOT = process.cwd();
const ALLOWLIST_PATH = 'scripts/lint-css-tokens.allowlist.json';

const read = (file: string) => readFileSync(join(ROOT, file), 'utf8');

describe('modern color functions', () => {
  it('flags oklch, oklab, lab, lch, hwb and color() with literal channels', () => {
    expect(
      findRawColorFunctions(
        'a{color:oklch(0.8 0.2 150)}\nb{color:oklab(0.5 0.1 0.1)}\nc{color:lab(50% 40 59)}\nd{color:lch(50% 80 30)}\ne{color:hwb(120 0% 0%)}\nf{color:color(srgb 0 1 0.25)}',
      ).map((hit) => hit.line),
    ).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('leaves color-mix and relative color syntax alone', () => {
    expect(
      findRawColorFunctions(
        'a{color:color-mix(in srgb, var(--color-primary-500) 6%, transparent)}\nb{color:oklch(from var(--color-primary-500) l c h)}',
      ),
    ).toEqual([]);
  });
});

describe('findRawZIndex', () => {
  it('flags a numeric z-index and a calc over literals in css', () => {
    expect(
      findRawZIndex('a{z-index: 10}\nb{z-index: calc(110 + 5)}\nc{z-index:9999;}', 'css'),
    ).toEqual([
      { line: 1, literal: 'z-index: 10' },
      { line: 2, literal: 'z-index: calc(110 + 5)' },
      { line: 3, literal: 'z-index:9999' },
    ]);
  });

  it('accepts a z-index that is exactly one scale token', () => {
    expect(findRawZIndex('a{z-index: var(--z-drawer);}\nb{z-index:auto}', 'css')).toEqual([]);
  });

  it('flags arithmetic on a scale token, so a gap in the scale gets a name', () => {
    expect(findRawZIndex('a{z-index: calc(var(--z-position-line) + 1)}', 'css')).toHaveLength(1);
  });

  it('flags a --z-* declaration outside theme.css', () => {
    expect(findRawZIndex(':root{--z-offline: 130}', 'css')).toEqual([
      { line: 1, literal: '--z-offline: 130' },
    ]);
  });

  it('flags a tailwind z utility with a literal and an inline numeric zIndex', () => {
    expect(
      findRawZIndex(
        '<div className="sticky z-[110] z-10" style={{ zIndex: RAIN_LAYER }} />',
        'tsx',
      ).map((hit) => hit.literal),
    ).toEqual(['z-[110]', 'z-10', 'zIndex: RAIN_LAYER']);
  });

  it('accepts the scale through a tailwind utility and an inline var()', () => {
    expect(
      findRawZIndex(
        '<div className="z-(--z-topbar) z-[var(--z-dock)]" style={{ zIndex: \'var(--z-rain)\' }} />',
        'tsx',
      ),
    ).toEqual([]);
  });

  it('does not read a class name that merely contains z-', () => {
    expect(findRawZIndex('<div className="size-z-ratio fuzz-10 data-z-1" />', 'tsx')).toEqual([]);
  });
});

describe('findRawFocusRing', () => {
  it('flags a hand-written ring on :focus-visible', () => {
    expect(
      findRawFocusRing('.a:focus-visible {\n  outline: 1px solid var(--color-green);\n}'),
    ).toEqual([{ line: 2, literal: 'outline: 1px solid var(--color-green)' }]);
  });

  it('flags an offset that is not on the ring scale', () => {
    expect(
      findRawFocusRing(
        '.a:focus-visible { outline: var(--focus-ring); outline-offset: var(--spacing-1); }',
      ),
    ).toEqual([{ line: 1, literal: 'outline-offset: var(--spacing-1)' }]);
  });

  it('accepts the shared ring with either ring offset', () => {
    expect(
      findRawFocusRing(
        '.a:focus-visible { outline: var(--focus-ring); outline-offset: var(--focus-ring-offset); }\n.b:focus-visible { outline-offset: var(--focus-ring-offset-inset); }',
      ),
    ).toEqual([]);
  });

  it('flags the shared ring on plain :focus, so a mouse click never paints it', () => {
    expect(findRawFocusRing('.a:focus { outline: var(--focus-ring); }')).toHaveLength(1);
  });

  it('accepts outline: none on a programmatic focus target', () => {
    expect(findRawFocusRing('[tabindex="-1"]:focus { outline: none; }')).toEqual([]);
  });

  it('ignores outlines that are not focus rules', () => {
    expect(findRawFocusRing('.cell[data-now] { outline: 1px solid var(--color-text); }')).toEqual(
      [],
    );
  });
});

describe('the repository against the token boundary', () => {
  const scan = scanRepo(ROOT, listScannedCss(ROOT));
  const describeHits = (hits: { file: string; line: number; literal: string }[]) =>
    hits.map((hit) => `${hit.file}:${hit.line} ${hit.literal}`);

  it('carries every CRT and rain color as a theme token, with no allowlist entry', () => {
    // behavioral-test-allow: the gate under test scans shipped source files, so the fixture is the file itself
    const allowlist = JSON.parse(read(ALLOWLIST_PATH)) as AllowEntry[];
    expect(
      allowlist.filter((entry) => /crt\.css$|rain-tokens\.ts$/.test(entry.file)),
      'crt.css and rain-tokens.ts derive their colors from theme.css tokens; an allowlist entry brings off-palette colors back',
    ).toEqual([]);
    // behavioral-test-allow: the gate under test scans shipped source files, so the fixture is the file itself
    expect(findRawColors(read('app/css/crt.css'))).toEqual([]);
    // behavioral-test-allow: the gate under test scans shipped source files, so the fixture is the file itself
    expect(findRawColors(read('components/responsive/MatrixRain/rain-tokens.ts'))).toEqual([]);
  });

  it('gives every allowlist entry a reason', () => {
    // behavioral-test-allow: the gate under test scans shipped source files, so the fixture is the file itself
    const allowlist = JSON.parse(read(ALLOWLIST_PATH)) as AllowEntry[];
    expect(allowlist.filter((entry) => entry.reason.trim().length === 0)).toEqual([]);
  });

  it('keeps every z-index on the --z-* scale declared in theme.css', () => {
    expect(
      describeHits(scan.zIndex),
      'a z-index outside the scale is a stacking decision nobody can read next to the others; add a named step to the scale in app/css/theme.css',
    ).toEqual([]);
  });

  it('draws every keyboard focus ring from the shared ring token', () => {
    expect(
      describeHits(scan.focus),
      'a focus rule that hand-writes its ring drifts from the one width, color and offset the site promises (WCAG 2.4.13)',
    ).toEqual([]);
  });

  it('declares the whole z-index scale in theme.css', () => {
    // behavioral-test-allow: theme.css is the public token data the scale lives in
    const theme = read('app/css/theme.css');
    const names = [...theme.matchAll(/(--z-[\w-]+)\s*:/g)].map((match) => match[1]);
    expect(names.length, 'theme.css lost its --z-* scale').toBeGreaterThan(8);
    expect(new Set(names).size, 'a --z-* name is declared twice in theme.css').toBe(names.length);
  });
});
