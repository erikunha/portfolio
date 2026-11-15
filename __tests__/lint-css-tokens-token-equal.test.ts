import { describe, expect, it } from 'vitest';
import { findTokenEqualArbitraryValues } from '../scripts/gates/lint-css-tokens';

const theme = [
  '@theme {',
  '  --tracking-xl: 0.2em;',
  '  --shadow-glow: 0 0 8px var(--color-primary-500);',
  '  --radius-control: 2px;',
  '  --spacing-gutter: 1.5rem;',
  '  --text-xs--line-height: 1rem;',
  '}',
].join('\n');

describe('findTokenEqualArbitraryValues', () => {
  it.each([
    ['tracking-[0.2em]', 'tracking-[0.2em]', 'tracking-xl'],
    [
      'shadow-[0_0_8px_var(--color-primary-500)]',
      'shadow-[0_0_8px_var(--color-primary-500)]',
      'shadow-glow',
    ],
    ['rounded-[2px]', 'rounded-[2px]', 'rounded-control'],
    ['a spacing utility', 'px-[1.5rem]', 'px-gutter'],
  ])('names the class and the token utility for %s', (_label, cls, utility) => {
    const source = `const a = <div className="flex ${cls}" />;`;
    expect(findTokenEqualArbitraryValues(theme, source)).toEqual([
      { line: 1, literal: cls, utility },
    ]);
  });

  it('keeps variants and reports the line of the hit', () => {
    const source = 'const a = 1;\nconst b = "md:hover:rounded-[2px] p-2";';
    expect(findTokenEqualArbitraryValues(theme, source)).toEqual([
      { line: 2, literal: 'rounded-[2px]', utility: 'rounded-control' },
    ]);
  });

  it('ignores an arbitrary value that no token equals', () => {
    const source = '"tracking-[0.21em] rounded-[3px] shadow-[0_0_9px_red]"';
    expect(findTokenEqualArbitraryValues(theme, source)).toEqual([]);
  });

  it('does not match a value from a different namespace', () => {
    expect(findTokenEqualArbitraryValues(theme, '"leading-[2px] tracking-[2px]"')).toEqual([]);
  });

  it('ignores a token that is a sub-property of another token', () => {
    expect(findTokenEqualArbitraryValues(theme, '"leading-[1rem]"')).toEqual([]);
  });

  it('ignores a class already using the token', () => {
    expect(findTokenEqualArbitraryValues(theme, '"tracking-xl rounded-control"')).toEqual([]);
  });

  it('ignores hits inside comments', () => {
    expect(findTokenEqualArbitraryValues(theme, '// tracking-[0.2em]\nconst a = 1;')).toEqual([]);
  });
});
