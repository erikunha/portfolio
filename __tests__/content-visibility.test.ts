// __tests__/content-visibility.test.ts
// Behavioral test: verifies the below-fold deferral mechanism.
//
//  - The `defer` prop on a section must produce the `data-cv-defer` attribute
//    on the rendered <details> — proven by rendering the Module shell both ways.
//  - The page composition must mark every below-fold section with defer —
//    proven by walking the real element tree app/page.tsx's Home() returns.
//
// The `details[data-cv-defer="true"] { content-visibility: auto }` CSS rule
// itself is a build asset; that single read carries a behavioral-test-allow
// tag (jsdom does not evaluate stylesheet `content-visibility`, so the shipped
// rule's presence in Module.module.css is the strongest verifiable signal).

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

// Module is a pure (sync, non-async) Server Component: one <details> for every
// viewport, no UA detection. No stub needed — it renders deterministically.

// Recursively walk a React element tree, collecting every node whose props
// carry `defer: true`.
function countDeferredSections(node: unknown): number {
  if (!node || typeof node !== 'object') return 0;
  if (Array.isArray(node)) {
    return node.reduce<number>((sum, child) => sum + countDeferredSections(child), 0);
  }
  const el = node as { props?: Record<string, unknown> };
  let count = 0;
  if (el.props && el.props.defer === true) count++;
  if (el.props && 'children' in el.props) count += countDeferredSections(el.props.children);
  return count;
}

describe('content-visibility deferral', () => {
  it('Module renders data-cv-defer attribute only when defer is set', async () => {
    const { Module } = await import('@/components/responsive/Module');
    // Module is a sync Server Component — call it to obtain the element.
    const deferredEl = Module({
      id: 'test-deferred',
      header: 'T',
      defer: true,
      children: null,
    });
    const eagerEl = Module({
      id: 'test-eager',
      header: 'T',
      defer: false,
      children: null,
    });
    expect(renderToStaticMarkup(deferredEl)).toContain('data-cv-defer="true"');
    expect(renderToStaticMarkup(eagerEl)).not.toContain('data-cv-defer');
  });

  it('app/page.tsx defers every below-fold section (>= 14)', async () => {
    // Home() returns the element tree synchronously — no async RSC resolution
    // needed to inspect which sections are passed `defer`.
    const { default: Home } = await import('@/app/page');
    const tree = Home();
    const deferredCount = countDeferredSections(tree);
    // ReadmeSection/ShellSection/ManPageSection/NowSection are above the fold
    // (no defer); the remaining 14 below-fold sections must all defer.
    expect(deferredCount).toBeGreaterThanOrEqual(14);
  });

  it('Module.module.css ships the data-cv-defer content-visibility rule', () => {
    // behavioral-test-allow: reads the shipped stylesheet build asset; jsdom cannot evaluate content-visibility
    const moduleCss = readFileSync(
      path.resolve(__dirname, '../components/responsive/Module/Module.module.css'),
      'utf-8',
    );
    expect(moduleCss).toContain('data-cv-defer');
    expect(moduleCss).toContain('content-visibility: auto');
    // Attribute-based selection replaced the brittle nth-of-type positional
    // selector — guard against a regression back to positional deferral.
    expect(moduleCss).not.toMatch(/nth-of-type\(n\s*\+\s*\d+\)/);
  });
});
