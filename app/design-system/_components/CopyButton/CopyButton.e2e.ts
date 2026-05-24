import { expect, test } from '@playwright/test';

// Two issues to address:
// 1. navigator.clipboard.writeText throws DOMException in headless Chromium
//    (document not OS-focused). We override the getter on Navigator.prototype
//    after page load so React's onClick sees a working mock.
// 2. getByRole('button', { name: 'COPY' }) re-evaluates lazily — once the
//    button shows 'COPIED' its accessible name changes and .first() shifts to
//    the next button still labelled 'COPY'. Fix: anchor on the CSS class which
//    doesn't change with state. State-machine coverage lives in CopyButton.test.tsx.

async function mockClipboard(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    const mock = { writeText: () => Promise.resolve() };
    Object.defineProperty(Navigator.prototype, 'clipboard', {
      get: () => mock,
      configurable: true,
    });
  });
}

test.describe('CopyButton — rendering and interaction', () => {
  test('COPY button is visible on the design-system components page', async ({ page }) => {
    await page.goto('/design-system/components');
    await expect(page.getByRole('button', { name: 'COPY' }).first()).toBeVisible();
  });

  test('clicking copy button changes label to COPIED', async ({ page }) => {
    await page.goto('/design-system/components');
    await mockClipboard(page);
    const firstCopyBtn = page.locator('[class*="CopyButton"]').first();
    await firstCopyBtn.click();
    await expect(firstCopyBtn).toHaveText('COPIED');
  });

  test('copy button returns to COPY label after timeout', async ({ page }) => {
    await page.goto('/design-system/components');
    await mockClipboard(page);
    const firstCopyBtn = page.locator('[class*="CopyButton"]').first();
    await firstCopyBtn.click();
    await expect(firstCopyBtn).toHaveText('COPIED');
    await expect(firstCopyBtn).toHaveText('COPY', { timeout: 3000 });
  });
});
