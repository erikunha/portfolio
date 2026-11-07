import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 375, height: 812 } });

test.describe('ToTopButton: scroll-to-top affordance', () => {
  test('button is hidden on initial load (page top)', async ({ page }) => {
    await page.goto('/');
    const btn = page.getByRole('button', { name: /top/i, includeHidden: true });
    await expect(btn).toHaveCSS('pointer-events', 'none');
  });

  test('Tab never lands on the invisible button at the page top', async ({ page }) => {
    await page.goto('/');
    await page.locator('body').click({ position: { x: 1, y: 1 } });
    for (let step = 0; step < 60; step++) {
      await page.keyboard.press('Shift+Tab');
      const focusedName = await page.evaluate(() =>
        document.activeElement?.getAttribute('aria-label'),
      );
      expect(focusedName, 'the hidden to-top button took keyboard focus').not.toMatch(/top/i);
    }
  });

  test('button takes keyboard focus once it is shown', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => window.scrollTo(0, 800));
    const btn = page.getByRole('button', { name: /top/i });
    await expect(btn).toBeVisible();
    await btn.focus();
    await expect(btn).toBeFocused();
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
    await expect
      .poll(() => page.evaluate(() => window.scrollY), { timeout: 1500 })
      .toBeLessThan(10);
  });
});
