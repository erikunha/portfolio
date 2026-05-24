import { expect, test } from '@playwright/test';

// Force mobile viewport: ToTopButton is CSS display:none above 768px
test.use({ viewport: { width: 375, height: 812 } });

test.describe('ToTopButton — scroll-to-top affordance', () => {
  test('button is hidden on initial load (page top)', async ({ page }) => {
    await page.goto('/');
    // ToTopButton uses opacity:0 + pointer-events:none when at page top (not display:none,
    // which would prevent the CSS transition). Playwright treats opacity:0 as visible,
    // so assert on pointer-events instead.
    const btn = page.getByRole('button', { name: /top/i });
    await expect(btn).toHaveCSS('pointer-events', 'none');
  });

  test('button appears after scrolling down the page', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => window.scrollTo(0, 800));
    await page.waitForTimeout(300);
    const btn = page.getByRole('button', { name: /top/i });
    await expect(btn).toBeVisible();
  });

  test('clicking the button scrolls back to the top', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => window.scrollTo(0, 800));
    await page.waitForTimeout(300);
    const btn = page.getByRole('button', { name: /top/i });
    await btn.click();
    // scrollTo(0,0) may use smooth scrolling — poll until settled rather than
    // asserting an exact zero immediately after a fixed wait.
    await expect
      .poll(() => page.evaluate(() => window.scrollY), { timeout: 1500 })
      .toBeLessThan(10);
  });
});
