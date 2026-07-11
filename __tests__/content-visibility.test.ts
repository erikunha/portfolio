// itself is a build asset; that single read carries a behavioral-test-allow

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

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
    const { default: Home } = await import('@/app/page');
    const tree = Home();
    const deferredCount = countDeferredSections(tree);
    expect(deferredCount).toBeGreaterThanOrEqual(14);
  });

  it('components.css ships the .module-deferred content-visibility rule', () => {
    // behavioral-test-allow: reads the shipped stylesheet build asset; jsdom cannot evaluate content-visibility
    const componentsCss = readFileSync(
      path.resolve(__dirname, '../app/css/components.css'),
      'utf-8',
    );
    expect(componentsCss).toContain('.module-deferred');
    expect(componentsCss).toContain('content-visibility: auto');
    expect(componentsCss).not.toMatch(/nth-of-type\(n\s*\+\s*\d+\)/);
  });
});
