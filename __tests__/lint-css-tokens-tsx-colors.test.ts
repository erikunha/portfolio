import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { findRawTsxColors, scanRepo } from '../scripts/gates/lint-css-tokens';

const literals = (source: string): string[] => findRawTsxColors(source).map((hit) => hit.literal);

describe('findRawTsxColors', () => {
  it.each([
    ['rgba(0, 0, 0, 0.5)', 'const s = { background: "rgba(0, 0, 0, 0.5)" };'],
    ['rgb(1 2 3)', 'const s = { color: `rgb(1 2 3)` };'],
    ['hsl(120 100% 50%)', 'const s = { color: "hsl(120 100% 50%)" };'],
    ['#abc', 'const s = { color: "#abc" };'],
    ['#00ff41', 'const s = { color: "#00ff41" };'],
    ['#00ff4180', 'const s = { color: "#00ff4180" };'],
    ['bg-black', '<div className="flex bg-black p-2" />'],
    ['text-white', '<p className="text-white" />'],
    ['border-white', '<p className="border-white" />'],
    ['bg-black/50', '<div className="bg-black/50" />'],
    ['hover:text-white', '<a className="hover:text-white" />'],
    ['md:hover:bg-black/20', '<a className="md:hover:bg-black/20" />'],
  ])('flags %s', (literal, source) => {
    expect(literals(source)).toEqual([literal]);
  });

  it.each([
    ['a token utility', '<div className="bg-signal-500 text-sage-50 border-signal-500" />'],
    ['a token reference', 'const s = { color: "var(--color-signal-500)" };'],
    ['a longer utility name', '<div className="bg-black-ish text-whitespace border-whiteout" />'],
    ['a non-color text utility', '<p className="text-lg text-center" />'],
    ['a fragment link', '<a href="#hero" />'],
    ['a line comment', '// rgba(0, 0, 0, 0.5) and bg-black'],
    ['a block comment', '/* #fff text-white */'],
  ])('ignores %s', (_name, source) => {
    expect(literals(source)).toEqual([]);
  });

  it('reports the line of each hit in order', () => {
    const source = ['const a = 1;', '<p className="text-white" />', 'const b = "#fff";'].join('\n');
    expect(findRawTsxColors(source)).toEqual([
      { line: 2, literal: 'text-white' },
      { line: 3, literal: '#fff' },
    ]);
  });
});

describe('scanRepo TSX colors', () => {
  let root: string;
  const write = (file: string, body: string): void => {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), body);
  };

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'css-tokens-tsx-'));
    write('app/css/base.css', 'a { color: var(--color-signal-500); }\n');
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('reports raw colors in app TSX with their file', () => {
    write('components/Card.tsx', 'export const C = () => <p className="text-white" />;\n');
    expect(scanRepo(root, ['base.css']).colors).toEqual([
      { file: 'components/Card.tsx', line: 1, literal: 'text-white' },
    ]);
  });

  it('skips test and e2e TSX files', () => {
    write('components/Card.test.tsx', 'const x = "#fff"; <p className="bg-black" />;\n');
    write('components/Card.e2e.tsx', 'const x = "rgba(0,0,0,1)";\n');
    expect(scanRepo(root, ['base.css']).colors).toEqual([]);
  });
});
