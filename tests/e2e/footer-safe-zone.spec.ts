import { expect, test } from '@playwright/test';
import { gotoSettled } from './_helpers/streamed';

const WIDTHS = [320, 375, 390, 767, 768, 1024, 1280] as const;
const VIEWPORT_HEIGHT = 900;
const EDGE_TOLERANCE_PX = 1;

test.describe('footer panels reach the same right edge as the header content', () => {
  for (const width of WIDTHS) {
    test(`at ${width}px every footer panel ends on the header right edge`, async ({ page }) => {
      await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
      await gotoSettled(page, '/');
      const edges = await page.evaluate(() => {
        const controls = [...document.querySelectorAll('header a, header button')]
          .map((node) => node.getBoundingClientRect())
          .filter((box) => box.width > 0 && box.height > 0);
        const panels = [...document.querySelectorAll('.footer-card')].map(
          (node) => node.getBoundingClientRect().right,
        );
        return { header: Math.max(...controls.map((box) => box.right)), panels };
      });
      expect(edges.panels.length).toBeGreaterThan(0);
      expect(
        Math.max(...edges.panels),
        'the footer panels must not be inset to leave room for the back-to-top button',
      ).toBeGreaterThanOrEqual(edges.header - EDGE_TOLERANCE_PX);
    });
  }
});
