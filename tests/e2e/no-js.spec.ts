import { expect, test } from '@playwright/test';

test.use({ javaScriptEnabled: false });

test.describe('home with JavaScript off', () => {
  test('shows the notice and keeps the static content readable', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/This site works best with JavaScript/)).toBeVisible();
    await expect(page.locator('#main-content')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  });

  test('the site navigation still moves to its section', async ({ page }) => {
    await page.goto('/');
    // The noscript bar link is the one contact route at every breakpoint; the dock HIRE leaves the site.
    await page.locator('.nojs-bar a[href="/#sec-contact"]').click();
    await expect(page).toHaveURL(/#sec-contact$/);
    await expect(page.locator('#sec-contact')).toBeAttached();
  });

  test('the notice clears the fixed desktop chrome instead of covering it', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');
    const topbar = await page.locator('.desktop-topbar').boundingBox();
    const bar = await page.locator('.nojs-bar').boundingBox();
    expect(topbar).not.toBeNull();
    expect(bar).not.toBeNull();
    expect(bar!.y).toBeGreaterThanOrEqual(topbar!.y + topbar!.height);
    await expect(page.locator('.desktop-topbar').getByText('ERIK_CUNHA.SH')).toBeInViewport();
    const rail = await page.locator('.section-menu').boundingBox();
    if (rail) expect(bar!.x).toBeGreaterThanOrEqual(rail.x + 56);
  });

  test('the notice clears the pinned-open rail at wide desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.goto('/');
    const bar = await page.locator('.nojs-bar').boundingBox();
    const rail = await page.locator('.section-menu').boundingBox();
    expect(bar).not.toBeNull();
    expect(rail).not.toBeNull();
    expect(bar!.x).toBeGreaterThanOrEqual(rail!.x + rail!.width);
  });
});
