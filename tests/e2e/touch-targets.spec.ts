import { expect, test } from '@playwright/test';
import { VIEWPORTS } from './_helpers/geometry';

const MIN_TOUCH_TARGET_PX = 44;
const STANDALONE_LINKS: Record<string, string> = {
  '/': '#sec-projects .project-co a, #sec-live-metrics .measured-heading a, .career-tag-key a',
  '/cv': '.reading-entry h3 a',
};

test.describe('standalone links are 44px touch targets on a touch device', () => {
  test.use({ viewport: VIEWPORTS.PHONE, hasTouch: true, isMobile: true });

  for (const [path, selector] of Object.entries(STANDALONE_LINKS)) {
    test(`${path}: company, source and community links`, async ({ page }) => {
      await page.goto(path);
      await page.locator(selector).first().scrollIntoViewIfNeeded();
      const small = await page.locator(selector).evaluateAll((links) =>
        links
          .filter((link) => link.getBoundingClientRect().height > 0)
          .map((link) => ({
            text: link.textContent?.trim().slice(0, 24) ?? '',
            height: Math.round(link.getBoundingClientRect().height),
          })),
      );
      expect(small.length, `${selector} matched no visible link on ${path}`).toBeGreaterThan(0);
      expect(
        small.filter((entry) => entry.height < MIN_TOUCH_TARGET_PX),
        `a standalone link on ${path} is under the ${MIN_TOUCH_TARGET_PX}px touch target`,
      ).toEqual([]);
    });
  }
});
