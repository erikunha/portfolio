import { readFileSync } from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DEFERRED_SECTION_COUNT } from '@/components/responsive/Module/module.constants';

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

  it('app/page.tsx defers exactly the below-fold section set', async () => {
    const { default: Home } = await import('@/app/page');
    const tree = Home();
    const deferredCount = countDeferredSections(tree);
    expect(
      deferredCount,
      `app/page.tsx must pass \`defer\` to exactly ${DEFERRED_SECTION_COUNT} sections. This was a >= floor, which let a silent drop of up to 2 sections pass: they would render eagerly, forfeiting their share of the ~840ms mobile style+layout deferral, with every gate green. If you intentionally changed the deferred set, update DEFERRED_SECTION_COUNT — that edit is the decision, and it should be visible in review.`,
    ).toBe(DEFERRED_SECTION_COUNT);
  });

  it('components.css ships the .module-deferred content-visibility rule', () => {
    // behavioral-test-allow: reads the shipped stylesheet build asset; jsdom cannot evaluate content-visibility
    const componentsCss = readFileSync(
      path.resolve(__dirname, '../app/css/components.css'),
      'utf-8',
    );
    const deferredRules = Array.from(componentsCss.matchAll(/([^{}]+)\{([^{}]*)\}/g)).filter((m) =>
      (m[1] ?? '').split(',').some((s) => s.trim() === '.module-deferred'),
    );
    expect(
      deferredRules.length,
      'app/css/components.css must ship exactly ONE `.module-deferred` rule. Zero means the Module `defer` prop matches nothing. More than one means a later same-specificity rule wins the cascade and can silently revert `content-visibility` to `visible` for every below-fold section while this test still passes.',
    ).toBe(1);
    const deferredBlock = deferredRules[0]?.[2];
    expect(
      deferredBlock,
      'the `content-visibility: auto` declaration must live INSIDE the .module-deferred block. Asserting it exists somewhere in the file would still pass if a future edit moved it to an unrelated selector, silently dropping below-fold deferral (~840ms of mobile style+layout) with no test failure.',
    ).toContain('content-visibility: auto');
    expect(deferredBlock).toContain('contain-intrinsic-size');

    const lastContentVisibility = (deferredBlock ?? '')
      .match(/content-visibility:\s*([\w-]+)/g)
      ?.at(-1);
    expect(
      lastContentVisibility,
      'the LAST `content-visibility` declaration in the .module-deferred block must be `auto`. Presence is not enough: a second declaration later in the same block wins on last-declaration-wins and reverts deferral while `toContain` still passes.',
    ).toBe('content-visibility: auto');

    const prefixedOverride = componentsCss.match(/[\w[\]="'-]+\.module-deferred(?![\w-])/);
    expect(
      prefixedOverride,
      'no selector may PREFIX `.module-deferred` (e.g. `section.module-deferred`). A prefix raises specificity, wins the cascade regardless of source order, and is invisible to the exact-selector filter above. This checks prefixes only — it does NOT catch `.module-deferred.foo`, `.module-deferred:not(.x)`, or `.parent .module-deferred`. Those are caught by the computed-style assertion in tests/e2e/cross-cutting.spec.ts, which is the authoritative gate; a source-text test cannot resolve the cascade.',
    ).toBeNull();

    expect(componentsCss).not.toMatch(/nth-of-type\(n\s*\+\s*\d+\)/);
  });
});
