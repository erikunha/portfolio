import { expect, test } from '@playwright/test';

const SIGNAL_RGB = 'rgb(0, 255, 65)';
const ERROR_BORDER_RGB = 'rgb(255, 138, 138)';

test.describe('Field behavioral E2E', () => {
  test('resting borders use the signal color so the edge meets 3:1 on black', async ({ page }) => {
    await page.goto('/design-system/components');
    const preview = page.locator('#field');
    await expect(preview).toBeVisible();
    await expect(preview.getByRole('textbox', { name: '$ email:' })).toHaveCSS(
      'border-top-color',
      SIGNAL_RGB,
    );
    await expect(preview.getByRole('textbox', { name: '$ message:' })).toHaveCSS(
      'border-top-color',
      SIGNAL_RGB,
    );
  });

  test('an errored field keeps the error border instead of the signal', async ({ page }) => {
    await page.goto('/design-system/components');
    const broken = page.locator('#field').getByRole('textbox', { name: '$ broken:' });
    await expect(broken).toHaveAttribute('aria-invalid', 'true');
    await expect(broken).toHaveCSS('border-top-color', ERROR_BORDER_RGB);
  });

  test('every field on the page has a unique id', async ({ page }) => {
    await page.goto('/design-system/components');
    const ids = await page
      .locator('#field input, #field textarea')
      .evaluateAll((nodes) => nodes.map((node) => node.id));
    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
