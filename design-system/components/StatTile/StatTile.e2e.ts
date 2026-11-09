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
    await expect(preview.locator('dd').getByText('99').first()).toBeVisible();
    await expect(preview.locator('dt').getByText('LH_SCORE').first()).toBeVisible();
  });

  test('compact variant renders its value and label', async ({ page }) => {
    await page.goto('/design-system/components');
    const preview = page.locator('#stat-tile');
    await expect(preview.locator('dd').getByText('1.2s').first()).toBeVisible();
    await expect(preview.locator('dt').getByText('LCP').first()).toBeVisible();
  });
});

for (const width of [767, 768, 1280]) {
  test(`StatTile reading order and type at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 812 });
    await page.goto('/design-system/components');
    const tiles = page.locator('#stat-tile dl');
    await expect(tiles).toHaveCount(3);
    for (const tile of await tiles.all()) {
      const label = tile.locator('dt');
      await expect(tile.locator(':scope > :first-child')).toHaveJSProperty('tagName', 'DT');
      await expect(label).toHaveCSS('color', 'rgb(161, 179, 161)');
      await expect(label).toHaveCSS('opacity', '1');
      const sizes = await tile
        .locator('dt, dd')
        .evaluateAll((elements) =>
          elements.map((element) => Number.parseFloat(getComputedStyle(element).fontSize)),
        );
      expect(sizes.every((size) => size >= (width >= 768 ? 13 : 12))).toBe(true);
    }
    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toHaveCSS('font-weight', '900');
    const fontFamily = await heading.evaluate((element) => getComputedStyle(element).fontFamily);
    expect(fontFamily).toContain('display');
  });
}
