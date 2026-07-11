import { expect, test } from '@playwright/test';

test.describe('Badge — behavioral E2E', () => {
  test('dot variant renders with aria-hidden dot span', async ({ page }) => {
    await page.goto('/design-system/components');
    const preview = page.locator('#badge');
    await expect(preview).toBeVisible();
    const dot = preview.locator('span[aria-hidden="true"]').first();
    await expect(dot).toBeAttached();
  });

  test('dot badge text is visible to assistive technology', async ({ page }) => {
    await page.goto('/design-system/components');
    const preview = page.locator('#badge');
    await expect(preview.locator('span').getByText('OPEN_TO_WORK').first()).toBeVisible();
  });

  test('default variant renders without a dot span', async ({ page }) => {
    await page.goto('/design-system/components');
    const preview = page.locator('#badge');
    const availableBadge = preview
      .locator('span')
      .filter({ hasText: /^AVAILABLE$/ })
      .filter({ hasNot: page.locator('span[aria-hidden="true"]') });
    await expect(availableBadge).toBeVisible();
    await expect(availableBadge.locator('span[aria-hidden="true"]')).not.toBeAttached();
  });
});
