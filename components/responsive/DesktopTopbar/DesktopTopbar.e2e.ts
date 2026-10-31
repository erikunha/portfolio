import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 1280, height: 720 } });

test.describe('DesktopTopbar — navigation', () => {
  test('topbar nav is visible on desktop viewport', async ({ page }) => {
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: 'Site navigation' });
    await expect(nav).toBeVisible();
  });

  test('the topbar names every destination in the shared vocabulary', async ({ page }) => {
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: 'Site navigation' });

    for (const label of [
      'ABOUT',
      'WORK',
      'CAREER',
      'CONTACT',
      'DESIGN_SYSTEM',
      'VIEW_CV',
      'HIRE_ON_LINKEDIN',
    ]) {
      await expect(nav.getByRole('link', { name: label })).toBeVisible();
    }
  });

  test('design system link navigates to /design-system', async ({ page }) => {
    await page.goto('/');
    const dsLink = page
      .getByRole('navigation', { name: 'Site navigation' })
      .getByRole('link', { name: 'DESIGN_SYSTEM' });
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

  test('the search trigger opens the section drawer until the palette ships', async ({ page }) => {
    await page.goto('/');
    const search = page.locator('.topbar-search');
    await expect(search).toBeVisible();
    await expect(search).toHaveAttribute('aria-keyshortcuts', 'Control+K Meta+K');

    await search.click();
    await expect(page.getByRole('dialog', { name: 'Section menu' })).toBeVisible();
  });

  test('the hire CTA points at LinkedIn in a new tab', async ({ page }) => {
    await page.goto('/');
    const hire = page
      .getByRole('navigation', { name: 'Site navigation' })
      .getByRole('link', { name: 'HIRE_ON_LINKEDIN' });

    await expect(hire).toHaveAttribute('href', /linkedin\.com\/in\/erikunha/);
    await expect(hire).toHaveAttribute('target', '_blank');
  });
});
