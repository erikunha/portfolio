import { expect, test } from '@playwright/test';

test.describe('CopyButton rendering', () => {
  test('COPY button is visible on the design-system components page', async ({ page }) => {
    await page.goto('/design-system/components');
    const button = page.locator('#copybutton').getByRole('button', { name: 'COPY', exact: true });
    await expect(button).toBeVisible();
    await expect(button).toHaveCSS('min-height', '44px');
    await expect(button).toHaveCSS('min-width', '44px');
    const bounds = await button.boundingBox();
    expect(bounds?.height).toBeGreaterThanOrEqual(44);
    expect(bounds?.width).toBeGreaterThanOrEqual(44);
  });
});

test.describe('CopyButton state machine', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(Navigator.prototype, 'clipboard', {
        get: () => ({ writeText: () => Promise.resolve() }),
        configurable: true,
      });
    });
  });

  test('clicking copy button changes label to COPIED', async ({ page }) => {
    await page.goto('/design-system/components');
    const firstCopyBtn = page
      .getByRole('button')
      .filter({ hasText: /^(COPY|COPIED)$/ })
      .first();
    await firstCopyBtn.click();
    await expect(firstCopyBtn).toHaveText('COPIED');
    await expect(firstCopyBtn.locator('..').getByRole('status')).toContainText(
      'Copied to clipboard.',
    );
    const bounds = await firstCopyBtn.boundingBox();
    expect(bounds?.height).toBeGreaterThanOrEqual(44);
    expect(bounds?.width).toBeGreaterThanOrEqual(44);
  });

  test('copy button returns to COPY label after timeout', async ({ page }) => {
    await page.goto('/design-system/components');
    const firstCopyBtn = page
      .getByRole('button')
      .filter({ hasText: /^(COPY|COPIED)$/ })
      .first();
    await firstCopyBtn.click();
    await expect(firstCopyBtn).toHaveText('COPIED');
    await expect(firstCopyBtn).toHaveText('COPY', { timeout: 3000 });
  });
});

for (const outcome of ['rejected', 'unavailable'] as const) {
  test(`CopyButton announces ${outcome} clipboard access`, async ({ page }) => {
    await page.addInitScript((state) => {
      Object.defineProperty(Navigator.prototype, 'clipboard', {
        configurable: true,
        get: () =>
          state === 'unavailable'
            ? undefined
            : {
                writeText: () => Promise.reject(new Error('Clipboard denied')),
              },
      });
    }, outcome);
    await page.goto('/design-system/components');
    const preview = page.locator('#copybutton');
    const button = preview.getByRole('button', { name: 'COPY', exact: true });
    await button.click();
    await expect(button).toHaveText(outcome === 'rejected' ? 'COPY FAILED' : 'COPY UNAVAILABLE');
    await expect(preview.getByRole('status')).toContainText('Select and copy the text manually.');
    const bounds = await button.boundingBox();
    expect(bounds?.height).toBeGreaterThanOrEqual(44);
    expect(bounds?.width).toBeGreaterThanOrEqual(44);
  });
}

for (const width of [375, 767, 768, 1280]) {
  test(`CopyButton target and type at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 812 });
    await page.goto('/design-system/components');
    const button = page.locator('#copybutton').getByRole('button', { name: 'COPY', exact: true });
    await expect(button).toBeVisible();
    const bounds = await button.boundingBox();
    expect(bounds?.height).toBeGreaterThanOrEqual(44);
    expect(bounds?.width).toBeGreaterThanOrEqual(44);
    const fontSize = await button.evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).fontSize),
    );
    expect(fontSize).toBeGreaterThanOrEqual(width >= 768 ? 13 : 12);
  });
}
