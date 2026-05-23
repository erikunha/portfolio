import { expect, test } from '@playwright/test';

test.describe('Hero -- above the fold', () => {
  test('renders h1 heading visible on load', async ({ page }) => {
    await page.goto('/');
    const h1 = page.locator('h1').first();
    await expect(h1).toBeVisible();
    await expect(h1).toContainText('Erik');
  });

  test('GitHub CTA link has correct href', async ({ page }) => {
    await page.goto('/');
    const githubLink = page.getByRole('link', { name: /github/i });
    await expect(githubLink).toHaveAttribute('href', 'https://github.com/erikunha');
  });

  test('LinkedIn CTA link has correct href', async ({ page }) => {
    await page.goto('/');
    const linkedinLink = page.getByRole('link', { name: /linkedin/i });
    await expect(linkedinLink).toHaveAttribute('href', 'https://www.linkedin.com/in/erikunha/');
  });

  test('role typewriter element is present with aria-live', async ({ page }) => {
    await page.goto('/');
    const live = page.locator('[aria-live]').first();
    await expect(live).toBeAttached();
  });
});
