import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import postcss from 'postcss';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '../..');
const PARTIAL_DIR = path.join(ROOT, 'app/css');
const COMPONENT_DIR = path.join(ROOT, 'design-system/components');
const OVERRIDE_LAYER_SHEETS = new Set(['forced-colors.css', 'print.css']);
const CLASS_TOKEN = /\.[\w-]+/g;
const KEYFRAMES = /keyframes$/;

const PRIMITIVES = [
  { name: 'Button', className: '.btn' },
  { name: 'KbdKey', className: '.kbd-key' },
];

function selectorsOf(file: string): string[] {
  // behavioral-test-allow: reads shipped stylesheets to check which file owns a selector; jsdom cannot evaluate where a rule lives
  const source = readFileSync(file, 'utf-8');
  const selectors: string[] = [];
  postcss.parse(source).walkRules((rule) => {
    const parent = rule.parent;
    if (parent?.type === 'atrule' && KEYFRAMES.test((parent as postcss.AtRule).name)) return;
    selectors.push(...rule.selectors);
  });
  return selectors;
}

function classesOf(selector: string): string[] {
  return selector.match(CLASS_TOKEN) ?? [];
}

function onlyStylesPrimitive(selector: string, className: string): boolean {
  const classes = classesOf(selector);
  return classes.length > 0 && classes.every((token) => token === className);
}

const partials = readdirSync(PARTIAL_DIR)
  .filter((file) => file.endsWith('.css') && !OVERRIDE_LAYER_SHEETS.has(file))
  .sort();

describe.each(PRIMITIVES)('$name stylesheet colocation', ({ name, className }) => {
  const ownFile = path.join(COMPONENT_DIR, name, `${name}.css`);

  it('holds the base rules in its own stylesheet', () => {
    const own = selectorsOf(ownFile);
    expect(own.some((selector) => onlyStylesPrimitive(selector, className))).toBe(true);
  });

  it('holds no selector that names another component', () => {
    const foreign = selectorsOf(ownFile).filter(
      (selector) => !classesOf(selector).includes(className),
    );
    expect(foreign).toEqual([]);
  });

  it.each(partials)('leaves no rule in app/css/%s that styles only the primitive', (partial) => {
    const stray = selectorsOf(path.join(PARTIAL_DIR, partial)).filter((selector) =>
      onlyStylesPrimitive(selector, className),
    );
    expect(stray).toEqual([]);
  });
});
