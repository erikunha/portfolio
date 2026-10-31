import { expect, test } from '@playwright/test';

const WIDTHS = [320, 390, 412, 767, 768, 1023, 1024, 1280];
const VIEWPORT_HEIGHT = 800;
const SUBPIXEL_TOLERANCE_PX = 1;

test.describe('deferred modules', () => {
  for (const width of WIDTHS) {
    test(`no deferred module lays content past its own box at ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
      await page.goto('/', { waitUntil: 'networkidle' });

      const modules = await page.locator('.module-deferred').evaluateAll((els) =>
        els.map((el) => {
          const box = el.getBoundingClientRect();
          let extent = 0;
          for (const child of el.querySelectorAll('*')) {
            extent = Math.max(extent, child.getBoundingClientRect().bottom - box.top);
          }
          return { id: el.id, box: Math.round(box.height), extent: Math.round(extent) };
        }),
      );

      expect(modules.length).toBeGreaterThan(0);
      for (const { id, box, extent } of modules) {
        expect(
          extent,
          `#${id} lays rows ${extent - box}px past its ${box}px placeholder before it paints, over the next section. Raise its estimate in app/css/components-shared.css to at least ${extent}px for this width.`,
        ).toBeLessThanOrEqual(box + SUBPIXEL_TOLERANCE_PX);
      }
    });
  }
});
