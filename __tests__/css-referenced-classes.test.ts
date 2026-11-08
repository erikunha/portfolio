import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '..');
const CSS_DIR = path.join(ROOT, 'app', 'css');
const SOURCE_ROOTS = ['components', 'app', 'design-system', 'content', 'lib'];
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.mdx', '.js', '.mjs']);
const TEST_FILE = /\.(test|spec|e2e)\.[tj]sx?$/;
const CLASS_TOKEN = /\.(-?[_a-zA-Z][\w-]*)/g;

const CORPUS_TOKEN = /[\w-]+/g;

const SCRIPT_SET_CLASSES: Record<string, string> = {};

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

function skipBlock(css: string, openIndex: number): number {
  let depth = 0;
  for (let i = openIndex; i < css.length; i++) {
    if (css[i] === '{') depth++;
    if (css[i] === '}') {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return css.length;
}

function selectorClasses(css: string): Set<string> {
  const found = new Set<string>();
  let cursor = 0;
  let prelude = '';
  while (cursor < css.length) {
    const ch = css[cursor] ?? '';
    if (ch === '{') {
      const trimmed = prelude.trim();
      if (trimmed.startsWith('@')) {
        const isKeyframes = /^@(-\w+-)?keyframes/.test(trimmed);
        if (isKeyframes) {
          cursor = skipBlock(css, cursor);
        } else {
          cursor += 1;
        }
      } else {
        for (const match of trimmed.matchAll(CLASS_TOKEN)) {
          if (match[1]) found.add(match[1]);
        }
        cursor = skipBlock(css, cursor);
      }
      prelude = '';
      continue;
    }
    if (ch === ';' || ch === '}') {
      prelude = '';
    } else {
      prelude += ch;
    }
    cursor += 1;
  }
  return found;
}

function listSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (name === 'node_modules' || name === '.next') return [];
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return listSourceFiles(full);
    const ext = path.extname(name);
    return SOURCE_EXTENSIONS.has(ext) && !TEST_FILE.test(name) ? [full] : [];
  });
}

function unreferencedClasses(declared: Set<string>, corpus: string): string[] {
  const tokens = new Set(corpus.match(CORPUS_TOKEN) ?? []);
  return [...declared]
    .filter((name) => !(name in SCRIPT_SET_CLASSES))
    .filter((name) => !tokens.has(name))
    .sort();
}

describe('stylesheet class selectors', () => {
  it('matches whole class tokens, so a longer name never vouches for a shorter one', () => {
    expect(unreferencedClasses(new Set(['halt-plate']), 'className="footer-halt-plate"')).toEqual([
      'halt-plate',
    ]);
    expect(unreferencedClasses(new Set(['halt-plate']), "cn('halt-plate', x)")).toEqual([]);
  });

  it('references every class selector in app/css from shipped source', () => {
    // behavioral-test-allow: reads shipped stylesheets and source; no runtime can enumerate unused CSS selectors
    const corpus = SOURCE_ROOTS.flatMap((root) => listSourceFiles(path.join(ROOT, root)))
      .map((file) => readFileSync(file, 'utf8'))
      .join('\n');
    const declared = new Set<string>();
    for (const file of readdirSync(CSS_DIR).filter((name) => name.endsWith('.css'))) {
      const css = stripComments(readFileSync(path.join(CSS_DIR, file), 'utf8'));
      for (const name of selectorClasses(css)) declared.add(name);
    }
    const unreferenced = unreferencedClasses(declared, corpus);
    expect(
      unreferenced,
      'A class selector in app/css has no reference in components, app, design-system, content or lib. ' +
        'Delete the rule, or add the class to SCRIPT_SET_CLASSES with the reason it is set outside source.',
    ).toEqual([]);
  });
});
