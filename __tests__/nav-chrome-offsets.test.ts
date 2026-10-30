import { describe, expect, it } from 'vitest';
import { readBaseCss, readComponentsCss } from './helpers/components-css';

// behavioral-test-allow: reads the shipped stylesheet build asset; jsdom cannot evaluate CSS cascade/media-query resolution
const componentsCss = readComponentsCss();
// behavioral-test-allow: reads the shipped stylesheet build asset; jsdom cannot evaluate CSS cascade/media-query resolution
const baseCss = readBaseCss();

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

function baseRuleBody(selector: string): string | undefined {
  const match = baseCss.match(new RegExp(`(?:^|\\})\\s*${selector}\\s*\\{([^{}]*)\\}`));
  return match?.[1];
}

describe('drawer scroll lock', () => {
  it('reserves the scrollbar gutter on the page root in every scroll state', () => {
    const body = baseRuleBody('html');
    expect(
      body,
      'app/css/base.css: expected an html rule that reserves the scrollbar gutter.',
    ).toBeDefined();
    expect(
      body ?? '',
      'app/css/base.css: the html rule must set scrollbar-gutter: stable, because the drawer ' +
        'scroll lock replaces the page scrollbar with overflow: hidden. Without a gutter reserved ' +
        'in the unlocked state too, locking the page removes the scrollbar on platforms with ' +
        'classic scrollbars and the centred column jumps sideways.',
    ).toContain('scrollbar-gutter: stable');
  });

  it('locks the overflow without touching the gutter the page root already reserves', () => {
    const bodies = ruleBodies(/html\[data-scroll-locked\]/);
    expect(
      bodies.length,
      'app/css/components-nav.css: expected the html[data-scroll-locked] rule to exist.',
    ).toBeGreaterThan(0);
    for (const body of bodies) {
      expect(body).toContain('overflow: hidden');
      expect(
        body,
        'app/css/components-nav.css: the scroll lock must not set scrollbar-gutter, because the ' +
          'page root already reserves the gutter in both scroll states. A gutter scoped to the ' +
          'lock reserves it only while the drawer is open and shifts the centred column on ' +
          'platforms with overlay scrollbars.',
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
