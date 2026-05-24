import { expect, test } from '@playwright/test';

test.describe('Footer — links and content', () => {
  test('GitHub link has correct href', async ({ page }) => {
    await page.goto('/');
    const footer = page.locator('footer');
    const github = footer.getByRole('link', { name: /github\.com\/erikunha/i }).first();
    await expect(github).toHaveAttribute('href', 'https://github.com/erikunha');
  });

  test('LinkedIn link has correct href', async ({ page }) => {
    await page.goto('/');
    const footer = page.locator('footer');
    const linkedin = footer.locator('a[href="https://linkedin.com/in/erikunha"]').first();
    await expect(linkedin).toBeVisible();
    await expect(linkedin).toHaveAttribute('href', 'https://linkedin.com/in/erikunha');
  });

  test('footer is present in the DOM', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('footer')).toBeAttached();
  });
});
