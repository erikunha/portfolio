import { readFileSync } from 'node:fs';
import postcss from 'postcss';
import { describe, expect, it } from 'vitest';
import {
  aliasTarget,
  displayTokenValue,
  getThemeColors,
  getThemeTokens,
  parseThemeColors,
  parseThemeTokens,
  tokensWithPrefix,
} from './theme-tokens';

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

  it('resolves a var(--color-x) alias to the value it points at, so swatches print the hex', () => {
    expect(
      parseThemeColors('--color-text: var(--color-sage-50); --color-sage-50: #e6ffe6;'),
    ).toEqual({ text: '#e6ffe6', 'sage-50': '#e6ffe6' });
  });

  it('resolves an alias of an alias whichever order the declarations come in', () => {
    expect(
      parseThemeColors(
        '--color-text: var(--color-sage-50); --color-sage-50: var(--color-base-50); --color-base-50: #e6ffe6;',
      ),
    ).toEqual({ text: '#e6ffe6', 'sage-50': '#e6ffe6', 'base-50': '#e6ffe6' });
  });

  it('keeps an alias whose target is missing, so the contrast check fails loudly on it', () => {
    expect(parseThemeColors('--color-text: var(--color-missing);')).toEqual({
      text: 'var(--color-missing)',
    });
  });
});

describe('terminal theme contract', () => {
  it('exposes the approved semantic text and emphasis roles without removing consumed shades', () => {
    expect(getThemeColors()).toMatchObject({
      text: '#e6ffe6',
      'text-secondary': '#a1b3a1',
      accent: '#00ff41',
      'carbon-950': '#000000',
      'signal-500': '#00ff41',
      'sage-50': '#e6ffe6',
      'signal-300': '#5ae07b',
      'signal-400': '#4ade80',
      'sage-400': '#8a9d8a',
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
      '--text-xs': 'var(--text-min)',
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

  it('holds the minimum text token at 13px at every width, phones included', () => {
    const overrides: string[] = [];
    theme.walkAtRules('media', (rule) => {
      rule.walkDecls('--text-min', (declaration) => {
        overrides.push(`${rule.params}: ${declaration.value}`);
      });
    });
    expect(tokens['--text-min']).toBe('0.8125rem');
    expect(overrides, 'no viewport may lower or move the 13px floor').toEqual([]);
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

const FIXTURE = [
  '@custom-variant motion-off (body[data-motion="reduce"] &);',
  '@theme {',
  '  --color-*: initial;',
  '  --text-min: 0.8125rem;',
  '  --text-xs: var(--text-min);',
  '  --spacing-1: 0.25rem;',
  '  --spacing-8: 2rem;',
  '  --spacing-12: 3rem;',
  '  --phi: 1.618;',
  '  --phi-space-1: 0.5rem;',
  '  --phi-space-2: calc(var(--phi-space-1) * var(--phi));',
  '  --phi-pair-columns: minmax(0, 1.618fr)',
  '    minmax(0, 1fr);',
  '  --tracking-xl: 0.1em;',
  '  --viewport-md: 768px;',
  '  --z-drawer: 130;',
  '  --radius-none: 0;',
  '}',
  '@layer base {',
  '  :root {',
  '    --space-section: var(--spacing-8);',
  '    --color-surface: var(--color-carbon-950);',
  '  }',
  '  @media (min-width: 768px) {',
  '    :root {',
  '      --space-section: var(--spacing-12);',
  '    }',
  '  }',
  '  /* --comment-only: 1px; */',
  '  @supports (line-height: round(nearest, 1px, 1px)) {',
  '    :root {',
  '      --text-xs--line-height: round(nearest, 1em, 1px);',
  '    }',
  '  }',
  '}',
].join('\n');

describe('parseThemeTokens', () => {
  const tokens = parseThemeTokens(FIXTURE);
  const find = (name: string, minWidth?: string) =>
    tokens.find((token) => token.name === name && token.minWidth === minWidth);

  it('reads every @theme declaration with its scope and joins a multi-line value', () => {
    expect(find('--spacing-1')).toEqual({ name: '--spacing-1', value: '0.25rem', scope: 'theme' });
    expect(find('--phi-pair-columns')?.value).toBe('minmax(0, 1.618fr) minmax(0, 1fr)');
    expect(find('--color-*')?.value).toBe('initial');
  });

  it('reads :root roles in the base layer and keeps the 768px override apart from the default', () => {
    expect(find('--space-section')).toMatchObject({ value: 'var(--spacing-8)', scope: 'root' });
    expect(find('--space-section', '768px')).toMatchObject({
      value: 'var(--spacing-12)',
      scope: 'root',
    });
  });

  it('skips @supports blocks and comments', () => {
    expect(tokens.map((token) => token.name)).not.toContain('--text-xs--line-height');
    expect(tokens.map((token) => token.name)).not.toContain('--comment-only');
  });

  it('selects a namespace by prefix without the media override', () => {
    expect(tokensWithPrefix(tokens, 'space-').map((token) => token.value)).toEqual([
      'var(--spacing-8)',
    ]);
    expect(tokensWithPrefix(tokens, 'spacing-', 'theme').map((token) => token.name)).toEqual([
      '--spacing-1',
      '--spacing-8',
      '--spacing-12',
    ]);
  });

  it.each([
    ['--spacing-1', '4px'],
    ['--text-xs', '13px'],
    ['--space-section', '32px'],
    ['--phi-space-2', '12.94px'],
    ['--tracking-xl', '0.1em'],
    ['--viewport-md', '768px'],
    ['--z-drawer', '130'],
    ['--radius-none', '0'],
    ['--phi-pair-columns', 'minmax(0, 1.618fr) minmax(0, 1fr)'],
  ])('shows %s as %s', (name, shown) => {
    const token = tokens.find((candidate) => candidate.name === name && !candidate.minWidth);
    expect(token && displayTokenValue(token, tokens)).toBe(shown);
  });

  it('names the primitive a role aliases', () => {
    expect(aliasTarget({ value: 'var(--color-carbon-950)' }, '--color-')).toBe('carbon-950');
    expect(aliasTarget({ value: '#000000' }, '--color-')).toBeUndefined();
  });
});

describe('theme.css as the source of the token pages', () => {
  const tokens = getThemeTokens();
  const shown = (name: string) => {
    const token = tokens.find((candidate) => candidate.name === name && !candidate.minWidth);
    return token && displayTokenValue(token, tokens);
  };

  it('resolves the spacing, type and role values the pages print', () => {
    expect(shown('--spacing-target')).toBe('44px');
    expect(shown('--text-xs')).toBe('13px');
    expect(shown('--text-7xl')).toBe('64px');
    expect(shown('--space-page-top')).toBe('32px');
    expect(shown('--z-skip-link')).toBe('9999');
  });

  it('finds every namespace the token pages render', () => {
    for (const prefix of ['text-', 'spacing-', 'tracking-', 'viewport-', 'z-', 'phi', 'radius-']) {
      expect(tokensWithPrefix(tokens, prefix).length, prefix).toBeGreaterThan(0);
    }
    expect(tokensWithPrefix(tokens, 'color-', 'root').length).toBeGreaterThanOrEqual(11);
  });
});
