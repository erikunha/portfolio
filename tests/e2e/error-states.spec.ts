import { expect, test } from '@playwright/test';

const MISSING_ROUTE = '/this-route-does-not-exist';
const NOT_FOUND_STATUS = 404;

test.describe('404 route', () => {
  test('answers with status 404 and the r106 content', async ({ page }) => {
    const response = await page.goto(MISSING_ROUTE);
    expect(response?.status()).toBe(NOT_FOUND_STATUS);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('404');
    await expect(page.getByText('[ NOT FOUND ]')).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Suggested pages' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Go home' })).toHaveAttribute('href', '/');
  });

  test('Go home returns to the portfolio', async ({ page }) => {
    await page.goto(MISSING_ROUTE);
    await page.getByRole('link', { name: 'Go home' }).click();
    await page.waitForURL('**/');
    await expect(page.locator('[data-testid="hero-name"]').first()).toBeAttached();
  });

  test('puts keyboard focus on the heading', async ({ page }) => {
    await page.goto(MISSING_ROUTE);
    await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  });
});
