import { expect, test } from '@playwright/test';
import { VIEWPORTS } from './_helpers/geometry';
import { gotoSettled } from './_helpers/streamed';

const MIN_TOUCH_TARGET_PX = 44;
const SUBPIXEL_TOLERANCE_PX = 2;
const STANDALONE_LINKS: Record<string, string> = {
  '/': '#sec-projects .project-co a, #sec-live-metrics .measured-heading a',
  '/cv': '.reading-entry h3 a',
  '/design-system/components': '.component-nav a',
};

test.describe('standalone links are 44px touch targets on a touch device', () => {
  test.use({ viewport: VIEWPORTS.PHONE, hasTouch: true, isMobile: true });

  for (const [path, selector] of Object.entries(STANDALONE_LINKS)) {
    test(`${path}: company, source and community links`, async ({ page }) => {
      await gotoSettled(page, path);
      const links = page.locator(selector);
      const count = await links.count();
      expect(count, `${selector} matched no link on ${path}`).toBeGreaterThan(0);
      const small: string[] = [];
      for (let index = 0; index < count; index += 1) {
        const link = links.nth(index);
        if (!(await link.isVisible())) continue;
        await link.scrollIntoViewIfNeeded();
        const reach = await link.evaluate(
          (node, half) => {
            const rect = node.getBoundingClientRect();
            const x = rect.left + Math.min(rect.width / 2, 4);
            const y = rect.top + rect.height / 2;
            const hits = (dy: number) => {
              const hit = document.elementFromPoint(x, y + dy);
              return hit !== null && (hit === node || node.contains(hit));
            };
            return {
              text: node.textContent?.trim().slice(0, 24) ?? '',
              ok: hits(-half) && hits(half),
            };
          },
          MIN_TOUCH_TARGET_PX / 2 - SUBPIXEL_TOLERANCE_PX,
        );
        if (!reach.ok) small.push(reach.text);
      }
      expect(
        small,
        `a standalone link on ${path} does not answer a tap ${MIN_TOUCH_TARGET_PX}px tall`,
      ).toEqual([]);
    });
  }
});
