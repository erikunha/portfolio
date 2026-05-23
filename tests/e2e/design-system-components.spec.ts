import { expect, test } from '@playwright/test';

// Visual baselines for each primitive component.
// Rendered via the /design-system/components route (added in PR C).
// Skipped until that route exists — activate in PR C.
test.describe('design-system components (visual baselines)', () => {
  test.skip(true, 'components route not yet available — enable in PR C');

  test('Button variants', async ({ page }) => {
    await page.goto('/design-system/components#button');
    await expect(page.locator('#button')).toHaveScreenshot('button-variants.png');
  });

  test('Field states', async ({ page }) => {
    await page.goto('/design-system/components#field');
    await expect(page.locator('#field')).toHaveScreenshot('field-states.png');
  });

  test('Badge variants', async ({ page }) => {
    await page.goto('/design-system/components#badge');
    await expect(page.locator('#badge')).toHaveScreenshot('badge-variants.png');
  });

  test('TerminalPanel variants', async ({ page }) => {
    await page.goto('/design-system/components#terminal-panel');
    await expect(page.locator('#terminal-panel')).toHaveScreenshot('terminal-panel-variants.png');
  });

  test('StatTile variants', async ({ page }) => {
    await page.goto('/design-system/components#stat-tile');
    await expect(page.locator('#stat-tile')).toHaveScreenshot('stat-tile-variants.png');
  });

  test('CmdLine variants', async ({ page }) => {
    await page.goto('/design-system/components#cmd-line');
    await expect(page.locator('#cmd-line')).toHaveScreenshot('cmd-line-variants.png');
  });

  test('KbdKey variants', async ({ page }) => {
    await page.goto('/design-system/components#kbd-key');
    await expect(page.locator('#kbd-key')).toHaveScreenshot('kbd-key-variants.png');
  });
});
