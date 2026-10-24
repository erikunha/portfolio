import { expect, test } from '@playwright/test';
import { snapshotLocator } from './_helpers/snapshot';

test.describe('design-system components (visual baselines)', () => {
  test.beforeEach(async ({ request }) => {
    const res = await request.get('/design-system/components');
    test.skip(res.status() !== 200, 'components route not yet available');
  });

  test('Button variants', async ({ page }) => {
    await page.goto('/design-system/components#button');
    const targets = page.locator('#button .btn');
    await expect(targets).toHaveCount(4);
    for (const target of await targets.all()) {
      const bounds = await target.boundingBox();
      expect(bounds?.height).toBeGreaterThanOrEqual(44);
      expect(bounds?.width).toBeGreaterThanOrEqual(44);
    }
    await snapshotLocator(page, page.locator('#button'), 'button-variants.png');
  });

  test('Field states', async ({ page }) => {
    await page.goto('/design-system/components#field');
    await snapshotLocator(page, page.locator('#field'), 'field-states.png');
  });

  test('Badge variants', async ({ page }) => {
    await page.goto('/design-system/components#badge');
    await snapshotLocator(page, page.locator('#badge'), 'badge-variants.png');
  });

  test('TerminalPanel variants', async ({ page }) => {
    await page.goto('/design-system/components#terminal-panel');
    await snapshotLocator(page, page.locator('#terminal-panel'), 'terminal-panel-variants.png');
  });

  test('StatTile variants', async ({ page }) => {
    await page.goto('/design-system/components#stat-tile');
    await snapshotLocator(page, page.locator('#stat-tile'), 'stat-tile-variants.png');
  });

  test('CmdLine variants', async ({ page }) => {
    await page.goto('/design-system/components#cmd-line');
    await snapshotLocator(page, page.locator('#cmd-line'), 'cmd-line-variants.png');
  });

  test('KbdKey variants', async ({ page }) => {
    await page.goto('/design-system/components#kbd-key');
    await snapshotLocator(page, page.locator('#kbd-key'), 'kbd-key-variants.png');
  });

  test('CopyButton variants', async ({ page }) => {
    await page.goto('/design-system/components#copybutton');
    const copy = page.locator('#copybutton').getByRole('button', { name: 'COPY', exact: true });
    const bounds = await copy.boundingBox();
    expect(bounds?.height).toBeGreaterThanOrEqual(44);
    expect(bounds?.width).toBeGreaterThanOrEqual(44);
    await snapshotLocator(page, page.locator('#copybutton'), 'copybutton-variants.png');
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
