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
      ).not.toMatch(
        /(margin|padding)-(left|right|inline)|(^|[;\s])(left|right|inset|inset-inline)\s*:|translate(X)?\(|translate\s*:/,
      );
    }
    expect(
      bodies.some((body) => /margin-top:\s*var\(--topbar-height\)/.test(body)),
      'app/css/components-error-pages.css: the noscript notice must clear the fixed topbar with margin-top: var(--topbar-height).',
    ).toBe(true);
  });
});
