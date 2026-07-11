import { expect, test } from '@playwright/test';

async function loadFooter(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.locator('[data-testid="footer-lazy-sentinel"]').scrollIntoViewIfNeeded();
  await page.waitForSelector('footer', { timeout: 10000 });
}

test.describe('Footer — links and content', () => {
  test('GitHub link has correct href', async ({ page }) => {
    await loadFooter(page);
    const footer = page.locator('footer');
    const github = footer.getByRole('link', { name: /github\.com\/erikunha/i }).first();
    await expect(github).toHaveAttribute('href', 'https://github.com/erikunha');
  });

  test('LinkedIn link has correct href', async ({ page }) => {
    await loadFooter(page);
    const footer = page.locator('footer');
    const linkedin = footer.locator('a[href="https://linkedin.com/in/erikunha"]').first();
    await expect(linkedin).toBeVisible();
    await expect(linkedin).toHaveAttribute('href', 'https://linkedin.com/in/erikunha');
  });

  test('footer is present in the DOM', async ({ page }) => {
    await loadFooter(page);
    await expect(page.locator('footer')).toBeAttached();
  });
});
