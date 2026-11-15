// @vitest-environment node
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import tailwind from '@tailwindcss/postcss';
import postcss, { type Root, type Rule } from 'postcss';
import { describe, expect, it } from 'vitest';

const APP_DIR = path.resolve(__dirname, '../app');
const THEME_CSS = path.join(APP_DIR, 'css/theme.css');
const GLOBALS_CSS = path.join(APP_DIR, 'globals.css');
const MOTION_OFF_SELECTOR = 'body[data-motion="reduce"] .motion-off\\:transition-none';
const MOTION_ON_SELECTOR = 'body:not([data-motion="reduce"]) .motion-on\\:opacity-100';
const PARTIAL_SELECTOR = 'body[data-motion="reduce"] .probe';
const REVEAL_SELECTOR = 'html.type-reveal-ready body:not([data-motion="reduce"]) .probe';

async function compile(markup: string, source: (dir: string) => string): Promise<Root> {
  const dir = mkdtempSync(path.join(tmpdir(), 'motion-variant-'));
  writeFileSync(path.join(dir, 'probe.html'), markup);
  const from = path.join(APP_DIR, 'probe.css');
  const result = await postcss([tailwind({ base: dir })]).process(source(dir), { from });
  return postcss.parse(result.css);
}

function declarations(root: Root, selector: string): Record<string, string> {
  const found: Record<string, string> = {};
  root.walkRules((rule: Rule) => {
    if (!rule.selectors.map((entry) => entry.replace(/\s+/g, ' ')).includes(selector)) return;
    rule.each((node) => {
      if (node.type === 'decl') found[node.prop] = node.value;
    });
  });
  return found;
}

function selectors(root: Root): string[] {
  const found: string[] = [];
  root.walkRules((rule: Rule) => {
    found.push(...rule.selectors.map((entry) => entry.replace(/\s+/g, ' ')));
  });
  return found;
}

describe('motion variants', () => {
  it('resolves motion-off under the MOTION switch selector', async () => {
    const root = await compile(
      '<div class="motion-off:transition-none">',
      () => `@import "tailwindcss"; @import "${THEME_CSS}";`,
    );
    expect(declarations(root, MOTION_OFF_SELECTOR)).toEqual({ 'transition-property': 'none' });
  });

  it('resolves motion-on under the inverse of the MOTION switch selector', async () => {
    const root = await compile(
      '<div class="motion-on:opacity-100">',
      () => `@import "tailwindcss"; @import "${THEME_CSS}";`,
    );
    expect(declarations(root, MOTION_ON_SELECTOR)).toEqual({ opacity: '100%' });
  });

  it('lets an imported partial write @variant motion-off after theme.css', async () => {
    const root = await compile('<div class="probe">', (dir) => {
      const partial = path.join(dir, 'partial.css');
      writeFileSync(partial, '.probe { @variant motion-off { transition: none; } }\n');
      return `@import "tailwindcss"; @import "${THEME_CSS}"; @import "${partial}";`;
    });
    expect(declarations(root, PARTIAL_SELECTOR)).toEqual({ transition: 'none' });
  });

  it('lets a @reference partial write @variant motion-off without emitting the global sheet again', async () => {
    const root = await compile('<div class="probe">', (dir) => {
      const partial = path.join(dir, 'partial.css');
      writeFileSync(
        partial,
        `@reference "${GLOBALS_CSS}";\n.probe { @variant motion-off { transition: none; } }\n`,
      );
      return `@import "${partial}";`;
    });
    expect(declarations(root, PARTIAL_SELECTOR)).toEqual({ transition: 'none' });
    expect(selectors(root)).toEqual([PARTIAL_SELECTOR]);
  });

  it('resolves reveal-motion-on under the type reveal ready and MOTION on ancestors', async () => {
    const root = await compile('<div class="probe">', (dir) => {
      const partial = path.join(dir, 'partial.css');
      writeFileSync(
        partial,
        `@reference "${GLOBALS_CSS}";\n.probe { @variant reveal-motion-on { opacity: 1; } }\n`,
      );
      return `@import "${partial}";`;
    });
    expect(declarations(root, REVEAL_SELECTOR)).toEqual({ opacity: '1' });
  });
});
