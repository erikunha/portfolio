import { CORE_COMPACT_WIDTHS } from './_helpers/geometry';
import { gotoSettled } from './_helpers/streamed';
import { expect, test } from './_helpers/test';

const ROUTES = ['/cv', '/pt/cv'] as const;
const VIEWPORT_HEIGHT = 900;
const SUBPIXEL_PX = 1;

for (const route of ROUTES) {
  test(`${route}: the contact links sit one spacing step apart, stacked or side by side`, {
    tag: '@cross-browser',
  }, async ({ page }) => {
    const gaps: number[] = [];
    for (const width of CORE_COMPACT_WIDTHS) {
      await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
      await gotoSettled(page, route);
      gaps.push(
        await page.evaluate(() => {
          const row = [...document.querySelectorAll('.reading-actions-inline')].find((node) =>
            node.querySelector('a[href^="mailto:"]'),
          ) as HTMLElement;
          const [first, second] = [...row.children].map((node) => node.getBoundingClientRect());
          if (!first || !second) return Number.NaN;
          const stacked = second.top >= first.bottom - 1;
          return stacked ? second.top - first.bottom : second.left - first.right;
        }),
      );
    }
    const spacing = gaps[0] ?? Number.NaN;
    for (const gap of gaps) {
      expect(
        Math.abs(gap - spacing),
        `gaps ${gaps.join(', ')} at ${CORE_COMPACT_WIDTHS.join(', ')}px must match`,
      ).toBeLessThan(SUBPIXEL_PX);
    }
  });
}
