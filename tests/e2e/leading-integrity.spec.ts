import { expect, test } from '@playwright/test';

// Every element's line box is a whole number of pixels.
//
// A ratio multiplied by a font-size lands on a fraction most of the time
// (16px x 1.55 is 24.8px), and a fractional line box is what makes a paragraph
// of text land on half-pixels: the glyphs sit between pixel rows, and the
// raster renders them unevenly - twice as dark on the lines that fall between
// rows and normal on the ones that do not.
//
// The site rounds the box, not the ratio. `--leading` carries the ratio down
// the tree the way a unitless `line-height` inherits today (a child at a
// different font-size still scales by the same ratio), and the base layer
// turns it into `round(nearest, 1em * var(--leading), 1px)`. A browser
// without `round()` keeps the ratio, which is what it does today, so the gate
// skips there instead of pretending the box is whole.

const ROUTES = ['/', '/cv', '/links', '/design-system/tokens', '/nao-existe-404'];

const supportsRounding = (page: import('@playwright/test').Page): Promise<boolean> =>
  page.evaluate(() => CSS.supports('line-height', 'round(nearest, 1px, 1px)'));

const fractionalLineBoxes = (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const offenders: string[] = [];
    for (const el of document.querySelectorAll('*')) {
      const style = getComputedStyle(el);
      if (style.lineHeight === 'normal') continue;
      const value = Number.parseFloat(style.lineHeight);
      if (Number.isNaN(value) || Number.isInteger(value)) continue;
      offenders.push(
        `${el.tagName.toLowerCase()}.${(el.getAttribute('class') || '').split(/\s+/)[0]} ` +
          `font-size ${style.fontSize}, line-height ${style.lineHeight}`,
      );
    }
    return offenders;
  });

// The box is rounded, but the leading behind it has to be the leading the
// element would have had before. A descendant inherits two things from its
// parent: the ratio, when the parent's leading is a ratio, or the length,
// when the parent's leading is a length. A ratio scales with the
// descendant's own font-size; a length does not.
//
// This is the check that holds both. An element that follows the ratio gets
// round(its own font-size x the ratio). An element inside a parent that
// declares a length inherits that length, whatever its own font-size. The
// failure this catches is silent: the box is whole, the page looks fine, and
// the leading of a whole subtree has quietly changed.
const inheritedLeading = (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const offenders: string[] = [];
    const ratioOf = (style: CSSStyleDeclaration): number =>
      Number.parseFloat(style.getPropertyValue('--leading'));

    for (const el of document.querySelectorAll('*')) {
      const parent = el.parentElement;
      if (!parent) continue;
      const style = getComputedStyle(el);
      const parentStyle = getComputedStyle(parent);
      if (style.lineHeight === 'normal' || parentStyle.lineHeight === 'normal') continue;

      const ratio = ratioOf(style);
      const parentRatio = ratioOf(parentStyle);
      const fontSize = Number.parseFloat(style.fontSize);
      const parentFontSize = Number.parseFloat(parentStyle.fontSize);
      const lineHeight = Number.parseFloat(style.lineHeight);
      const parentLineHeight = Number.parseFloat(parentStyle.lineHeight);
      if (
        [ratio, parentRatio, fontSize, parentFontSize, lineHeight, parentLineHeight].some(
          Number.isNaN,
        )
      )
        continue;

      const expected = Math.round(fontSize * ratio);
      const parentExpected = Math.round(parentFontSize * parentRatio);

      // The element follows a ratio of its own, so it is not the inherited
      // leading that is in question.
      if (Math.abs(lineHeight - expected) > 0.001) continue;
      // The element carries the parent's ratio, so the parent does not
      // declare a leading of its own either, and the ratio is what travels.
      if (Math.abs(ratio - parentRatio) > 0.0001) continue;
      // The parent declares a leading that is not its ratio: a length. The
      // element inherits the length, not a ratio of its own font-size.
      if (Math.abs(parentLineHeight - parentExpected) <= 0.001) continue;

      if (Math.abs(lineHeight - parentLineHeight) > 0.001) {
        offenders.push(
          `${el.tagName.toLowerCase()}.${(el.getAttribute('class') || '').split(/\s+/)[0]} ` +
            `has line-height ${style.lineHeight}, but its parent ` +
            `${parent.tagName.toLowerCase()}.${(parent.getAttribute('class') || '').split(/\s+/)[0]} ` +
            `declares ${parentStyle.lineHeight} and the element inherits that length, not a ` +
            'ratio of its own font-size',
        );
      }
    }
    return offenders;
  });

test.describe('line boxes are whole pixels', () => {
  for (const route of ROUTES) {
    test(`${route} renders every line box on a whole pixel`, async ({ page }) => {
      test.skip(
        !(await supportsRounding(page)),
        'this browser has no CSS round(); the line box stays fractional there by design',
      );

      await page.goto(route, { waitUntil: 'networkidle' });

      const offenders = await fractionalLineBoxes(page);

      expect(
        offenders,
        `these elements have a fractional line box on ${route}. The ratio is allowed to be ' +
          'fractional; the box it produces is not. Either the element sets --leading and the ' +
          'base rule rounds it, or it sets line-height directly - the second one bypasses the ' +
          'rounding, because a length in the utilities or components layer outranks the base ' +
          'layer.`,
      ).toEqual([]);
    });

    test(`${route} inherits the leading its parent declares`, async ({ page }) => {
      test.skip(
        !(await supportsRounding(page)),
        'this browser has no CSS round(); the line box stays fractional there by design',
      );

      await page.goto(route, { waitUntil: 'networkidle' });

      const offenders = await inheritedLeading(page);

      expect(
        offenders,
        `these elements on ${route} do not inherit the leading their parent declares. A ` +
          'ratio travels as a ratio and scales with the font-size; a length travels as a ' +
          'length and does not. An element that takes a ratio where its parent declares a ' +
          'length has a different leading from the one it had before the box was rounded, ' +
          'and the change is invisible on the screen.',
      ).toEqual([]);
    });
  }
});
