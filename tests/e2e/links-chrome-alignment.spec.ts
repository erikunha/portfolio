import { expect, test } from '@playwright/test';
import { gotoSettled } from './_helpers/streamed';

const ROUTES = ['/links', '/links/en'];
const WIDTHS = [320, 390, 768, 1280];
const VIEWPORT_HEIGHT = 900;
const EDGE_TOLERANCE_PX = 1;

for (const path of ROUTES) {
  for (const width of WIDTHS) {
    test.describe(`${path} at ${width}`, () => {
      test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
        await gotoSettled(page, path);
      });

      test('the window title starts on the content edge, as on desktop', async ({ page }) => {
        const edges = await page.evaluate(() => {
          const title = document.querySelector('.links-chrome-title');
          const grid = document.querySelector('.links-grid');
          if (!title || !grid) throw new Error('the chrome bar and the grid render');
          const range = document.createRange();
          range.selectNodeContents(title);
          return {
            text: range.getBoundingClientRect().left,
            grid: grid.getBoundingClientRect().left,
          };
        });
        expect(
          Math.abs(edges.text - edges.grid),
          `title text starts ${edges.text}px, the grid starts ${edges.grid}px`,
        ).toBeLessThanOrEqual(EDGE_TOLERANCE_PX);
      });

      test('the footer prompt line ends on the content edge with its link', async ({ page }) => {
        const edges = await page.evaluate(() => {
          const footer = document.querySelector('.links-footer');
          const link = document.querySelector('.links-footer-link');
          if (!footer || !link) throw new Error('the links footer renders');
          return {
            footer: footer.getBoundingClientRect().right,
            link: link.getBoundingClientRect().right,
          };
        });
        expect(
          Math.abs(edges.footer - edges.link),
          `the link ends ${edges.link}px, the footer ends ${edges.footer}px`,
        ).toBeLessThanOrEqual(EDGE_TOLERANCE_PX);
      });
    });
  }
}
