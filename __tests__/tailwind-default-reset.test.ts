// @vitest-environment node
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import tailwind from '@tailwindcss/postcss';
import postcss from 'postcss';
import { beforeAll, describe, expect, it } from 'vitest';

const APP_DIR = path.resolve(__dirname, '../app');
const THEME_CSS = path.join(APP_DIR, 'css/theme.css');

const DEFAULT_SCALE_CLASSES = [
  'bg-red-500',
  'text-blue-500',
  'border-gray-200',
  'fill-green-600',
  'ring-slate-300',
  'rounded-lg',
  'rounded-md',
  'rounded-xl',
  'rounded',
  'rounded-t',
  'shadow',
  'shadow-md',
  'shadow-lg',
  'shadow-sm',
];

const PROJECT_CLASSES = [
  'bg-primary-500',
  'text-text',
  'border-primary-border',
  'rounded-control',
  'rounded-none',
  'rounded-full',
  'shadow-glow',
  'text-sm',
  'p-4',
];

function escapeClass(name: string): string {
  return name.replace(/[/]/g, '\\/');
}

async function compile(classes: string[]): Promise<string> {
  const dir = mkdtempSync(path.join(tmpdir(), 'default-reset-'));
  writeFileSync(path.join(dir, 'probe.html'), `<div class="${classes.join(' ')}"></div>`);
  const source = `@import "tailwindcss"; @import "${THEME_CSS}";`;
  const from = path.join(APP_DIR, 'probe.css');
  const result = await postcss([tailwind({ base: dir })]).process(source, { from });
  return result.css;
}

function hasRule(css: string, name: string): boolean {
  return css.includes(`.${escapeClass(name)} {`);
}

describe('Tailwind default palette, radius and shadow scales', () => {
  let css: string;

  beforeAll(async () => {
    css = await compile([...DEFAULT_SCALE_CLASSES, ...PROJECT_CLASSES]);
  });

  it.each(DEFAULT_SCALE_CLASSES)('%s compiles to nothing', (name) => {
    expect(hasRule(css, name)).toBe(false);
  });

  it.each(PROJECT_CLASSES)('%s still compiles', (name) => {
    expect(hasRule(css, name)).toBe(true);
  });

  it('keeps currentColor, transparent and inherit keyword utilities', async () => {
    const keywords = await compile(['bg-transparent', 'text-current', 'border-inherit']);
    expect(hasRule(keywords, 'bg-transparent')).toBe(true);
    expect(hasRule(keywords, 'text-current')).toBe(true);
    expect(hasRule(keywords, 'border-inherit')).toBe(true);
  });
});
