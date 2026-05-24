import { expect, test } from '@playwright/test';

// Force mobile viewport: ToTopButton is CSS display:none above 768px
test.use({ viewport: { width: 375, height: 812 } });

test.describe('ToTopButton — scroll-to-top affordance', () => {
  test('button is hidden on initial load (page top)', async ({ page }) => {
    await page.goto('/');
    // ToTopButton only appears after scrolling past the threshold.
    // On initial load it should not be visible.
    const btn = page.getByRole('button', { name: /top/i });
    await expect(btn).not.toBeVisible();
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
    await page.waitForTimeout(500);
    const scrollY = await page.evaluate(() => window.scrollY);
    expect(scrollY).toBe(0);
  });
});
