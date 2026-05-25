import { expect, test } from '@playwright/test';

test.describe('StatTile — behavioral E2E', () => {
  test('renders as a definition list (dl > dt + dd)', async ({ page }) => {
    await page.goto('/design-system/components');
    const preview = page.locator('#stat-tile');
    await expect(preview).toBeVisible();
    const dl = preview.locator('dl').first();
    await expect(dl).toBeVisible();
    await expect(dl.locator('dt').first()).toBeVisible();
    await expect(dl.locator('dd').first()).toBeVisible();
  });

  test('value and label are rendered with correct text', async ({ page }) => {
    await page.goto('/design-system/components');
    const preview = page.locator('#stat-tile');
    await expect(preview.getByText('99')).toBeVisible();
    await expect(preview.getByText('LH_SCORE')).toBeVisible();
  });

  test('compact variant renders its value and label', async ({ page }) => {
    await page.goto('/design-system/components');
    const preview = page.locator('#stat-tile');
    await expect(preview.getByText('1.2s')).toBeVisible();
    await expect(preview.getByText('LCP')).toBeVisible();
  });
});
