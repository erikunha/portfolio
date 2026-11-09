import { expect, test } from '@playwright/test';

const TABBABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select, textarea, summary, [tabindex]:not([tabindex="-1"])';

const TAB_KEYS = ['Tab', 'Alt+Tab'];

const SIGNAL_RGB = 'rgb(0, 255, 65)';
const SUBTLE_RGBA = 'rgba(0, 255, 65, 0.4)';

test.describe('Button behavioral E2E', () => {
  test('primary button is visible and keyboard-focusable', async ({ page }) => {
    await page.goto('/design-system/components');
    const preview = page.locator('#button');
    await expect(preview).toBeVisible();
    const primary = preview.getByRole('link', { name: 'EXEC_HIRE' });
    await expect(primary).toBeVisible();
    const tabStops = await page.locator(TABBABLE_SELECTOR).count();
    for (const tabKey of TAB_KEYS) {
      for (let step = 0; step < tabStops; step++) {
        if (await primary.evaluate((element) => element === document.activeElement)) break;
        await page.keyboard.press(tabKey);
      }
    }
    await expect(
      primary,
      'Safari and WebKit skip links on plain Tab unless the system setting is on; its users reach links with Option+Tab, so the sweep retries with Alt+Tab',
    ).toBeFocused();
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

  test('primary draws its border in the signal color and secondary in the subtle stop', async ({
    page,
  }) => {
    await page.goto('/design-system/components');
    const preview = page.locator('#button');
    await expect(preview).toBeVisible();
    await expect(preview.getByRole('link', { name: 'EXEC_HIRE' })).toHaveCSS(
      'border-top-color',
      SIGNAL_RGB,
    );
    await expect(preview.getByRole('link', { name: 'DOWNLOAD_CV' })).toHaveCSS(
      'border-top-color',
      SUBTLE_RGBA,
    );
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
