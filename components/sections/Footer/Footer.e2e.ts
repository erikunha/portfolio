import { expect, test } from '@playwright/test';

async function loadFooter(page: import('@playwright/test').Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.locator('footer').scrollIntoViewIfNeeded();
  await expect(page.locator('footer').getByRole('link', { name: 'Reboot to top' })).toBeVisible();
}

test.describe('Footer', () => {
  test('renders the site tree and working anchor links without JavaScript', async ({
    browser,
    baseURL,
  }) => {
    if (!baseURL) throw new Error('Footer e2e requires the configured baseURL.');
    const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
    const page = await context.newPage();
    await page.goto('/');
    const tree = page.getByRole('navigation', { name: 'Site map' });
    await expect(tree.locator('.sm-groups > li')).toHaveCount(6);
    await tree.getByRole('link', { name: 'Projects', exact: true }).click();
    await expect(page).toHaveURL(/#sec-projects$/);
    await expect(page.locator('#sec-projects')).toBeInViewport();
    await expect(tree.getByRole('link', { name: 'VIEW_CV' })).toHaveAttribute('href', '/cv');
    await expect(tree.getByRole('link', { name: '30S_SUMMARY' })).toHaveAttribute(
      'href',
      '/summary',
    );
    await expect(tree.getByRole('link', { name: 'Contact', exact: true })).toHaveAttribute(
      'href',
      '#sec-contact',
    );
    await page.setViewportSize({ width: 390, height: 812 });
    await tree.getByRole('link', { name: 'Home', exact: true }).click();
    await expect(page).toHaveURL(/#main-content$/);
    await expect(page.getByTestId('hero-mobile')).toBeInViewport();
    await context.close();
  });

  test('reboots in place, focuses the top heading and preserves command totals', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const input = page.getByRole('textbox', { name: 'shell command', exact: true });
    await input.fill('help');
    await input.press('Enter');
    const commands = page.locator('[data-sess="commands"]');
    await expect(commands).toHaveText('1');
    await page.locator('footer').scrollIntoViewIfNeeded();
    const navigationStart = await page.evaluate(() => performance.timeOrigin);
    await page.getByRole('link', { name: 'Reboot to top' }).click();
    await expect(page.locator('h1')).toBeFocused();
    await expect(page.locator('[data-testid="footer-reboot-status"]')).toHaveText(/rebooted/i);
    expect(await page.evaluate(() => performance.timeOrigin)).toBe(navigationStart);
    await expect(commands).toHaveText('1');
    expect(await page.evaluate(() => scrollY)).toBeLessThan(100);
  });

  test('R ignores editable targets and modifier keys, then reboots from the footer', async ({
    page,
  }) => {
    await loadFooter(page);
    const status = page.locator('[data-testid="footer-reboot-status"]');
    const input = page.getByRole('textbox', { name: 'shell command', exact: true });
    await input.fill('');
    await input.press('r');
    await expect(input).toHaveValue('r');
    await expect(input).toBeFocused();
    await expect(status).toBeEmpty();
    await page.getByRole('link', { name: 'Reboot to top' }).focus();
    for (const key of ['Shift+r', 'Alt+r', 'Control+Alt+r', 'Meta+Alt+r']) {
      await page.keyboard.press(key);
      await expect(status).toBeEmpty();
    }
    await page.keyboard.press('r');
    await expect(page.locator('h1')).toBeFocused();
    await expect(status).toHaveText(/rebooted/i);
  });

  test('tree links have 44px targets and six desktop or two mobile columns', async ({ page }) => {
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 812 });
      await loadFooter(page);
      const tree = page.getByRole('navigation', { name: 'Site map' });
      for (const link of await tree.getByRole('link').all()) {
        const box = await link.boundingBox();
        expect(box?.height).toBeGreaterThanOrEqual(44);
        expect(box?.width).toBeGreaterThanOrEqual(44);
      }
      const columns = await tree
        .locator('.sm-groups')
        .evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').length);
      expect(columns).toBe(width === 1280 ? 6 : 2);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width,
      );
    }
  });
});
