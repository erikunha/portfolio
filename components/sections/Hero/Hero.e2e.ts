import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 1280, height: 720 } });

test.describe('Hero -- above the fold', () => {
  test('renders h1 heading visible on load', async ({ page }) => {
    await page.goto('/');
    const h1 = page.locator('h1').first();
    await expect(h1).toBeVisible();
    await expect(h1).toContainText('Erik');
  });

  test('GitHub CTA link has correct href', async ({ page }) => {
    await page.goto('/');
    const githubLink = page.getByRole('link', { name: /github/i }).first();
    await expect(githubLink).toHaveAttribute('href', 'https://github.com/erikunha');
  });

  test('LinkedIn CTA link has correct href', async ({ page }) => {
    await page.goto('/');
    const linkedinLink = page.locator('a[href="https://www.linkedin.com/in/erikunha/"]').first();
    await expect(linkedinLink).toBeVisible();
    await expect(linkedinLink).toHaveAttribute('href', 'https://www.linkedin.com/in/erikunha/');
  });

  test('availability badge is visible', async ({ page }) => {
    await page.goto('/');
    const badge = page.locator('[data-testid="hero-desktop"]').getByText('OPEN_TO_RELOCATION');
    await expect(badge).toBeVisible();
  });
});
