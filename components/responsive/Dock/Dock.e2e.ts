import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 375, height: 812 } });

test.describe('Dock — mobile navigation', () => {
  test('dock is visible on mobile viewport', async ({ page }) => {
    await page.goto('/');
    const dock = page.getByRole('navigation', { name: 'primary' });
    await expect(dock).toBeVisible();
  });

  test('dock items are tappable links', async ({ page }) => {
    await page.goto('/');
    const dock = page.getByRole('navigation', { name: 'primary' });
    const links = dock.getByRole('link');
    await expect(links.first()).toBeVisible();
  });

  test('DS dock item navigates to /design-system', async ({ page }) => {
    await page.goto('/');
    const dock = page.getByRole('navigation', { name: 'primary' });
    const dsLink = dock.getByRole('link', { name: 'DS' });
    await dsLink.click();
    await expect(page).toHaveURL('/design-system');
  });

  test('dock contains expected navigation items', async ({ page }) => {
    await page.goto('/');
    const dock = page.getByRole('navigation', { name: 'primary' });
    await expect(dock.getByRole('link', { name: 'HOME' })).toBeVisible();
    await expect(dock.getByRole('link', { name: 'WORK' })).toBeVisible();
    await expect(dock.getByRole('link', { name: 'DS' })).toBeVisible();
  });
});
