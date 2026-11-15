import { describe, expect, it } from 'vitest';
import { findUnusedThemeTokens } from '../scripts/gates/lint-css-tokens';

const theme = (body: string): string =>
  `@theme {\n${body}\n}\n@layer base { :root { margin: 0; } }`;

describe('findUnusedThemeTokens', () => {
  it('flags a token no source references', () => {
    expect(findUnusedThemeTokens(theme('  --phi-text-1: 1rem;'), ['a { color: red; }'])).toEqual([
      '--phi-text-1',
    ]);
  });

  it('counts a var() reference in any source as a consumer', () => {
    expect(findUnusedThemeTokens(theme('  --eq-gap: 1px;'), ['a { gap: var(--eq-gap); }'])).toEqual(
      [],
    );
  });

  it('counts a reference from another theme declaration', () => {
    const css = theme('  --text-min: 1rem;\n  --text-xs: var(--text-min);\n  --text-xs-x: 2px;');
    expect(findUnusedThemeTokens(css, ['<p className="text-xs" />'])).toEqual(['--text-xs-x']);
  });

  it('does not count the declaration itself as a consumer', () => {
    expect(findUnusedThemeTokens(theme('  --eq-gap: 1px;'), ['--eq-gap: 2px;'])).toEqual([
      '--eq-gap',
    ]);
  });

  it('does not treat a longer token name as a reference to a shorter one', () => {
    expect(findUnusedThemeTokens(theme('  --eq-gap: 1px;'), ['var(--eq-gap-compact)'])).toEqual([
      '--eq-gap',
    ]);
  });

  it.each([
    ['--color-brand', 'bg-brand'],
    ['--color-brand', 'hover:text-brand'],
    ['--color-brand', 'border-t-brand'],
    ['--leading-body', 'leading-body'],
    ['--radius-card', 'rounded-card'],
    ['--shadow-glow', 'shadow-glow'],
    ['--font-display', 'font-display'],
    ['--text-lg', 'text-lg'],
    ['--tracking-wide', 'md:tracking-wide'],
    ['--spacing-target', 'min-h-target'],
    ['--spacing-4', 'gap-x-4'],
    ['--breakpoint-guitar', 'guitar:flex'],
  ])('counts the utility derived from %s as a consumer (%s)', (token, utility) => {
    const source = `<div className="flex ${utility}" />`;
    expect(findUnusedThemeTokens(theme(`  ${token}: 1;`), [source])).toEqual([]);
  });

  it('does not match a utility prefix from the wrong namespace', () => {
    expect(findUnusedThemeTokens(theme('  --leading-body: 1.6;'), ['text-body'])).toEqual([
      '--leading-body',
    ]);
  });

  it('does not match a utility name that only contains the token name', () => {
    expect(findUnusedThemeTokens(theme('  --text-lg: 1rem;'), ['text-lgx', 'text-lg-foo'])).toEqual(
      ['--text-lg'],
    );
  });

  it('ignores declarations outside the @theme block', () => {
    const css = '@theme {\n  --eq-gap: 1px;\n}\n:root { --other: 1; }';
    expect(findUnusedThemeTokens(css, ['var(--eq-gap)'])).toEqual([]);
  });
});
