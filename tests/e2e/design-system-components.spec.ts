import { test } from '@playwright/test';
import { snapshotLocator } from './_helpers/snapshot';

// Visual baselines for each primitive component.
// Rendered via the /design-system/components route (added in PR C).
// Skipped dynamically when the route is not yet deployed — auto-enables in PR C.
test.describe('design-system components (visual baselines)', () => {
  test.beforeEach(async ({ request }) => {
    const res = await request.get('/design-system/components');
    test.skip(res.status() !== 200, 'components route not yet available');
  });

  test('Button variants', async ({ page }) => {
    await page.goto('/design-system/components#button');
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
});
