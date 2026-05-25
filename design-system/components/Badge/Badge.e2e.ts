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
    await expect(preview.getByText('OPEN_TO_WORK')).toBeVisible();
  });

  test('default variant renders without a dot span', async ({ page }) => {
    await page.goto('/design-system/components');
    const preview = page.locator('#badge');
    const availableBadge = preview.getByText('AVAILABLE');
    await expect(availableBadge).toBeVisible();
    // Default variant must not render a decorative dot.
    await expect(
      availableBadge.locator('xpath=..').locator('span[aria-hidden="true"]'),
    ).not.toBeAttached();
  });
});
