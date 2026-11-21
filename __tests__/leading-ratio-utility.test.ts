// @vitest-environment node
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import tailwind from '@tailwindcss/postcss';
import postcss, { AtRule, type Node, type Root, type Rule } from 'postcss';
import { describe, expect, it } from 'vitest';

const APP_DIR = path.resolve(__dirname, '../app');
const THEME_CSS = path.join(APP_DIR, 'css/theme.css');
const UTILITIES_CSS = path.join(APP_DIR, 'css/components-utilities.css');
const MD_QUERY = /\(width >= 48rem\)|\(min-width: 768px\)/;
const ROUNDING_SUPPORT = '(line-height: round(nearest, 1px, 1px))';
const PLAIN = '';
const RATIOS: Record<string, string> = {
  '1': '1',
  '1-1': '1.1',
  '1-15': '1.15',
  '1-3': '1.3',
  '1-4': '1.4',
  '1-55': '1.55',
  '1-8': '1.8',
  tight: '1.25',
  body: 'var(--leading-body)',
};
const ROUNDED_LINE_HEIGHT = 'round(nearest, 1em * var(--leading), 1px)';

type Context = { media: string | null; supports: string | null };

async function compile(markup: string): Promise<Root> {
  const dir = mkdtempSync(path.join(tmpdir(), 'leading-ratio-'));
  writeFileSync(path.join(dir, 'probe.html'), markup);
  const source = `@import "tailwindcss"; @import "${THEME_CSS}"; @import "${UTILITIES_CSS}";`;
  const from = path.join(APP_DIR, 'probe.css');
  const result = await postcss([tailwind({ base: dir })]).process(source, { from });
  return postcss.parse(result.css);
}

function contextOf(rule: Rule): Context {
  const context: Context = { media: null, supports: null };
  for (let parent: Node | undefined = rule.parent; parent; parent = parent.parent) {
    if (!(parent instanceof AtRule)) continue;
    if (parent.name === 'media') context.media = parent.params;
    if (parent.name === 'supports') context.supports = parent.params;
  }
  return context;
}

function declarationsOf(
  root: Root,
  className: string,
  media: RegExp | null,
): Record<string, string> {
  const selector = `.${className.replace(':', '\\:')}`;
  const owns = (entry: string) =>
    entry.startsWith(selector) && !/^[\w-]/.test(entry.slice(selector.length));
  const found: Record<string, string> = {};
  const collect = (owner: Rule | AtRule, supports: string | null) => {
    owner.each((node) => {
      if (node.type === 'decl') found[`${supports ?? PLAIN}|${node.prop}`] = node.value;
      if (node.type === 'atrule' && node.name === 'supports') collect(node, node.params);
    });
  };
  root.walkRules((rule) => {
    if (!rule.selectors.some(owns)) return;
    const context = contextOf(rule);
    const mediaMatches = media === null ? context.media === null : media.test(context.media ?? '');
    if (mediaMatches) collect(rule, context.supports);
  });
  return found;
}

describe('leading-ratio utilities', () => {
  const classes = Object.keys(RATIOS).map((key) => `leading-ratio-${key}`);
  const markup = [...classes, ...classes.map((name) => `md:${name}`)].join(' ');

  it.each(Object.entries(RATIOS))(
    'compiles leading-ratio-%s to its ratio, the ratio as line-height and a rounded line-height',
    async (key, ratio) => {
      const root = await compile(markup);
      expect(declarationsOf(root, `leading-ratio-${key}`, null)).toEqual({
        [`${PLAIN}|--leading`]: ratio,
        [`${PLAIN}|line-height`]: 'var(--leading)',
        [`${ROUNDING_SUPPORT}|line-height`]: ROUNDED_LINE_HEIGHT,
      });
    },
  );

  it('compiles md:leading-ratio-1-3 to the same declarations as leading-ratio-1-3', async () => {
    const root = await compile(markup);
    const base = declarationsOf(root, 'leading-ratio-1-3', null);
    expect(Object.keys(base)).not.toEqual([]);
    expect(declarationsOf(root, 'md:leading-ratio-1-3', MD_QUERY)).toEqual(base);
  });

  it('writes the class on its selector twice, so it outranks a font-size utility whatever the order', async () => {
    const root = await compile('leading-ratio-1-1 text-xs max-md:text-sm');
    const selectors: string[] = [];
    root.walkRules((rule) => {
      for (const entry of rule.selectors) {
        if (
          entry.startsWith('.leading-ratio-1-1') &&
          !/^[\w-]/.test(entry.slice('.leading-ratio-1-1'.length))
        ) {
          selectors.push(entry);
        }
      }
    });
    expect(selectors.length).toBeGreaterThan(0);
    for (const selector of selectors) {
      expect(selector.match(/\.leading-ratio-1-1/g)).toHaveLength(2);
    }
  });
});
