import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 1280, height: 720 } });

test.describe('DesktopTopbar — navigation', () => {
  test('topbar nav is visible on desktop viewport', async ({ page }) => {
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: 'Site navigation' });
    await expect(nav).toBeVisible();
  });

  test('design system link navigates to /design-system', async ({ page }) => {
    await page.goto('/');
    const dsLink = page.getByRole('link', { name: 'DESIGN_SYSTEM' });
    await dsLink.click();
    await expect(page).toHaveURL('/design-system');
  });

  test('topbar nav links are keyboard-focusable', async ({ page }) => {
    await page.goto('/');
    const firstLink = page
      .getByRole('navigation', { name: 'Site navigation' })
      .getByRole('link')
      .first();
    await firstLink.focus();
    await expect(firstLink).toBeFocused();
  });

  test('motion toggle button is present', async ({ page }) => {
    await page.goto('/');
    const motionBtn = page.getByRole('button', { name: /motion/i });
    await expect(motionBtn).toBeVisible();
  });
});
