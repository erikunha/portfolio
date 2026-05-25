import { expect, test } from '@playwright/test';

test.describe('Button — behavioral E2E', () => {
  test('primary button is visible and keyboard-focusable', async ({ page }) => {
    await page.goto('/design-system/components');
    const preview = page.locator('#button');
    await expect(preview).toBeVisible();
    const primary = preview.getByRole('link', { name: 'EXEC_HIRE' });
    await expect(primary).toBeVisible();
    await primary.focus();
    await expect(primary).toBeFocused();
  });

  test('secondary button is visible', async ({ page }) => {
    await page.goto('/design-system/components');
    const preview = page.locator('#button');
    const secondary = preview.getByRole('link', { name: 'DOWNLOAD_CV' });
    await expect(secondary).toBeVisible();
  });

  test('sm size variant renders', async ({ page }) => {
    await page.goto('/design-system/components');
    const preview = page.locator('#button');
    await expect(preview.getByRole('link', { name: 'SM' })).toBeVisible();
  });

  test('lg size variant renders', async ({ page }) => {
    await page.goto('/design-system/components');
    const preview = page.locator('#button');
    await expect(preview.getByRole('link', { name: 'LG' })).toBeVisible();
  });
});
