import { describe, expect, it } from 'vitest';
import {
  type AllowEntry,
  applyAllowlist,
  assertScannable,
  findRawColorFunctions,
  findRawColors,
  findRawHex,
  findTokenFiles,
  type RawColorHit,
} from '../scripts/lint-css-tokens';

describe('findRawHex', () => {
  it('flags a 3-digit hex literal with its line number', () => {
    expect(findRawHex('color: #000;')).toEqual([{ line: 1, hex: '#000' }]);
  });

  it('flags 6- and 8-digit hex literals', () => {
    expect(findRawHex('a{color:#00ff41}\nb{color:#00ff4133}')).toEqual([
      { line: 1, hex: '#00ff41' },
      { line: 2, hex: '#00ff4133' },
    ]);
  });

  it('ignores hex inside block comments (preserving line numbers)', () => {
    expect(findRawHex('/* swatch #fff */\ncolor: #abc;')).toEqual([{ line: 2, hex: '#abc' }]);
  });

  it('does not flag var() token references', () => {
    expect(findRawHex('color: var(--color-secondary-950);')).toEqual([]);
  });

  it('does not flag invalid hex lengths (5/7 digits)', () => {
    expect(findRawHex('a: #12345; b: #1234567;')).toEqual([]);
  });

  it('finds multiple hex on one line', () => {
    expect(findRawHex('text-shadow: 0 0 4px #000, 0 0 8px #000;')).toEqual([
      { line: 1, hex: '#000' },
      { line: 1, hex: '#000' },
    ]);
  });
});

describe('assertScannable', () => {
  it('is ok when the css dir exists and has scannable files', () => {
    expect(assertScannable(true, ['base.css', 'components-hero.css'])).toEqual({ ok: true });
  });

  it('fails when the css dir does not exist (gate would pass vacuously)', () => {
    const v = assertScannable(false, []);
    expect(v.ok).toBe(false);
    expect(v.ok === false && v.reason).toContain('does not exist');
  });

  it('fails when the dir exists but has no .css files to scan', () => {
    const v = assertScannable(true, []);
    expect(v.ok).toBe(false);
    expect(v.ok === false && v.reason).toContain('no .css files');
  });
});

describe('findRawColorFunctions', () => {
  it('flags rgb, rgba, hsl and hsla with literal channels and their line numbers', () => {
    expect(
      findRawColorFunctions(
        'a{background:rgba(0, 0, 0, 0.45)}\nb{color:rgb(0 255 65 / 50%)}\nc{color:hsl(120 100% 50%)}\nd{color:HSLA(120,100%,50%,.5)}',
      ),
    ).toEqual([
      { line: 1, literal: 'rgba(0, 0, 0, 0.45)' },
      { line: 2, literal: 'rgb(0 255 65 / 50%)' },
      { line: 3, literal: 'hsl(120 100% 50%)' },
      { line: 4, literal: 'HSLA(120,100%,50%,.5)' },
    ]);
  });

  it('ignores color functions inside block comments and token references', () => {
    expect(
      findRawColorFunctions('/* rgba(0,0,0,1) */\ncolor: var(--color-glow-06);\nb{color:red}'),
    ).toEqual([]);
  });

  it('does not flag a function whose channels come from a token', () => {
    expect(findRawColorFunctions('a{color:rgb(var(--channels) / 0.5)}')).toEqual([]);
  });
});

describe('findRawColors', () => {
  it('reports hex and color functions together in line order', () => {
    expect(findRawColors('a{color:rgba(0,0,0,.4)}\nb{color:#abc}')).toEqual([
      { line: 1, literal: 'rgba(0,0,0,.4)' },
      { line: 2, literal: '#abc' },
    ]);
  });

  it('flags a raw hex or rgba in a TypeScript token file and skips line comments', () => {
    expect(
      findRawColors(
        "// #fff\nexport const HEAD = '#1d6a2a';\nexport const FADE = 'rgba(0,0,0,0.10)';",
      ),
    ).toEqual([
      { line: 2, literal: '#1d6a2a' },
      { line: 3, literal: 'rgba(0,0,0,0.10)' },
    ]);
  });
});

describe('applyAllowlist', () => {
  const hits: RawColorHit[] = [
    { file: 'app/css/crt.css', line: 7, literal: 'rgba(0, 80, 20, 0.12)' },
    { file: 'app/css/crt.css', line: 18, literal: 'rgba(0, 0, 0, 0.45)' },
    { file: 'app/css/crt.css', line: 19, literal: 'rgba(0, 0, 0, 0.45)' },
  ];
  const entry = (overrides: Partial<AllowEntry>): AllowEntry => ({
    file: 'app/css/crt.css',
    literal: 'rgba(0, 0, 0, 0.45)',
    count: 2,
    reason: 'scanline stripe',
    ...overrides,
  });

  it('passes a hit that an entry names for that file, literal and count', () => {
    const result = applyAllowlist(hits.slice(1), [entry({})]);
    expect(result.violations).toEqual([]);
    expect(result.stale).toEqual([]);
  });

  it('reports every hit no entry names', () => {
    const result = applyAllowlist(hits, [entry({})]);
    expect(result.violations).toEqual([hits[0]]);
  });

  it('reports a new occurrence beyond the allowed count', () => {
    const result = applyAllowlist(hits.slice(1), [entry({ count: 1 })]);
    expect(result.violations).toHaveLength(1);
  });

  it('reports an entry whose literal no longer appears, so the list shrinks with the fix', () => {
    const result = applyAllowlist([], [entry({})]);
    expect(result.stale).toEqual([entry({})]);
  });

  it('reports an entry with fewer hits than its count as stale', () => {
    const result = applyAllowlist(hits.slice(1, 2), [entry({ count: 2 })]);
    expect(result.stale).toHaveLength(1);
  });
});

describe('findTokenFiles', () => {
  it('lists the non-test *-tokens.ts files under the source roots', () => {
    const files = findTokenFiles(process.cwd());
    expect(files).toContain('components/responsive/MatrixRain/rain-tokens.ts');
    expect(files.some((file) => file.endsWith('.test.ts'))).toBe(false);
    expect(files.some((file) => file.includes('node_modules'))).toBe(false);
  });
});
