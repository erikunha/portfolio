import { expect, test } from '@playwright/test';

test.describe('Button behavioral E2E', () => {
  test('primary button is visible and keyboard-focusable', async ({ page }) => {
    await page.goto('/design-system/components');
    const preview = page.locator('#button');
    await expect(preview).toBeVisible();
    const primary = preview.getByRole('link', { name: 'EXEC_HIRE' });
    await expect(primary).toBeVisible();
    for (let step = 0; step < 40; step++) {
      await page.keyboard.press('Tab');
      if (await primary.evaluate((element) => element === document.activeElement)) break;
    }
    await expect(primary).toBeFocused();
  });

  test('secondary button is visible', async ({ page }) => {
    await page.goto('/design-system/components');
    const preview = page.locator('#button');
    const secondary = preview.getByRole('link', { name: 'DOWNLOAD_CV' });
    await expect(secondary).toBeVisible();
  });

  test('sm size keeps a 44px target', async ({ page }) => {
    await page.goto('/design-system/components');
    const preview = page.locator('#button');
    const small = preview.getByRole('link', { name: 'SM', exact: true });
    await expect(small).toBeVisible();
    await expect(small).toHaveCSS('min-height', '44px');
    await expect(small).toHaveCSS('padding-left', '10px');
    const bounds = await small.boundingBox();
    expect(bounds?.height).toBeGreaterThanOrEqual(44);
    expect(bounds?.width).toBeGreaterThanOrEqual(44);
  });

  test('lg size variant renders', async ({ page }) => {
    await page.goto('/design-system/components');
    const preview = page.locator('#button');
    await expect(preview.getByRole('link', { name: 'LG' })).toBeVisible();
  });
});

for (const width of [375, 767, 768, 1280]) {
  test(`Button targets and type at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 812 });
    await page.goto('/design-system/components');
    const buttons = page.locator('#button .btn');
    await expect(buttons).toHaveCount(4);
    for (const button of await buttons.all()) {
      const bounds = await button.boundingBox();
      expect(bounds?.height).toBeGreaterThanOrEqual(44);
      expect(bounds?.width).toBeGreaterThanOrEqual(44);
      const fontSize = await button.evaluate((element) =>
        Number.parseFloat(getComputedStyle(element).fontSize),
      );
      expect(fontSize).toBeGreaterThanOrEqual(width >= 768 ? 13 : 12);
    }
  });
}
