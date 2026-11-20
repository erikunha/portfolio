import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  findAlphaUtilities,
  findInlineColorMix,
  findNonPropertyColorMix,
  scanRepo,
} from '../gates/lint-css-tokens';

const alpha = (source: string): string[] => findAlphaUtilities(source).map((hit) => hit.literal);
const cssMix = (source: string): string[] =>
  findNonPropertyColorMix(source).map((hit) => hit.literal);

describe('findAlphaUtilities', () => {
  it.each([
    ['bg-signal/10', '<div className="bg-signal/10" />'],
    ['bg-(color:--color-surface)/50', '<div className="bg-(color:--color-surface)/50" />'],
    ['bg-[var(--x)]/[0.07]', '<div className="p-2 bg-[var(--x)]/[0.07]" />'],
    ['text-accent/60', "const c = cn('text-accent/60');"],
    ['border-border/30', '<div className={`border-border/30`} />'],
    ['md:hover:ring-signal-500/20', '<a className="md:hover:ring-signal-500/20" />'],
    ['from-surface/80', '<div className="from-surface/80" />'],
  ])('flags %s', (literal, source) => {
    expect(alpha(source)).toEqual([literal]);
  });

  it.each([
    ['an opacity utility', '<div className="opacity-50 bg-signal-500" />'],
    ['a plain token utility', '<div className="bg-(color:--color-accent-tint-soft)" />'],
    ['a line-height shorthand', '<p className="text-sm/6 text-xs/[1.5] text-2xl/8" />'],
    ['a spacing fraction', '<div className="w-1/2 basis-1/3 h-[calc(100%/3)]" />'],
    ['the transparent keyword', '<div className="bg-transparent border-transparent" />'],
    ['a path in a string', "const p = '/api/bg/10';"],
    ['a comment', '// bg-signal/10 was removed'],
  ])('allows %s', (_name, source) => {
    expect(alpha(source)).toEqual([]);
  });

  it('reports the line of the hit', () => {
    expect(findAlphaUtilities('a\n<div className="bg-signal/10" />')).toEqual([
      { line: 2, literal: 'bg-signal/10' },
    ]);
  });
});

describe('findNonPropertyColorMix', () => {
  it.each([
    [
      'background: color-mix(in srgb, var(--color-accent) 8%, transparent)',
      '.a { background: color-mix(in srgb, var(--color-accent) 8%, transparent); }',
    ],
    [
      'border-color: color-mix(in oklab, var(--color-surface) 50%, transparent)',
      '.a { border-color: color-mix(in oklab, var(--color-surface) 50%, transparent); }',
    ],
    [
      'box-shadow: 0 0 4px color-mix(in srgb, var(--color-accent) 30%, transparent)',
      '.a { box-shadow: 0 0 4px color-mix(in srgb, var(--color-accent) 30%, transparent); }',
    ],
  ])('flags %s', (literal, source) => {
    expect(cssMix(source)).toEqual([literal]);
  });

  it.each([
    [
      'a global role tint',
      '@theme { --color-accent-tint-soft: color-mix(in srgb, var(--color-accent) 8%, transparent); }',
    ],
    [
      'a rule custom property',
      '.a { --a-fill: color-mix(in srgb, var(--color-accent) 5%, transparent); }',
    ],
    [
      'a custom property inside a media query',
      '@media (min-width: 40rem) { .a { --a-fill: color-mix(in srgb, var(--color-text) 85%, transparent); } }',
    ],
    ['a custom property read', '.a { background: var(--a-fill); }'],
    ['the transparent keyword', '.a { background: transparent; border-color: transparent; }'],
    ['a comment', '/* background: color-mix(in srgb, red 5%, transparent); */ .a { color: red; }'],
  ])('allows %s', (_name, source) => {
    expect(cssMix(source)).toEqual([]);
  });

  it('reports the line of the hit', () => {
    const css = '.a {\n  color: red;\n  background: color-mix(in srgb, red 5%, transparent);\n}';
    expect(findNonPropertyColorMix(css).map((hit) => hit.line)).toEqual([3]);
  });
});

describe('findInlineColorMix', () => {
  it.each([
    [
      'color-mix(in srgb, var(--color-accent) 8%, transparent)',
      '<div className="bg-[color-mix(in_srgb,var(--color-accent)_8%,transparent)]" />',
    ],
    [
      'color-mix(in srgb, red 5%, transparent)',
      'const s = { background: "color-mix(in srgb, red 5%, transparent)" };',
    ],
  ])('flags %s', (_literal, source) => {
    expect(findInlineColorMix(source)).toHaveLength(1);
  });

  it.each([
    [
      'a custom property name containing mix',
      '<div className="bg-(color:--color-mixer-row-tint)" />',
    ],
    ['a comment', '// color-mix(in srgb, red 5%, transparent)'],
  ])('allows %s', (_name, source) => {
    expect(findInlineColorMix(source)).toEqual([]);
  });
});

describe('scanRepo tints', () => {
  let root: string;
  const write = (rel: string, content: string): void => {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), content);
  };

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'tint-scan-'));
    write(
      'app/css/theme.css',
      '@theme { --color-accent: red; --color-accent-tint-soft: color-mix(in srgb, var(--color-accent) 8%, transparent); }',
    );
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('reports a bad tint in css, tsx and ts and passes the allowed forms', () => {
    write('app/css/card.css', '.a { --a-fill: color-mix(in srgb, red 5%, transparent); }');
    write('app/css/bad.css', '.b { background: color-mix(in srgb, red 5%, transparent); }');
    write('components/Ok.tsx', '<div className="bg-(color:--color-accent-tint-soft)" />');
    write('components/Alpha.tsx', '<div className="bg-signal/10" />');
    write('lib/mix.ts', "export const c = 'bg-[color-mix(in_srgb,red_5%,transparent)]';");
    const tints = scanRepo(root, ['card.css', 'bad.css']).tints.map(
      (hit) => `${hit.file}:${hit.line}`,
    );
    expect(tints.sort()).toEqual(['app/css/bad.css:1', 'components/Alpha.tsx:1', 'lib/mix.ts:1']);
  });
});
