import { expect, test } from '@playwright/test';
import { VIEWPORTS } from './_helpers/geometry';
import { gotoSettled } from './_helpers/streamed';

const WCAG_MINIMUM_TARGET_PX = 24;
const STANDALONE_LINKS: Record<string, string> = {
  '/': '#sec-live-metrics .measured-heading a',
  '/design-system/components': '.component-nav a',
};

test.describe('standalone links are at least 24px tall with a mouse (WCAG 2.5.8)', () => {
  test.use({ viewport: VIEWPORTS.DESKTOP });

  for (const [path, selector] of Object.entries(STANDALONE_LINKS)) {
    test(`${path}: ${selector}`, async ({ page }) => {
      await gotoSettled(page, path);
      const links = page.locator(selector);
      const count = await links.count();
      expect(count, `${selector} matched no link on ${path}`).toBeGreaterThan(0);
      const short: string[] = [];
      for (let index = 0; index < count; index += 1) {
        const link = links.nth(index);
        if (!(await link.isVisible())) continue;
        await link.scrollIntoViewIfNeeded();
        const box = await link.boundingBox();
        if (!box || box.height < WCAG_MINIMUM_TARGET_PX) {
          short.push(`${(await link.textContent())?.trim().slice(0, 24)}: ${box?.height ?? 0}px`);
        }
      }
      expect(short, `a standalone link on ${path} is shorter than 24px`).toEqual([]);
    });
  }
});
