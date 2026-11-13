import { expect, test } from '@playwright/test';
import { DOCK_MENU, gotoHydrated } from './_helpers/hydration';
import { gotoSettled } from './_helpers/streamed';

const SIDE_WIDTHS = [320, 375, 768] as const;
const VIEWPORT_HEIGHT = 812;
const LINE_PROBE_X = 1;

for (const width of SIDE_WIDTHS) {
  test.describe(`the phone and tablet position line at ${width}px`, () => {
    test.use({ viewport: { width, height: VIEWPORT_HEIGHT } });

    test('runs down the left edge, clear of the content gutter and the dock icons and labels', async ({
      page,
    }) => {
      await gotoSettled(page, '/');
      const geometry = await page.evaluate(() => {
        const line = (document.querySelector('.pos-line') as HTMLElement).getBoundingClientRect();
        const main = document.querySelector('#main-content') as HTMLElement;
        const dockContent = [...document.querySelectorAll<HTMLElement>('.dock > a, .dock > button')]
          .filter((control) => control.checkVisibility())
          .map((control) => {
            const range = document.createRange();
            range.selectNodeContents(control);
            return range.getBoundingClientRect().left;
          });
        return {
          line: { left: line.left, right: line.right, height: line.height },
          contentLeft:
            main.getBoundingClientRect().left +
            Number.parseFloat(getComputedStyle(main).paddingLeft),
          dockLeft: Math.min(...dockContent),
        };
      });
      expect(geometry.line.left, 'the line starts at the left edge of the viewport').toBe(0);
      expect(geometry.line.height, 'it spans the viewport height').toBeGreaterThanOrEqual(
        VIEWPORT_HEIGHT - 1,
      );
      expect(geometry.line.right, 'it stays inside the content gutter').toBeLessThanOrEqual(
        geometry.contentLeft,
      );
      expect(geometry.line.right, 'it never paints over a dock icon or label').toBeLessThanOrEqual(
        geometry.dockLeft,
      );
    });

    test('the open section drawer covers the line instead of the line crossing the drawer', async ({
      page,
    }) => {
      await gotoHydrated(page, '/', DOCK_MENU);
      await page.locator(DOCK_MENU).click();
      const drawer = page.locator('#section-drawer');
      await expect(drawer).toBeVisible();
      await expect(drawer).toHaveCSS('transform', 'none');
      const onTop = await page.evaluate(
        ({ x, y }) => document.elementFromPoint(x, y)?.closest('#section-drawer') !== null,
        { x: LINE_PROBE_X, y: VIEWPORT_HEIGHT / 2 },
      );
      expect(onTop, 'the drawer paints over the left edge where the line runs').toBe(true);
    });
  });
}
