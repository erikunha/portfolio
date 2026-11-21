import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { findOrdinalPaletteNames, scanRepo } from '../scripts/gates/lint-css-tokens';

const REMOVED_FAMILIES = ['primary', 'secondary', 'tertiary', 'quinary', 'senary'] as const;
const HUE_OF: Record<(typeof REMOVED_FAMILIES)[number], string> = {
  primary: 'signal',
  secondary: 'carbon',
  tertiary: 'sage',
  quinary: 'gold',
  senary: 'coral',
};

const removed = (family: (typeof REMOVED_FAMILIES)[number], step: string): string =>
  [family, step].join('-');
const glowStop = (alpha: string): string => ['glow', alpha].join('-');
const bareGreen = ['--color', 'green'].join('-');

const literals = (source: string): string[] =>
  findOrdinalPaletteNames(source).map((hit) => hit.literal);

describe('findOrdinalPaletteNames', () => {
  it.each(REMOVED_FAMILIES)(
    'flags a var() read of a removed %s step and names its hue',
    (family) => {
      const hue = HUE_OF[family];
      expect(literals(`a { color: var(--color-${removed(family, '500')}); }`)).toEqual([
        `--color-${removed(family, '500')} (use --color-${hue}-500)`,
      ]);
    },
  );

  it.each(['subtle', 'border', 'faint', 'quiet'])('flags the %s alpha step', (step) => {
    expect(literals(`a { color: var(--color-${removed('primary', step)}); }`)).toEqual([
      `--color-${removed('primary', step)} (use --color-signal-${step})`,
    ]);
  });

  it('flags a declaration of a removed name', () => {
    expect(literals(`  --color-${removed('secondary', '950')}: #000000;`)).toEqual([
      `--color-${removed('secondary', '950')} (use --color-carbon-950)`,
    ]);
  });

  it.each([
    ['a plain utility', `<p className="text-${removed('tertiary', '50')}" />`, 'text-sage-50'],
    [
      'a variant and an opacity',
      `<p className="md:hover:bg-${removed('primary', '400')}/40" />`,
      'bg-signal-400',
    ],
    [
      'a side border utility',
      `<p className="border-t-${removed('quinary', '500')}" />`,
      'border-t-gold-500',
    ],
  ])('flags %s', (_name, source, hue) => {
    expect(literals(source)).toEqual([expect.stringContaining(`use ${hue}`)]);
  });

  it('flags a glow stop as a signal glow stop', () => {
    expect(literals(`a { color: var(--color-${glowStop('40')}); }`)).toEqual([
      `--color-${glowStop('40')} (use --color-signal-glow-40)`,
    ]);
    expect(literals(`<p className="bg-${glowStop('04')}" />`)).toEqual([
      `bg-${glowStop('04')} (use bg-signal-glow-04)`,
    ]);
  });

  it('flags the removed bare green token and points at the accent role', () => {
    expect(literals(`a { color: var(${bareGreen}); }`)).toEqual([
      `${bareGreen} (use --color-accent)`,
    ]);
  });

  it.each([
    ['a hue name', 'a { color: var(--color-signal-500); }'],
    ['a hue utility', '<p className="text-sage-50 bg-carbon-950" />'],
    ['a signal glow stop', 'a { color: var(--color-signal-glow-40); }'],
    ['the text-secondary role', '<p className="text-text-secondary" />'],
    ['a variant prop', '<Button variant="primary" size="secondary" />'],
    [
      'a class that only starts with the family',
      '<p className="btn-primary err-action-primary" />',
    ],
    ['a longer token name', `a { color: var(--color-${removed('primary', '500')}-soft); }`],
    ['a shadow token', 'a { box-shadow: var(--shadow-glow); }'],
    ['a line comment', `// var(--color-${removed('primary', '500')})`],
    ['a block comment', `/* var(--color-${removed('primary', '500')}) */`],
  ])('ignores %s', (_name, source) => {
    expect(literals(source)).toEqual([]);
  });

  it('reports the line of each hit', () => {
    const source = ['a { }', `b { color: var(--color-${removed('senary', '300')}); }`].join('\n');
    expect(findOrdinalPaletteNames(source).map((hit) => hit.line)).toEqual([2]);
  });
});

describe('scanRepo ordinal palette names', () => {
  let root: string;
  const write = (file: string, body: string): void => {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), body);
  };

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'css-tokens-ordinal-'));
    write('app/css/theme.css', '@theme {\n  --color-signal-500: #00ff41;\n}\n');
    write('app/css/base.css', 'a { color: var(--color-signal-500); }\n');
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('reports a removed name in theme.css, a stylesheet, a TSX file and an MDX page', () => {
    write('app/css/theme.css', `@theme {\n  --color-${removed('primary', '500')}: #00ff41;\n}\n`);
    write(
      'app/css/components-card.css',
      `.card { color: var(--color-${removed('tertiary', '50')}); }\n`,
    );
    write(
      'components/Card.tsx',
      `export const C = () => <p className="text-${removed('senary', '300')}" />;\n`,
    );
    write('app/page.mdx', `<div style={{ color: "var(--color-${glowStop('06')})" }} />\n`);
    expect(
      scanRepo(root, ['base.css', 'components-card.css']).ordinals.map(({ file, line }) => ({
        file,
        line,
      })),
    ).toEqual([
      { file: 'app/css/components-card.css', line: 1 },
      { file: 'app/css/theme.css', line: 2 },
      { file: 'app/page.mdx', line: 1 },
      { file: 'components/Card.tsx', line: 1 },
    ]);
  });

  it('reports nothing for a repository on the hue names', () => {
    expect(scanRepo(root, ['base.css']).ordinals).toEqual([]);
  });

  it('skips test files', () => {
    write('components/Card.test.tsx', `const x = "var(--color-${removed('primary', '500')})";\n`);
    expect(scanRepo(root, ['base.css']).ordinals).toEqual([]);
  });
});
