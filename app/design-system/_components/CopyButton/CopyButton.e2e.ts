import { expect, test } from '@playwright/test';

test.describe('CopyButton — clipboard interaction', () => {
  test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

  test('clicking copy button changes label to COPIED', async ({ page }) => {
    await page.goto('/design-system/components');
    const firstCopyBtn = page.getByRole('button', { name: 'COPY' }).first();
    await expect(firstCopyBtn).toBeVisible();
    await firstCopyBtn.click();
    await expect(firstCopyBtn).toHaveText('COPIED');
  });

  test('copy button returns to COPY label after timeout', async ({ page }) => {
    await page.goto('/design-system/components');
    const firstCopyBtn = page.getByRole('button', { name: 'COPY' }).first();
    await firstCopyBtn.click();
    await expect(firstCopyBtn).toHaveText('COPIED');
    await expect(firstCopyBtn).toHaveText('COPY', { timeout: 3000 });
  });
});
