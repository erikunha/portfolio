import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { trackedFiles } from '../../scripts/lib/git';

const GEOMETRY_HELPER = 'tests/e2e/_helpers/geometry.ts';
const BROWSER_TEST_FILE = /^(?:tests\/.*\.ts|.*\.e2e\.ts)$/;
const WIDTH_LITERAL = /\bwidth:\s*\d{3,4}\b/;
const WIDTH_LIST_LITERAL = /\b[A-Z_]*(?:WIDTHS|VIEWPORTS)\s*=\s*\[\s*\d{3,4}\b/;

function literalWidthLines(file: string, source: string): string[] {
  return source
    .split('\n')
    .flatMap((line, index) =>
      WIDTH_LITERAL.test(line) || WIDTH_LIST_LITERAL.test(line)
        ? [`${file}:${index + 1}: ${line.trim()}`]
        : [],
    );
}

describe('literalWidthLines', () => {
  it('reports a numeric viewport width and a numeric width list', () => {
    const source = [
      'await page.setViewportSize({ width: 390, height: 844 });',
      'const WIDTHS = [320, 768];',
      'const STACKED_VIEWPORTS = [ 375 ];',
    ].join('\n');
    expect(literalWidthLines('a.spec.ts', source)).toEqual([
      'a.spec.ts:1: await page.setViewportSize({ width: 390, height: 844 });',
      'a.spec.ts:2: const WIDTHS = [320, 768];',
      'a.spec.ts:3: const STACKED_VIEWPORTS = [ 375 ];',
    ]);
  });

  it('accepts named widths, heights and non-viewport numbers', () => {
    const source = [
      'await page.setViewportSize({ width: WIDTH.PHONE, height: 844 });',
      'const WIDTHS = [WIDTH.PHONE_NARROW, WIDTH.DESKTOP];',
      'const ROW_VIEWPORTS = [{ width: WIDTH.TABLET, height: 1024 }];',
      'await runFor(600);',
    ].join('\n');
    expect(literalWidthLines('a.spec.ts', source)).toEqual([]);
  });
});

describe('browser test viewport widths', () => {
  it('come from the geometry helper, never a number in a spec', () => {
    const offenders = trackedFiles()
      .filter((file) => BROWSER_TEST_FILE.test(file) && file !== GEOMETRY_HELPER)
      .flatMap((file) => literalWidthLines(file, readFileSync(file, 'utf8')));
    expect(
      offenders,
      `name the width in ${GEOMETRY_HELPER} (WIDTH, a width set or VIEWPORTS) and import it`,
    ).toEqual([]);
  });
});
