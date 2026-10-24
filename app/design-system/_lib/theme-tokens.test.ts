import { readFileSync } from 'node:fs';
import postcss from 'postcss';
import { describe, expect, it } from 'vitest';
import { getThemeColors, parseThemeColors } from './theme-tokens';

describe('parseThemeColors', () => {
  it('extracts --color-* declarations from an @theme block', () => {
    const css = [
      '@theme {',
      '  --color-signal: #00ff41;',
      '  --color-signal-subtle: #00ff4166;',
      '  --font-mono: "JetBrains Mono";',
      '}',
    ].join('\n');
    expect(parseThemeColors(css)).toEqual({
      signal: '#00ff41',
      'signal-subtle': '#00ff4166',
    });
  });

  it('ignores non-color custom properties', () => {
    expect(parseThemeColors('--font-display: "Geist"; --color-fg: #e6ffe6;')).toEqual({
      fg: '#e6ffe6',
    });
  });

  it('returns an empty map when no colors are present', () => {
    expect(parseThemeColors(':root {}')).toEqual({});
  });
});

describe('terminal theme contract', () => {
  it('exposes the approved semantic text and emphasis roles without removing consumed shades', () => {
    expect(getThemeColors()).toMatchObject({
      text: '#e6ffe6',
      'text-secondary': '#a1b3a1',
      green: '#00ff41',
      'secondary-950': '#000000',
      'primary-500': '#00ff41',
      'tertiary-50': '#e6ffe6',
      'primary-300': '#5ae07b',
      'primary-400': '#4ade80',
      'tertiary-400': '#8a9d8a',
    });
  });

  // behavioral-test-allow: theme.css is the public token data consumed by Tailwind and the token reference page.
  const theme = postcss.parse(readFileSync('app/css/theme.css', 'utf8'));
  const tokens: Record<string, string> = {};
  theme.walkAtRules('theme', (rule) => {
    rule.walkDecls((declaration) => {
      tokens[declaration.prop] = declaration.value;
    });
  });

  it('provides the prototype type steps and existing self-hosted font stacks', () => {
    expect(tokens).toMatchObject({
      '--font-display': 'var(--font-display-src), sans-serif',
      '--font-mono': 'var(--font-mono-src), monospace',
      '--text-xs': 'max(0.75rem, var(--text-min))',
      '--text-sm': '0.875rem',
      '--text-base': '1rem',
      '--text-lg': '1.125rem',
      '--text-xl': '1.25rem',
      '--text-2xl': '1.5rem',
      '--text-3xl': '2rem',
      '--text-5xl': '3rem',
      '--text-7xl': '4rem',
    });
  });

  it('raises the minimum text token to 13px from 768px upward', () => {
    let minimum: string | undefined;
    theme.walkAtRules('media', (rule) => {
      if (rule.params === '(min-width: 768px)') {
        rule.walkDecls('--text-min', (declaration) => {
          minimum = declaration.value;
        });
      }
    });
    expect(minimum).toBe('0.8125rem');
  });

  it('provides the spacing steps, 44px target, hairline border and sharp radii', () => {
    expect(tokens).toMatchObject({
      '--spacing-1': '0.25rem',
      '--spacing-2': '0.5rem',
      '--spacing-3': '0.75rem',
      '--spacing-4': '1rem',
      '--spacing-6': '1.5rem',
      '--spacing-8': '2rem',
      '--spacing-12': '3rem',
      '--spacing-16': '4rem',
      '--spacing-target': '2.75rem',
      '--border-width': '1px',
      '--radius-none': '0',
      '--radius-control': '2px',
    });
  });
});
