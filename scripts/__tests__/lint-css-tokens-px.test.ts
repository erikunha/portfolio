import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  type AllowEntry,
  findArbitraryPxSizes,
  listScannedCss,
  scanRepo,
} from '../gates/lint-css-tokens';

const literals = (source: string): string[] =>
  findArbitraryPxSizes(source).map((hit) => hit.literal);

describe('findArbitraryPxSizes', () => {
  it.each([
    ['gap-[9px]', '<div className="gap-[9px]" />'],
    ['px-[10px]', "const c = cn('flex', 'px-[10px]');"],
    ['[&_svg]:w-[18px]', '<span className="[&_svg]:w-[18px] stroke-current" />'],
    ['@md:px-[18px]', '<div className="@md:px-[18px]" />'],
    ['md:hover:rounded-[2px]', '<a className={`md:hover:rounded-[2px]`} />'],
    ['-mt-[3px]', '<a className="-mt-[3px]" />'],
    ['w-[0.5px]', '<a className="w-[0.5px]" />'],
    ['text-[11px]', '<a className="text-[11px]" />'],
    ['min-w-[32px]', 'const c = "min-w-[32px]";'],
  ])('flags %s', (literal, source) => {
    expect(literals(source)).toEqual([literal]);
  });

  it.each([
    ['a token utility', '<div className="gap-pip px-inset" />'],
    ['a theme step', '<div className="gap-2 py-px" />'],
    ['a rem arbitrary value', '<div className="gap-[0.5rem]" />'],
    ['a fallback inside var()', '<div className="px-[var(--stat-tile-pad-x,10px)]" />'],
    ['a calc expression', '<div className="h-[calc(100%-6px)]" />'],
    ['a percentage', '<div className="w-[30%]" />'],
    ['a bracket selector', '<div className="[&_svg]:fill-none [&>li]:p-2" />'],
    ['a comment', '// gap-[9px] was removed'],
  ])('allows %s', (_name, source) => {
    expect(literals(source)).toEqual([]);
  });

  it('reports the line of each hit', () => {
    expect(findArbitraryPxSizes('a\n<div className="gap-[9px] p-[14px]" />')).toEqual([
      { line: 2, literal: 'gap-[9px]' },
      { line: 2, literal: 'p-[14px]' },
    ]);
  });
});

describe('scanRepo arbitrary px sizes', () => {
  let root: string;
  const write = (rel: string, content: string): void => {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), content);
  };

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'px-scan-'));
    write('app/css/theme.css', '@theme { --spacing-pip: 0.375rem; }');
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('reports a px size in tsx and ts and passes the token form, tests and css', () => {
    write('components/Bad.tsx', '<div className="gap-[9px]" />');
    write('lib/bad.ts', "export const c = 'h-[6px]';");
    write('components/Ok.tsx', '<div className="gap-pip" />');
    write('components/Bad.test.tsx', '<div className="gap-[9px]" />');
    write('app/css/card.css', '.a { gap: 9px; }');
    const hits = scanRepo(root, ['card.css']).pxSizes.map((hit) => `${hit.file}:${hit.line}`);
    expect(hits.sort()).toEqual(['components/Bad.tsx:1', 'lib/bad.ts:1']);
  });
});

describe('the repository against the px size rule', () => {
  it('has no arbitrary px size in a TS or TSX source file', () => {
    const hits = scanRepo(process.cwd(), listScannedCss(process.cwd())).pxSizes.map(
      (hit) => `${hit.file}:${hit.line} ${hit.literal}`,
    );
    expect(hits).toEqual([]);
  });

  it('keeps the allowlist empty', () => {
    const allowlistPath = join(process.cwd(), 'scripts/gates/lint-css-tokens.allowlist.json');
    // behavioral-test-allow: the allowlist is a shipped file and the rule is that it stays empty
    const allowlistText = readFileSync(allowlistPath, 'utf8');
    const allowlist = JSON.parse(allowlistText) as AllowEntry[];
    expect(allowlist).toEqual([]);
  });
});
