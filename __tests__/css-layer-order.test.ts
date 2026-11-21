// @vitest-environment node
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import tailwind from '@tailwindcss/postcss';
import postcss, {
  AtRule,
  type ChildNode,
  type Declaration,
  type Node,
  type Root,
  type Rule,
} from 'postcss';
import { describe, expect, it } from 'vitest';

const APP_DIR = path.resolve(__dirname, '../app');
const GLOBALS_CSS = path.join(APP_DIR, 'globals.css');
const HOME_CSS = path.join(APP_DIR, 'css/home.css');
const OVERRIDES = 'overrides';
const LAYER_ORDER = ['theme', 'base', 'components', 'utilities', OVERRIDES];
const FORCED_COLORS = /forced-colors/;
const PRINT = /^print$/;
const FORCED_ONLY_SELECTOR = 'canvas[aria-hidden]';
const PRINT_CHROME_SELECTOR = '.dock';
const INLINE_DISPLAY_SELECTOR = 'body > canvas';

async function compile(entry: string): Promise<Root> {
  const emptyBase = mkdtempSync(path.join(tmpdir(), 'css-layer-order-'));
  // behavioral-test-allow: reads the shipped stylesheet entrypoint to compile it; jsdom cannot evaluate CSS cascade order
  const source = readFileSync(entry, 'utf-8');
  const result = await postcss([tailwind({ base: emptyBase })]).process(source, { from: entry });
  return postcss.parse(result.css);
}

function ancestorAtRules(node: Node): AtRule[] {
  const found: AtRule[] = [];
  for (let parent: Node | undefined = node.parent; parent; parent = parent.parent) {
    if (parent instanceof AtRule) found.push(parent);
  }
  return found;
}

function layerOf(node: ChildNode): string | undefined {
  return ancestorAtRules(node).find((atRule) => atRule.name === 'layer')?.params;
}

function insideMedia(node: ChildNode, params: RegExp): boolean {
  return ancestorAtRules(node).some(
    (atRule) =>
      atRule.name === 'media' && params.test(atRule.params.replace(/[()]|: active/g, '').trim()),
  );
}

function rulesIn(root: Root, media: RegExp): Rule[] {
  const found: Rule[] = [];
  root.walkRules((rule) => {
    if (insideMedia(rule, media)) found.push(rule);
  });
  return found;
}

function selectorsOf(rule: Rule): string[] {
  return rule.selectors.map((selector) => selector.replace(/\s+/g, ' ').trim());
}

function layerOrder(root: Root): string[] {
  const seen: string[] = [];
  root.walkAtRules('layer', (atRule) => {
    for (const name of atRule.params.split(',').map((part) => part.trim())) {
      if (LAYER_ORDER.includes(name) && !seen.includes(name)) seen.push(name);
    }
  });
  return seen;
}

function importantDeclarations(root: Root): { layer: string; selector: string; prop: string }[] {
  const found: { layer: string; selector: string; prop: string }[] = [];
  root.walkDecls((decl: Declaration) => {
    if (!decl.important || decl.parent?.type !== 'rule') return;
    found.push({
      layer: layerOf(decl) ?? 'unlayered',
      selector: selectorsOf(decl.parent as Rule).join(', '),
      prop: decl.prop,
    });
  });
  return found;
}

describe('stylesheet layer order', () => {
  it('declares overrides as the last of the five layers, in the order theme, base, components, utilities, overrides', async () => {
    const root = await compile(GLOBALS_CSS);
    expect(layerOrder(root)).toEqual(LAYER_ORDER);
  });

  it('ships the forced-colors rules once on every route, from the global entry', async () => {
    const globals = await compile(GLOBALS_CSS);
    const home = await compile(HOME_CSS);
    const inGlobals = rulesIn(globals, FORCED_COLORS).filter((rule) =>
      selectorsOf(rule).includes(FORCED_ONLY_SELECTOR),
    );
    expect(inGlobals).toHaveLength(1);
    expect(
      rulesIn(home, FORCED_COLORS).filter((rule) =>
        selectorsOf(rule).includes(FORCED_ONLY_SELECTOR),
      ),
    ).toEqual([]);
  });

  it('puts every forced-colors and print rule of the two sheets in the overrides layer', async () => {
    const root = await compile(GLOBALS_CSS);
    const forced = rulesIn(root, FORCED_COLORS);
    const chrome = rulesIn(root, PRINT).filter((rule) =>
      selectorsOf(rule).includes(PRINT_CHROME_SELECTOR),
    );
    expect(forced.length).toBeGreaterThan(0);
    expect(chrome.length).toBeGreaterThan(0);
    expect(
      [...forced, ...chrome].filter((rule) => layerOf(rule) !== OVERRIDES).map(selectorsOf),
    ).toEqual([]);
  });

  it('keeps !important only on the rules an inline style or a no-script visitor can outrank', async () => {
    const root = await compile(GLOBALS_CSS);
    const important = importantDeclarations(root).filter((entry) => entry.layer !== 'base');
    expect(important).toEqual([
      { layer: 'unlayered', selector: '*, *::before, *::after', prop: 'animation' },
      { layer: 'unlayered', selector: '*, *::before, *::after', prop: 'transition' },
      { layer: OVERRIDES, selector: INLINE_DISPLAY_SELECTOR, prop: 'display' },
    ]);
  });
});
