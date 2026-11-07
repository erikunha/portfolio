import { expect, test } from '@playwright/test';

const SCROLLED_DOWN_PX = 800;
const AT_TOP_BELOW_PX = 10;
const SCROLL_SETTLE_TIMEOUT_MS = 8000;

test.use({ viewport: { width: 375, height: 812 } });

test.describe('ToTopButton: scroll-to-top affordance', () => {
  test('button is hidden on initial load (page top)', async ({ page }) => {
    await page.goto('/');
    const btn = page.getByRole('button', { name: /top/i });
    await expect(btn).toHaveCSS('pointer-events', 'none');
  });

  test('button appears after scrolling down the page', async ({ page }) => {
    await page.goto('/');
    await page.evaluate((top) => window.scrollTo(0, top), SCROLLED_DOWN_PX);
    const btn = page.getByRole('button', { name: /top/i });
    await expect(btn).toHaveCSS('pointer-events', 'auto');
    await expect(btn).toBeVisible();
  });

  test('clicking the button scrolls back to the top', async ({ page }) => {
    await page.goto('/');
    await page.evaluate((top) => window.scrollTo(0, top), SCROLLED_DOWN_PX);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(SCROLLED_DOWN_PX);
    const btn = page.getByRole('button', { name: /top/i });
    await expect(btn).toHaveCSS('pointer-events', 'auto');
    await btn.click();
    await expect
      .poll(() => page.evaluate(() => window.scrollY), { timeout: SCROLL_SETTLE_TIMEOUT_MS })
      .toBeLessThan(AT_TOP_BELOW_PX);
  });
});
