import { describe, expect, it } from 'vitest';
import { parseThemeColors } from './theme-tokens';

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
