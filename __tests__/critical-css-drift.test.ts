// __tests__/critical-css-drift.test.ts
//
// SCOPE LIMITATION (documented per spec §5 architect-review):
// This test is SELECTOR-EXISTENCE + VARIABLE-EXISTENCE, NOT
// rule-body equivalence. It catches structural drift (renamed selector,
// deleted variable) but NOT stylistic drift (e.g., font-size value
// changed in source CSS without updating CRITICAL_CSS). Mitigation
// layers for stylistic drift: axe-core visual smoke, post-merge LHCI,
// manual PR review of any .hero__* changes.

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const LAYOUT_SOURCE = readFileSync(path.resolve(__dirname, '../app/layout.tsx'), 'utf-8');

const CSS_DIR = path.resolve(__dirname, '../app/css');
const ALL_CSS = readdirSync(CSS_DIR)
  .filter((f) => f.endsWith('.css'))
  .map((f) => readFileSync(path.join(CSS_DIR, f), 'utf-8'))
  .join('\n');

// Extract CRITICAL_CSS template-literal body from layout.tsx.
const criticalMatch = LAYOUT_SOURCE.match(/const CRITICAL_CSS = `([\s\S]*?)`;/);
const CRITICAL_CSS = criticalMatch?.[1] ?? '';

describe('critical CSS drift guard', () => {
  it('layout.tsx exports a CRITICAL_CSS constant', () => {
    expect(LAYOUT_SOURCE).toMatch(/const CRITICAL_CSS = `/);
    expect(CRITICAL_CSS.length).toBeGreaterThan(2000); // Inlined critical CSS is ~4.7KB; <2KB means extraction stopped early
    expect(CRITICAL_CSS).toMatch(/:root\s*\{/); // Must contain the :root block (defined first)
    expect(CRITICAL_CSS).toMatch(/\.hero__tagline/); // Must contain the LCP element selector (defined last among hero rules)
  });

  it('renders <style>{CRITICAL_CSS}</style> in <head>', () => {
    expect(LAYOUT_SOURCE).toMatch(/<style>\{CRITICAL_CSS\}<\/style>/);
  });

  it('every class selector in CRITICAL_CSS exists in source CSS', () => {
    // Extract class selectors (.foo, .foo--bar, .foo__baz) — exclude
    // pseudo-selectors and combinators.
    const classMatches = CRITICAL_CSS.matchAll(/\.([a-zA-Z][a-zA-Z0-9_-]*)/g);
    const inlinedClasses = new Set(Array.from(classMatches, (m) => m[1] as string));
    const missing: string[] = [];
    for (const cls of inlinedClasses) {
      if (!ALL_CSS.includes(`.${cls}`)) missing.push(cls);
    }
    expect(missing).toEqual([]);
  });

  it('every CSS variable in CRITICAL_CSS is defined in _tokens.css', () => {
    const tokens = readFileSync(path.join(CSS_DIR, '_tokens.css'), 'utf-8');
    const varMatches = CRITICAL_CSS.matchAll(/var\(\s*(--[a-zA-Z][a-zA-Z0-9_-]*)/g);
    const inlinedVars = new Set(Array.from(varMatches, (m) => m[1] as string));
    const missing: string[] = [];
    for (const v of inlinedVars) {
      if (!tokens.includes(`${v}:`)) missing.push(v);
    }
    expect(missing).toEqual([]);
  });

  it('every CSS variable DEFINED in CRITICAL_CSS :root is also defined in _tokens.css', () => {
    const tokens = readFileSync(path.join(CSS_DIR, '_tokens.css'), 'utf-8');
    // Use matchAll (global flag) so ALL :root { } blocks are inspected — CRITICAL_CSS contains
    // more than one (base block + mobile @media block). A single .match() only finds the first.
    const rootBlockMatches = CRITICAL_CSS.matchAll(/:root\s*\{([\s\S]*?)\}/g);
    const definedInCritical = new Set<string>();
    for (const blockMatch of rootBlockMatches) {
      const block = blockMatch[1] ?? '';
      for (const m of block.matchAll(/(--[a-zA-Z][a-zA-Z0-9_-]*)\s*:/g)) {
        definedInCritical.add(m[1] as string);
      }
    }
    const missing: string[] = [];
    for (const v of definedInCritical) {
      if (!tokens.includes(`${v}:`)) missing.push(v);
    }
    expect(missing).toEqual([]);
  });
});
