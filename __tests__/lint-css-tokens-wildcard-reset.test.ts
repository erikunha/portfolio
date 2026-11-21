import { describe, expect, it } from 'vitest';
import { findUnusedThemeTokens } from '../scripts/gates/lint-css-tokens';

const theme = (body: string): string =>
  `@theme {\n${body}\n}\n@layer base { :root { margin: 0; } }`;

describe('findUnusedThemeTokens with a namespace reset', () => {
  it('accepts a wildcard reset with no consumer', () => {
    const css = theme('  --color-*: initial;\n  --radius-*: initial;\n  --shadow-*: initial;');
    expect(findUnusedThemeTokens(css, ['a { margin: 0; }'])).toEqual([]);
  });

  it('still reports a named unused token beside the resets', () => {
    const css = theme('  --radius-*: initial;\n  --phi-text-1: 1rem;');
    expect(findUnusedThemeTokens(css, ['a { margin: 0; }'])).toEqual(['--phi-text-1']);
  });

  it('still reports a wildcard declaration that is not a reset', () => {
    expect(findUnusedThemeTokens(theme('  --foo-*: 1px;'), ['a { margin: 0; }'])).toEqual([
      '--foo-*',
    ]);
  });
});
