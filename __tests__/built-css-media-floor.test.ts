// @vitest-environment node
import { readFileSync } from 'node:fs';
import path from 'node:path';
import tailwind from '@tailwindcss/postcss';
import postcss from 'postcss';
import { describe, expect, it } from 'vitest';

const ENTRYPOINTS = ['../app/globals.css', '../app/css/home.css'].map((entry) =>
  path.resolve(__dirname, entry),
);
const NESTED_NOT = /\(\s*not\s|\band\s+not\s*\(/;
const MEDIA_PRELUDE = /@media([^{]*)\{/g;
const COMPILE_TIMEOUT_MS = 120_000;

async function compiledCss(): Promise<string> {
  const sheets = await Promise.all(
    ENTRYPOINTS.map(async (entry) => {
      // behavioral-test-allow: compiles the shipped stylesheet entrypoints; jsdom cannot run the CSS build
      const source = readFileSync(entry, 'utf8');
      const result = await postcss([tailwind({ optimize: { minify: false } })]).process(source, {
        from: entry,
      });
      return result.css;
    }),
  );
  return sheets.join('\n');
}

describe('the compiled stylesheet and the browserslist floor', () => {
  it(
    'emits no media condition with a not inside parentheses, which Safari before 16.4 drops',
    async () => {
      const css = await compiledCss();
      const preludes = Array.from(css.matchAll(MEDIA_PRELUDE), (match) => match[1]?.trim() ?? '');
      expect(preludes.length, 'the compile produced no media queries').toBeGreaterThan(10);
      expect(
        preludes.filter((prelude) => NESTED_NOT.test(prelude)),
        'a width range joined to another media condition compiles to `(not (min-width: X))`; ' +
          'write the rule mobile-first with min-width and undo it at the next step instead',
      ).toEqual([]);
    },
    COMPILE_TIMEOUT_MS,
  );
});
