// __tests__/content-visibility.test.ts
// Behavioral test (CG3): verifies the below-fold deferral mechanism.
//
//  - The `defer` prop on a section must produce the `.cv-defer` class on the
//    rendered <section> — proven by rendering the Module shell both ways.
//  - The page composition must mark every below-fold section with defer —
//    proven by walking the real element tree app/page.tsx's Home() returns.
//
// The `.cv-defer { content-visibility: auto }` CSS rule itself is a build
// asset; that single read carries a behavioral-test-allow tag (jsdom does not
// evaluate stylesheet `content-visibility`, so the shipped rule's presence in
// the stylesheet is the strongest verifiable signal).

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

// Module is an async RSC that reads request headers; stub the UA detection so
// it resolves deterministically to the desktop branch under test.
vi.mock('@/lib/get-is-mobile-for-request', () => ({
  getIsMobileForRequest: vi.fn(async () => false),
}));

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
  it('Module renders the cv-defer class only when defer is set', async () => {
    const { Module } = await import('@/components/responsive/Module');
    // Module is async — invoke it to obtain the resolved element, then render.
    const deferredEl = await Module({
      id: 'test-deferred',
      header: 'T',
      defer: true,
      children: null,
    });
    const eagerEl = await Module({
      id: 'test-eager',
      header: 'T',
      defer: false,
      children: null,
    });
    expect(renderToStaticMarkup(deferredEl)).toContain('cv-defer');
    expect(renderToStaticMarkup(eagerEl)).not.toContain('cv-defer');
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

  it('_layout.css ships the .cv-defer content-visibility rule', () => {
    // behavioral-test-allow: reads the shipped stylesheet build asset; jsdom cannot evaluate content-visibility
    const layout = readFileSync(path.resolve(__dirname, '../app/css/_layout.css'), 'utf-8');
    expect(layout).toContain('.cv-defer');
    expect(layout).toContain('content-visibility: auto');
    // Class-based selection replaced the brittle nth-of-type positional
    // selector — guard against a regression back to positional deferral.
    expect(layout).not.toMatch(/nth-of-type\(n\s*\+\s*\d+\)/);
  });
});
