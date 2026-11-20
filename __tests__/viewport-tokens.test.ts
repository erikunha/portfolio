import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MOBILE_BREAKPOINT_PX } from '@/lib/breakpoint';
import {
  readBaseCssRaw,
  readComponentsCssRaw,
  readViewportTokens,
  resolveViewportTokens,
} from './helpers/components-css';

const REM_PX = 16;
const REM_VALUE = /^[\d.]+rem$/;
const BELOW_PREFIX = '--viewport-below-';
const LENGTH = /^([\d.]+)(px|rem)$/;

const tokens = readViewportTokens();
const toPx = (value: string) => {
  const parts = value.match(LENGTH);
  const amount = Number.parseFloat(parts?.[1] ?? '');
  return parts?.[2] === 'rem' ? amount * REM_PX : amount;
};

// behavioral-test-allow: reads the shipped stylesheet partials; jsdom cannot evaluate media-query resolution
const sheets = `${readBaseCssRaw()}\n${readComponentsCssRaw()}`;
const widthLiterals = Array.from(
  sheets.matchAll(/@media[^{]*?\((?:min|max)-width:\s*(\d+(?:\.\d+)?(?:px|rem))\)/g),
  (match) => toPx(match[1] ?? ''),
);
const scaleValues = new Set(Object.values(tokens).map(toPx));

describe('the viewport scale in theme.css', () => {
  it('declares every step in rem, so the breakpoints follow the root font size', () => {
    expect(Object.keys(tokens).length, 'the sweep found no --viewport-* steps').toBeGreaterThan(4);
    for (const [name, value] of Object.entries(tokens)) {
      expect(value, `${name} must be in rem`).toMatch(REM_VALUE);
    }
  });

  it('declares no below twin, because a range query excludes the step itself', () => {
    expect(Object.keys(tokens).filter((name) => name.startsWith(BELOW_PREFIX))).toEqual([]);
  });

  it('puts the phone/tablet step where the JavaScript viewport query puts it', () => {
    expect(
      toPx(tokens['--viewport-md'] ?? ''),
      'lib/breakpoint.ts MOBILE_BREAKPOINT_PX and --viewport-md in theme.css must change together',
    ).toBe(MOBILE_BREAKPOINT_PX);
  });
});

describe('theme.css own breakpoint', () => {
  it('raises the type floor at the same width --viewport-md names', () => {
    // behavioral-test-allow: reads the shipped token file; jsdom cannot evaluate media-query resolution
    const theme = readFileSync('app/css/theme.css', 'utf8');
    expect(
      theme,
      'the base-layer media query in theme.css cannot call theme() for its own token, so it repeats the --viewport-md width',
    ).toContain(`@media (min-width: ${tokens['--viewport-md']})`);
  });
});

describe('media queries against the scale', () => {
  it('reference every scale width by its token, never by a literal', () => {
    const literal = widthLiterals.filter((width) => scaleValues.has(width));
    expect(
      literal,
      'a (min|max)-width literal that equals a --viewport-* step drifts when the step moves; write theme(--viewport-<name>)',
    ).toEqual([]);
  });

  it('close a range below a step with a width range, never a max-width on the token', () => {
    expect(
      sheets.match(/max-width:\s*theme\(--viewport-[\w-]+\)/g) ?? [],
      'write (width < theme(--viewport-<name>)) so the range stops exactly where min-width starts',
    ).toEqual([]);
  });

  it('resolve every theme(--viewport-*) reference to a declared token', () => {
    expect(() => resolveViewportTokens(sheets)).not.toThrow();
    expect(sheets).toContain('theme(--viewport-md)');
  });
});
