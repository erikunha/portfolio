import { expect, test } from '@playwright/test';
import { waitForHydration } from './_helpers/hydration';
import { freezeMotion } from './_helpers/motion';
import { gotoSettled } from './_helpers/streamed';

const FORM_SELECTOR = '[data-testid="contact-form"]';
const WIDTHS = [320, 375, 390] as const;
const ROUTES = ['/', '/pt'] as const;
const SUBPIXEL_PX = 1;

for (const route of ROUTES) {
  for (const width of WIDTHS) {
    test(`${route} at ${width}px: the error summary lines sit at the text rhythm`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 800 });
      await freezeMotion(page);
      await gotoSettled(page, route);
      await page.locator(FORM_SELECTOR).scrollIntoViewIfNeeded();
      await waitForHydration(page, FORM_SELECTOR);
      await expect(async () => {
        await page.locator(`${FORM_SELECTOR} button[type="submit"]`).click();
        await expect(page.locator('.contact-alert')).toBeVisible({ timeout: 1000 });
      }).toPass();
      const measured = await page.evaluate(() => {
        const paragraph = document.querySelector('.contact-alert p') as HTMLElement;
        const style = getComputedStyle(paragraph);
        const range = document.createRange();
        range.selectNodeContents(paragraph);
        const tops = new Set(
          [...range.getClientRects()]
            .filter((rect) => rect.width > 0)
            .map((r) => Math.round(r.top)),
        );
        const fieldHint = document.querySelector('.contact-form .field-error') as HTMLElement;
        return {
          height: paragraph.getBoundingClientRect().height,
          lines: tops.size,
          lineHeight: Number.parseFloat(style.lineHeight),
          hintLineHeight: Number.parseFloat(getComputedStyle(fieldHint).lineHeight),
        };
      });
      expect(measured.lines, 'the summary wraps at this width').toBeGreaterThan(1);
      expect(
        Math.abs(measured.height - measured.lines * measured.lineHeight),
        'a link in the summary must not make its line taller than the text line',
      ).toBeLessThanOrEqual(SUBPIXEL_PX * measured.lines);
    });
  }
}
