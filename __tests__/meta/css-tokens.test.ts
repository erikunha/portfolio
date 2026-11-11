import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// Why this gate exists. A custom property that is read but never defined
// makes the whole declaration invalid, and CSS says nothing about it: the
// element falls back to the inherited value and the page looks fine. The
// failure is silent, and the cost of finding it is a screenshot that moved
// for no visible reason.
//
// This is not hypothetical. A sweep that rewrote every ratio `line-height`
// into the `--leading` token also rewrote the token definitions that happened
// to end in "line-height" (`--guitar-line-height` became `--guitar---leading`),
// and the guitar and the footer lost their leading without a word. The gate
// below reads the stylesheet and fails on a reference that resolves to
// nothing.
//
// The tokens listed in RUNTIME_SET are set from JavaScript (an inline style,
// a ref, a font face), so they are legitimately undefined in the stylesheet.

const REPO_ROOT = path.resolve(__dirname, '..', '..');

const CSS_DIR = path.join(REPO_ROOT, 'app', 'css');

const RUNTIME_SET = new Set([
  '--ctz-x',
  '--ctz-y',
  '--eb-min-height',
  '--eq-bar-cycle',
  '--eq-bar-delay',
  '--eq-bar-height',
  '--eq-beat',
  '--eq-inset',
  '--font-display-src',
  '--font-mono-src',
  '--module-type-chars',
  '--mx-knob-angle',
  '--posf',
  '--type-chars',
]);

const stylesheets = (): { file: string; source: string }[] =>
  readdirSync(CSS_DIR)
    .filter((name) => name.endsWith('.css'))
    .map((name) => ({
      file: path.join(CSS_DIR, name),
      source: readFileSync(path.join(CSS_DIR, name), 'utf-8'),
    }))
    // A comment is not a declaration: a token named inside a comment is not
    // defined, and a token used inside a comment is not used.
    .map(({ file, source }) => ({
      file,
      source: source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, ''),
    }));

describe('meta: every custom property the stylesheet reads is defined', () => {
  it('resolves every var() to a token the stylesheet defines', () => {
    const defined = new Set<string>();
    const referenced = new Map<string, string>();

    for (const { file, source } of stylesheets()) {
      for (const match of source.matchAll(/(--[a-zA-Z0-9-]+)\s*:/g)) {
        defined.add(match[1] ?? '');
      }
      for (const match of source.matchAll(/var\(\s*(--[a-zA-Z0-9-]+)/g)) {
        const token = match[1] ?? '';
        if (!referenced.has(token)) {
          referenced.set(token, path.relative(REPO_ROOT, file));
        }
      }
    }

    const unresolved = [...referenced.entries()]
      .filter(([token]) => !defined.has(token) && !RUNTIME_SET.has(token))
      .map(([token, file]) => `${token} (read in ${file})`);

    expect(
      unresolved,
      'these custom properties are read but never defined, so every declaration that ' +
        'reads them is invalid and the property falls back to the inherited value: ' +
        `${unresolved.join(', ')}. Define the token, or - if JavaScript sets it - add it ` +
        'to RUNTIME_SET in this file.',
    ).toEqual([]);
  });

  it('keeps the runtime-set list honest', () => {
    const defined = new Set<string>();

    for (const { source } of stylesheets()) {
      for (const match of source.matchAll(/(--[a-zA-Z0-9-]+)\s*:/g)) {
        defined.add(match[1] ?? '');
      }
    }

    const stale = [...RUNTIME_SET].filter((token) => defined.has(token));

    expect(
      stale,
      'these tokens are in RUNTIME_SET but the stylesheet defines them, so they do not ' +
        `need the exception: ${stale.join(', ')}. Remove them from the list.`,
    ).toEqual([]);
  });
});
