import { expect, test } from '@playwright/test';

const SCROLL_PROBE_PX = 400;

test.describe('section navigation: drawer at 390px', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('the dock has one grid column per control', async ({ page }) => {
    await page.goto('/');
    const dock = page.getByRole('navigation', { name: 'primary' });
    await expect(dock).toBeVisible();
    const controls = await dock.locator('> a, > button').count();
    const columns = await dock.evaluate(
      (element) => getComputedStyle(element).gridTemplateColumns.split(' ').length,
    );
    expect(controls).toBeGreaterThan(0);
    expect(columns).toBe(controls);
  });

  test('the open drawer locks page scrolling and closing releases it', async ({ page }) => {
    await page.goto('/');
    const menu = page
      .getByRole('navigation', { name: 'primary' })
      .getByRole('button', { name: /^MENU/ });
    await menu.click();
    await expect(page.getByRole('dialog', { name: 'Section menu' })).toBeVisible();
    await expect(page.locator('html')).toHaveCSS('overflow', 'hidden');
    await page.mouse.move(200, 400);
    await page.mouse.wheel(0, SCROLL_PROBE_PX);
    await page.evaluate(() => window.scrollBy(0, 0));
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('html')).not.toHaveCSS('overflow', 'hidden');
    await page.mouse.wheel(0, SCROLL_PROBE_PX);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  });
});

test.describe('section navigation: position line at 1280px', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test('the line never intercepts pointer events', async ({ page }) => {
    await page.goto('/');
    const bar = page.getByRole('progressbar', { name: 'Page position' });
    await expect(bar).toHaveCSS('pointer-events', 'none');
  });
});
