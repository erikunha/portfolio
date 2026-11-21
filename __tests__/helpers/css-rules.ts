import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import tailwind from '@tailwindcss/postcss';
import postcss, { type Root, type Rule } from 'postcss';

const APP_DIR = path.resolve(__dirname, '../../app');
const ENTRIES = {
  globals: path.join(APP_DIR, 'globals.css'),
  home: path.join(APP_DIR, 'css/home.css'),
} as const;
const IS_OPEN = ':is(';

export type StylesheetEntry = keyof typeof ENTRIES;

const compiled = new Map<StylesheetEntry, Promise<Root>>();
let site: Promise<Root> | undefined;

async function compile(entry: StylesheetEntry): Promise<Root> {
  const file = ENTRIES[entry];
  const emptyBase = mkdtempSync(path.join(tmpdir(), 'css-rules-'));
  // behavioral-test-allow: reads the shipped stylesheet entrypoint to compile it; jsdom cannot evaluate CSS cascade order
  const source = readFileSync(file, 'utf-8');
  const result = await postcss([tailwind({ base: emptyBase })]).process(source, { from: file });
  return postcss.parse(result.css);
}

export function compiledStylesheet(entry: StylesheetEntry): Promise<Root> {
  const cached = compiled.get(entry);
  if (cached) return cached;
  const fresh = compile(entry);
  compiled.set(entry, fresh);
  return fresh;
}

export function compiledSiteStylesheet(): Promise<Root> {
  site ??= Promise.all([compiledStylesheet('globals'), compiledStylesheet('home')]).then(
    ([globals, home]) => {
      const root = postcss.root();
      root.append(globals.clone().nodes, home.clone().nodes);
      return root;
    },
  );
  return site;
}

function splitTopLevel(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '(' || char === '[') depth++;
    else if (char === ')' || char === ']') depth--;
    else if (char === ',' && depth === 0) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(text.slice(start));
  return parts.map((part) => part.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

function expandIs(selector: string): string[] {
  const open = selector.indexOf(IS_OPEN);
  if (open === -1) return [selector];
  let depth = 1;
  let close = open + IS_OPEN.length;
  while (close < selector.length && depth > 0) {
    if (selector[close] === '(') depth++;
    else if (selector[close] === ')') depth--;
    close++;
  }
  const head = selector.slice(0, open);
  const inner = selector.slice(open + IS_OPEN.length, close - 1);
  const tail = selector.slice(close);
  return splitTopLevel(inner).flatMap((arm) => expandIs(`${head}${arm}${tail}`));
}

export function ruleSelectors(rule: Rule): string[] {
  return splitTopLevel(rule.selector).flatMap(expandIs);
}

function selectorList(rule: Rule): string[] {
  return splitTopLevel(rule.selector);
}

export function rulesWithSelector(root: Root, selector: string): Rule[] {
  const found: Rule[] = [];
  root.walkRules((rule) => {
    if (selectorList(rule).includes(selector)) found.push(rule);
  });
  return found;
}

export function rulesWithResolvedSelector(root: Root, selector: string): Rule[] {
  const found: Rule[] = [];
  root.walkRules((rule) => {
    if (ruleSelectors(rule).includes(selector)) found.push(rule);
  });
  return found;
}

export function rulesInMedia(root: Root, params: RegExp, selector: string): Rule[] {
  const found: Rule[] = [];
  root.walkAtRules('media', (atRule) => {
    if (!params.test(atRule.params)) return;
    atRule.each((node) => {
      if (node.type === 'rule' && selectorList(node).includes(selector)) found.push(node);
    });
  });
  return found;
}

export function declValue(rule: Rule | undefined, prop: string): string | undefined {
  if (!rule) return undefined;
  for (const node of rule.nodes) {
    if (node.type === 'decl' && node.prop === prop) return node.value;
  }
  return undefined;
}
