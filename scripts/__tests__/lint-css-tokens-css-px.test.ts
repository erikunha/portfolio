import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { findRawCssPx, listScannedCss, scanRepo } from '../gates/lint-css-tokens';

const literals = (css: string): string[] => findRawCssPx(css).map((hit) => hit.literal);

describe('findRawCssPx', () => {
  it.each([
    ['width: 9px', '.a { width: 9px; }'],
    ['padding: 6px 18px 8px', '.a { padding: 6px 18px 8px; }'],
    ['box-shadow: 0 0 4px var(--color-accent)', '.a { box-shadow: 0 0 4px var(--color-accent); }'],
    ['transform: translate(2px, -2px)', '.a { transform: translate(2px, -2px); }'],
    ['--module-estimate: 520px', '.a { --module-estimate: 520px; }'],
    ['width: var(--dot, 6px)', '.a { width: var(--dot, 6px); }'],
    ['stroke-width: 1.5px', '.a { stroke-width: 1.5px; }'],
    ['top: calc(100cqh + 60px)', '.a { top: calc(100cqh + 60px); }'],
    ['border: 2px solid red', '.a { border: 2px solid red; }'],
    ['border: 1px solid var(--color-border)', '.a { border: 1px solid var(--color-border); }'],
    ['border-block-start: 1px dashed red', '.a { border-block-start: 1px dashed red; }'],
    ['outline: 1px solid red', '.a { outline: 1px solid red; }'],
    ['border-top-width: 1px', '.a { border-top-width: 1px; }'],
    ['margin: 2px', '@layer components { @media (min-width: 40rem) { .a { margin: 2px; } } }'],
  ])('flags %s', (literal, css) => {
    expect(literals(css)).toEqual([literal]);
  });

  it.each([
    ['a rem size', '.a { width: 0.5625rem; }'],
    ['a token', '.a { padding: var(--spacing-panel) var(--spacing-inset); }'],
    ['a border token', '.a { border: var(--border-width) solid var(--color-border); }'],
    ['a zero px length', '.a { inset-block: min(0px, calc((100% - 1rem) / 2)); }'],
    ['a one px outline offset', '.a { outline-offset: -1px; }'],
    ['a one px vertical offset', '.a { vertical-align: 1px; }'],
    ['a one px gap and padding', '.a { gap: 1px; padding: 1px; }'],
    ['a one px gradient stop', '.a { background: linear-gradient(red 0 1px, blue 1px 1px); }'],
    ['a one px box-shadow ring', '.a { box-shadow: 0 0 0 1px var(--color-border); }'],
    ['a one px rounding step', '.a { line-height: round(nearest, 1em, 1px); }'],
    ['a px inside a comment', '.a { /* 9px */ width: 1rem; }'],
    ['a px inside a string', '.a { content: "9px"; }'],
    ['an identifier ending in px', '.a { grid-area: col-9px; }'],
    [
      'a supports query',
      '@supports (line-height: round(nearest, 9px, 1px)) { .a { width: 1rem; } }',
    ],
    ['a rem media query', '@media (min-width: 48rem) { .a { width: 1rem; } }'],
  ])('allows %s', (_name, css) => {
    expect(literals(css)).toEqual([]);
  });

  it('flags a px width in a media or container query', () => {
    expect(literals('@media (min-width: 700px) { .a { width: 1rem; } }')).toEqual([
      '@media (min-width: 700px)',
    ]);
    expect(literals('@container (min-width: 320px) { .a { width: 1rem; } }')).toEqual([
      '@container (min-width: 320px)',
    ]);
  });

  it('reports the line of each hit', () => {
    expect(findRawCssPx('.a {\n  width: 9px;\n  height: 5px;\n}')).toEqual([
      { line: 2, literal: 'width: 9px' },
      { line: 3, literal: 'height: 5px' },
    ]);
  });
});

describe('scanRepo css px lengths', () => {
  let root: string;
  const write = (rel: string, content: string): void => {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), content);
  };

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'css-px-scan-'));
    write('app/css/theme.css', '@theme { --spacing-pip: 0.375rem; --border-width: 1px; }');
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('reports a px length in a sheet and never in theme.css', () => {
    write('app/css/card.css', '.a { gap: 9px; }');
    write('app/css/clean.css', '.a { gap: var(--spacing-label); }');
    const scan = scanRepo(root, ['card.css', 'clean.css']);
    expect(scan.cssPx.map((hit) => `${hit.file}:${hit.line}`)).toEqual(['app/css/card.css:1']);
  });
});

describe('the repository against the css px rule', () => {
  it('has no px length in any stylesheet but a 1px hairline or 0px', () => {
    const hits = scanRepo(process.cwd(), listScannedCss(process.cwd())).cssPx.map(
      (hit) => `${hit.file}:${hit.line} ${hit.literal}`,
    );
    expect(hits).toEqual([]);
  });
});
