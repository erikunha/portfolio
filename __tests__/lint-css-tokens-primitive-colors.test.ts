import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { findPrimitiveColorUses, rolePrimitives, scanRepo } from '../scripts/gates/lint-css-tokens';

const THEME = `@theme {
  --color-signal-400: #4ade80;
  --color-signal-500: #00ff41;
  --color-carbon-950: #000000;
  --color-sage-50: #e6ffe6;
  --color-text: var(--color-sage-50);
}
@layer base {
  :root {
    --color-accent: var(--color-signal-500);
    --color-focus: var(--color-signal-500);
    --color-surface: var(--color-carbon-950);
    --color-rain-head: var(--color-signal-400);
  }
}`;

const literals = (source: string): string[] =>
  findPrimitiveColorUses(THEME, source).map((hit) => hit.literal);

describe('rolePrimitives', () => {
  it('maps each primitive a role aliases to the roles that alias it', () => {
    expect(Object.fromEntries(rolePrimitives(THEME))).toEqual({
      'signal-500': ['accent', 'focus'],
      'carbon-950': ['surface'],
      'sage-50': ['text'],
    });
  });

  it('ignores an alias that is not a role', () => {
    expect(rolePrimitives(THEME).has('signal-400')).toBe(false);
  });

  it('ignores a role that holds a literal value', () => {
    expect(rolePrimitives('@theme { --color-surface: #000000; }').size).toBe(0);
  });
});

describe('findPrimitiveColorUses', () => {
  it.each([
    [
      'a var() reference',
      'a { color: var(--color-signal-500); }',
      '--color-signal-500 (use --color-accent or --color-focus)',
    ],
    [
      'a property name in a string',
      "const P = '--color-carbon-950';",
      '--color-carbon-950 (use --color-surface)',
    ],
    [
      'a background utility',
      '<div className="bg-carbon-950" />',
      'bg-carbon-950 (use --color-surface)',
    ],
    [
      'a utility behind variants and an opacity modifier',
      '<a className="md:hover:text-sage-50/80" />',
      'text-sage-50 (use --color-text)',
    ],
    [
      'a side border utility',
      '<p className="border-t-signal-500" />',
      'border-t-signal-500 (use --color-accent or --color-focus)',
    ],
    [
      'a gradient stop',
      '<p className="from-signal-500" />',
      'from-signal-500 (use --color-accent or --color-focus)',
    ],
  ])('flags %s', (_name, source, literal) => {
    expect(literals(source)).toEqual([literal]);
  });

  it.each([
    ['a role var()', 'a { color: var(--color-accent); }'],
    ['a role utility', '<div className="bg-(color:--color-surface)" />'],
    ['a primitive no role aliases', 'a { color: var(--color-signal-400); }'],
    ['a primitive utility no role aliases', '<p className="text-signal-400" />'],
    ['a longer token name', 'a { color: var(--color-primary-500-soft); }'],
    ['a longer utility name', '<p className="bg-primary-5000" />'],
    ['a non-color utility', '<p className="w-signal-500" />'],
    ['a line comment', '// var(--color-signal-500) and bg-carbon-950'],
    ['a block comment', '/* var(--color-signal-500) */'],
  ])('ignores %s', (_name, source) => {
    expect(literals(source)).toEqual([]);
  });

  it('reports the line of each hit in order', () => {
    const source = ['a { }', 'b { color: var(--color-signal-500); }', 'c { }'].join('\n');
    expect(findPrimitiveColorUses(THEME, source).map((hit) => hit.line)).toEqual([2]);
  });

  it('flags nothing when the theme declares no role alias', () => {
    expect(
      findPrimitiveColorUses('@theme { --color-signal-500: #00ff41; }', 'bg-signal-500'),
    ).toEqual([]);
  });
});

describe('scanRepo primitive colors', () => {
  let root: string;
  const write = (file: string, body: string): void => {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), body);
  };

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'css-tokens-primitive-'));
    write('app/css/theme.css', THEME);
    write('app/css/base.css', 'a { color: var(--color-accent); }\n');
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('reports a primitive in a component stylesheet, a TSX file and an MDX page', () => {
    write('app/css/components-card.css', '.card { color: var(--color-signal-500); }\n');
    write('components/Card.tsx', 'export const C = () => <p className="bg-carbon-950" />;\n');
    write('app/page.mdx', '<div style={{ color: "var(--color-sage-50)" }} />\n');
    expect(
      scanRepo(root, ['base.css', 'components-card.css']).primitives.map(
        ({ file, line, literal }) => ({ file, line, literal }),
      ),
    ).toEqual([
      {
        file: 'app/css/components-card.css',
        line: 1,
        literal: '--color-signal-500 (use --color-accent or --color-focus)',
      },
      {
        file: 'app/page.mdx',
        line: 1,
        literal: '--color-sage-50 (use --color-text)',
      },
      {
        file: 'components/Card.tsx',
        line: 1,
        literal: 'bg-carbon-950 (use --color-surface)',
      },
    ]);
  });

  it('does not report theme.css, where the roles alias the primitives', () => {
    expect(scanRepo(root, ['base.css']).primitives).toEqual([]);
  });

  it('skips test files', () => {
    write('components/Card.test.tsx', 'const x = "var(--color-signal-500)";\n');
    expect(scanRepo(root, ['base.css']).primitives).toEqual([]);
  });
});
