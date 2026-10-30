import { describe, expect, it } from 'vitest';
import { readComponentsCss } from './helpers/components-css';

// behavioral-test-allow: reads the shipped stylesheet build asset; jsdom cannot evaluate CSS cascade/media-query resolution
const componentsCss = readComponentsCss();

function ruleBodies(selectorPattern: RegExp): string[] {
  return Array.from(componentsCss.matchAll(/([^{}]+)\{([^{}]*)\}/g))
    .filter((match) => selectorPattern.test(match[1] ?? ''))
    .map((match) => match[2] ?? '');
}

function ruleSelectors(selectorPattern: RegExp): string[] {
  return Array.from(componentsCss.matchAll(/([^{}]+)\{([^{}]*)\}/g))
    .filter((match) => selectorPattern.test(match[1] ?? ''))
    .map((match) => match[1]?.trim() ?? '');
}

describe('drawer scroll lock', () => {
  it('does not reserve a scrollbar gutter the unlocked page does not have', () => {
    const bodies = ruleBodies(/html\[data-scroll-locked\]/);
    expect(
      bodies.length,
      'app/css/components-nav.css: expected the html[data-scroll-locked] rule to exist.',
    ).toBeGreaterThan(0);
    for (const body of bodies) {
      expect(body).toContain('overflow: hidden');
      expect(
        body,
        'app/css/components-nav.css: the scroll lock must not set scrollbar-gutter, because a ' +
          'reserved gutter shifts the centred page while the drawer is open on platforms with ' +
          'classic scrollbars.',
      ).not.toContain('scrollbar-gutter');
    }
  });
});

describe('noscript notice', () => {
  it('is offset below the topbar but never sideways', () => {
    const bodies = ruleBodies(/\.nojs-bar/);
    expect(
      bodies.length,
      'app/css/components-error-pages.css: expected at least one .nojs-bar rule.',
    ).toBeGreaterThan(0);
    for (const body of bodies) {
      expect(
        body,
        'app/css/components-error-pages.css: the noscript notice must carry no horizontal ' +
          'offset, because the collapsed rail it cleared is gone and the notice would sit ' +
          'offset from the topbar and the page content.',
      ).not.toMatch(/margin-(left|right|inline)/);
    }
  });
});

describe('topbar search trigger', () => {
  it('clips the word instead of removing it, and keeps the word scoped to the topbar row', () => {
    const selectors = ruleSelectors(/\.search-trigger-label/);
    expect(
      selectors.length,
      'app/css/components-nav.css: expected a rule for the search trigger label.',
    ).toBeGreaterThan(0);
    for (const selector of selectors) {
      expect(
        selector,
        'app/css/components-nav.css: the search label may only be clipped inside the topbar ' +
          'row; a rule that also matches the drawer row would hide the word there, where it ' +
          'has the width for it.',
      ).toContain('.topbar-search');
    }
    for (const body of ruleBodies(/\.search-trigger-label/)) {
      expect(
        body,
        'app/css/components-nav.css: the clipped search label must stay in the accessibility ' +
          'tree, so it may not be hidden with display or visibility.',
      ).not.toMatch(/display:\s*none|visibility:\s*hidden/);
      expect(body).toMatch(/width:\s*1px/);
    }
  });
});
