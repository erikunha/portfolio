import { readFileSync } from 'node:fs';
import postcss from 'postcss';
import { afterEach, describe, expect, it } from 'vitest';
import { getThemeColors } from '../../../app/(en)/design-system/_lib/theme-tokens';
import { RAIN_TAIL_ALPHA_PROPERTY, readRainPalette } from './rain-tokens';

const HEAD_PROPERTY = '--color-rain-head';
const BODY_PROPERTY = '--color-rain-body';
const BLACK_PROPERTY = '--color-secondary-950';
const TAIL_ALPHA = '0.1';

function declare(values: Record<string, string>) {
  for (const [property, value] of Object.entries(values)) {
    document.documentElement.style.setProperty(property, value);
  }
}

afterEach(() => {
  document.documentElement.removeAttribute('style');
});

describe('readRainPalette', () => {
  it('reads head, body and canvas black from the custom properties the theme declares', () => {
    declare({
      [HEAD_PROPERTY]: '#166f24',
      [BODY_PROPERTY]: '#0c4015',
      [BLACK_PROPERTY]: '#000000',
      [RAIN_TAIL_ALPHA_PROPERTY]: TAIL_ALPHA,
    });
    const palette = readRainPalette(getComputedStyle(document.documentElement));
    expect(palette.head).toBe('#166f24');
    expect(palette.body).toBe('#0c4015');
    expect(palette.canvasBlack).toBe('#000000');
  });

  it('builds the tail fade from the canvas black and the declared alpha, in the form scaleTailFade rewrites', () => {
    declare({
      [HEAD_PROPERTY]: '#166f24',
      [BODY_PROPERTY]: '#0c4015',
      [BLACK_PROPERTY]: '#000000',
      [RAIN_TAIL_ALPHA_PROPERTY]: TAIL_ALPHA,
    });
    expect(readRainPalette(getComputedStyle(document.documentElement)).tailFade).toBe(
      'rgba(0,0,0,0.1)',
    );
  });

  it('keeps the channels of a tinted canvas color in the tail fade', () => {
    declare({
      [HEAD_PROPERTY]: '#166f24',
      [BODY_PROPERTY]: '#0c4015',
      [BLACK_PROPERTY]: '#0a1b2c',
      [RAIN_TAIL_ALPHA_PROPERTY]: '0.25',
    });
    expect(readRainPalette(getComputedStyle(document.documentElement)).tailFade).toBe(
      'rgba(10,27,44,0.25)',
    );
  });

  it('reads the 3-digit hex the production stylesheet minifies black to', () => {
    declare({
      [HEAD_PROPERTY]: '#166f24',
      [BODY_PROPERTY]: '#0c4015',
      [BLACK_PROPERTY]: '#000',
      [RAIN_TAIL_ALPHA_PROPERTY]: '.1',
    });
    const palette = readRainPalette(getComputedStyle(document.documentElement));
    expect(
      palette.tailFade,
      'the build minifies #000000 to #000 and a 6-digit-only parser throws at mount, which the error boundary hides as a missing rain',
    ).toBe('rgba(0,0,0,.1)');
    expect(palette.canvasBlack).toBe('#000');
  });

  it('fails loudly when the theme tokens are missing instead of painting an empty color', () => {
    expect(() => readRainPalette(getComputedStyle(document.documentElement))).toThrow(
      /MatrixRain needs --color-/,
    );
  });
});

describe('the rain tokens in theme.css', () => {
  it('derive the head and body from the green ramp, so the rain never leaves the palette', () => {
    const colors = getThemeColors();
    expect(colors['rain-head'], '--color-rain-head must alias a primary ramp step').toBe(
      colors['primary-800'],
    );
    expect(colors['rain-body'], '--color-rain-body must alias a primary ramp step').toBe(
      colors['primary-900'],
    );
  });
});

describe('where theme.css declares the rain tokens', () => {
  // behavioral-test-allow: theme.css is the public token data; Tailwind decides at build time which of its variables reach the page
  const theme = postcss.parse(readFileSync('app/css/theme.css', 'utf8'));

  it.each(['--color-rain-head', '--color-rain-body', '--rain-tail-alpha'])(
    'keeps %s on :root, because Tailwind drops an unreferenced @theme variable and the rain would not start',
    (property) => {
      const parents: string[] = [];
      theme.walkDecls(property, (declaration) => {
        const parent = declaration.parent;
        parents.push(
          parent?.type === 'rule'
            ? (parent as postcss.Rule).selector
            : parent?.type === 'atrule'
              ? `@${(parent as postcss.AtRule).name}`
              : 'root',
        );
      });
      expect(parents).toEqual([':root']);
    },
  );
});
