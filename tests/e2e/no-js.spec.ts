import { expect, test } from '@playwright/test';

test.use({ javaScriptEnabled: false });

test.describe('home with JavaScript off', () => {
  test('shows the notice and keeps the static content readable', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/This site works best with JavaScript/)).toBeVisible();
    await expect(page.locator('#main-content')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  });

  test('the site navigation still moves to its section', async ({ page }) => {
    await page.goto('/');
    // The noscript bar link is the one contact route at every breakpoint; the dock HIRE leaves the site.
    await page.locator('.nojs-bar a[href="/#sec-contact"]').click();
    await expect(page).toHaveURL(/#sec-contact$/);
    await expect(page.locator('#sec-contact')).toBeAttached();
  });
});
