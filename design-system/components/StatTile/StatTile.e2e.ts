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
    // Scope to dd to avoid matching code-example text nodes on the same page.
    await expect(preview.locator('dd').getByText('99').first()).toBeVisible();
    await expect(preview.locator('dt').getByText('LH_SCORE').first()).toBeVisible();
  });

  test('compact variant renders its value and label', async ({ page }) => {
    await page.goto('/design-system/components');
    const preview = page.locator('#stat-tile');
    // Scope to dd/dt to avoid matching code-example text nodes on the same page.
    await expect(preview.locator('dd').getByText('1.2s').first()).toBeVisible();
    await expect(preview.locator('dt').getByText('LCP').first()).toBeVisible();
  });
});
