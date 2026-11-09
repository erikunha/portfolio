import { expect, test } from '@playwright/test';

test.describe('KbdKey behavioral E2E', () => {
  test('a key cap is not interactive: no pointer cursor and no hover glow', async ({ page }) => {
    await page.goto('/design-system/components');
    const key = page.locator('#kbd-key kbd').first();
    await expect(key).toBeVisible();
    await expect(key).not.toHaveCSS('cursor', 'pointer');
    const restingShadow = await key.evaluate((node) => getComputedStyle(node).boxShadow);
    await key.hover();
    await expect(key).toHaveCSS('box-shadow', restingShadow);
  });

  test('sm and md keep their own side padding', async ({ page }) => {
    await page.goto('/design-system/components');
    const preview = page.locator('#kbd-key');
    await expect(preview.locator('kbd').filter({ hasText: /^Enter$/ })).toHaveCSS(
      'padding-left',
      '4px',
    );
    await expect(preview.locator('kbd').filter({ hasText: /^Ctrl$/ })).toHaveCSS(
      'padding-left',
      '6px',
    );
  });
});
