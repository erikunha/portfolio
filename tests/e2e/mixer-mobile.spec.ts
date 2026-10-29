import { expect, test } from '@playwright/test';
import { installMockBackend } from './_helpers/mock-backend';

const MIXER_SELECTOR = '#sec-daw-mixer';
const MOBILE_WIDTHS = [320, 390];
const VIEWPORT_HEIGHT = 800;
const SUBPIXEL_TOLERANCE = 1;

for (const width of MOBILE_WIDTHS) {
  test(`mixer reflows without horizontal overflow at ${width}px`, async ({ page }) => {
    await installMockBackend(page, { log: 'accept', forget: 'happy' });
    await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
    await page.goto('/');
    const mixer = page.locator(MIXER_SELECTOR);
    await mixer.scrollIntoViewIfNeeded();
    await expect(mixer.locator('[data-testid^="channel-"]').first()).toBeVisible();

    const result = await page.evaluate((selector) => {
      const root = document.querySelector(selector);
      const viewport = window.innerWidth;
      const offenders: string[] = [];
      for (const el of root?.querySelectorAll('*') ?? []) {
        const style = getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') continue;
        if (el.closest('.mx-skip')) continue;
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) continue;
        if (rect.right > viewport + 1 || rect.left < -1) {
          offenders.push(
            `${el.tagName}.${String(el.className).slice(0, 40)} right=${Math.round(rect.right)}`,
          );
        }
      }
      return { offenders, scrollWidth: document.documentElement.scrollWidth, viewport };
    }, MIXER_SELECTOR);

    expect(result.offenders, 'mixer elements extend past the viewport').toEqual([]);
    expect(result.scrollWidth).toBeLessThanOrEqual(result.viewport + SUBPIXEL_TOLERANCE);
  });
}
