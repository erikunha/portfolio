import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MOBILE_BREAKPOINT_PX } from '@/lib/breakpoint';
import {
  readBaseCssRaw,
  readComponentsCssRaw,
  readViewportTokens,
  resolveViewportTokens,
} from './helpers/components-css';

const MAX_WIDTH_STEP_PX = 0.02;
const BELOW_PREFIX = '--viewport-below-';
const MIN_PREFIX = '--viewport-';
const FLOAT_DIGITS = 2;

const tokens = readViewportTokens();
const px = (value: string) => Number.parseFloat(value);
const steps = Object.entries(tokens).filter(([name]) => !name.startsWith(BELOW_PREFIX));

// behavioral-test-allow: reads the shipped stylesheet partials; jsdom cannot evaluate media-query resolution
const sheets = `${readBaseCssRaw()}\n${readComponentsCssRaw()}`;
const widthLiterals = Array.from(
  sheets.matchAll(/@media[^{]*?\((?:min|max)-width:\s*(\d+(?:\.\d+)?)px\)/g),
  (match) => Number(match[1]),
);
const scaleValues = new Set(Object.values(tokens).map(px));

describe('the viewport scale in theme.css', () => {
  it('names a below value 0.02px under every step, so no width matches both sides of it', () => {
    expect(steps.length, 'the sweep found no --viewport-* steps').toBeGreaterThan(4);
    for (const [name, value] of steps) {
      const below = tokens[name.replace(MIN_PREFIX, BELOW_PREFIX)];
      expect(below, `${name} has no ${BELOW_PREFIX} twin`).toBeDefined();
      expect(px(below ?? '')).toBeCloseTo(px(value) - MAX_WIDTH_STEP_PX, FLOAT_DIGITS);
    }
  });

  it('puts the phone/tablet step where the JavaScript viewport query puts it', () => {
    expect(
      px(tokens['--viewport-md'] ?? ''),
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

  it('resolve every theme(--viewport-*) reference to a declared token', () => {
    expect(() => resolveViewportTokens(sheets)).not.toThrow();
    expect(sheets).toContain('theme(--viewport-md)');
  });
});
