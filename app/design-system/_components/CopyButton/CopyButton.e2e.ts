import { expect, test } from '@playwright/test';

// navigator.clipboard.writeText throws DOMException in headless Chromium
// (document not OS-focused). Override the getter on Navigator.prototype via
// addInitScript so the mock is in place before any page script runs.
//
// Locator strategy: getByRole('button').filter({ hasText: /^(COPY|COPIED)$/ })
// is stable through text-content changes because the regex matches both states.
// getByRole('button', { name: 'COPY' }).first() re-evaluates lazily and shifts
// to the NEXT button once the clicked one shows 'COPIED'. State-machine
// coverage lives in CopyButton.test.tsx.

test.describe('CopyButton — rendering', () => {
  test('COPY button is visible on the design-system components page', async ({ page }) => {
    await page.goto('/design-system/components');
    await expect(page.getByRole('button', { name: 'COPY' }).first()).toBeVisible();
  });
});

test.describe('CopyButton — state machine', () => {
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
