import { describe, expect, it } from 'vitest';
import { assertScannable, findRawHex } from '../scripts/lint-css-tokens';

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
    // The #fff is in a comment; the real violation is on line 2.
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
    expect(assertScannable(true, ['base.css', 'components.css'])).toEqual({ ok: true });
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
