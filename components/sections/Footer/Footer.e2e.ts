import { expect, test } from '@playwright/test';

async function loadFooter(page: import('@playwright/test').Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.locator('footer').scrollIntoViewIfNeeded();
  await expect(
    page.locator('footer').getByRole('link', { name: 'press R to reboot, back to top' }),
  ).toBeVisible();
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
    await expect(tree.locator('a[href="/cv"], a[href="/summary"]')).toHaveCount(0);
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
    await page.getByRole('link', { name: 'press R to reboot, back to top' }).click();
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
    await page.getByRole('link', { name: 'press R to reboot, back to top' }).focus();
    for (const key of ['Shift+r', 'Alt+r', 'Control+Alt+r', 'Meta+Alt+r']) {
      await page.keyboard.press(key);
      await expect(status).toBeEmpty();
    }
    await page.keyboard.press('r');
    await expect(page.locator('h1')).toBeFocused();
    await expect(status).toHaveText(/rebooted/i);
  });

  test('COPY copies netstat rows and the R key has a 44px computed target', async ({
    page,
    context,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'Clipboard permissions require Chromium.');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await loadFooter(page);
    const netstat = page.locator('.footer-netstat');
    const rows = await netstat.locator('tbody tr').allTextContents();
    const expected = await netstat
      .locator('tbody tr')
      .evaluateAll((elements) =>
        elements
          .map((row) => [...row.querySelectorAll('td')].map((cell) => cell.textContent).join('  '))
          .join('\n'),
      );
    expect(rows).toHaveLength(4);
    const copy = page.getByRole('button', { name: 'Copy netstat rows' });
    await copy.click();
    await expect(copy).toHaveText('COPIED');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(expected);
    for (const target of [copy, page.locator('.footer-reboot kbd')]) {
      const size = await target.evaluate((element) => {
        const style = getComputedStyle(element);
        return { width: Number.parseFloat(style.width), height: Number.parseFloat(style.height) };
      });
      expect(size.width).toBeGreaterThanOrEqual(44);
      expect(size.height).toBeGreaterThanOrEqual(44);
    }
  });

  test('mobile footer keeps its measured height with a one-column site map and netstat on one line', async ({
    page,
  }) => {
    for (const width of [390, 1280]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 720 });
      await loadFooter(page);
      await page.evaluate(() => document.fonts.ready);
      if (width === 390) {
        const footer = await page.locator('footer').boundingBox();
        expect(footer?.height).toBeGreaterThanOrEqual(1905);
        expect(footer?.height).toBeLessThanOrEqual(1945);
      }
      const cells = page.locator('.footer-netstat :is(th, td)');
      for (const cell of await cells.all()) {
        const metrics = await cell.evaluate((element) => {
          const range = document.createRange();
          range.selectNodeContents(element.firstElementChild ?? element);
          return {
            lines: range.getClientRects().length,
            width: element.clientWidth,
            contentWidth: element.scrollWidth,
          };
        });
        expect(metrics.lines).toBe(1);
        expect(metrics.contentWidth).toBeLessThanOrEqual(metrics.width);
      }
    }
  });

  test('netstat endpoints wrap instead of clipping at 320px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await loadFooter(page);
    for (const cell of await page.locator('.footer-netstat td:last-child').all()) {
      const fit = await cell.evaluate((element) => element.scrollWidth <= element.clientWidth);
      expect(fit).toBe(true);
    }
  });

  test('tree links keep 44px targets in six desktop, three tablet and one mobile column', async ({
    page,
  }) => {
    const expectedColumns: Record<number, number> = { 1280: 6, 768: 3, 390: 1, 320: 1 };
    for (const width of [1280, 768, 390, 320]) {
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
      expect(columns).toBe(expectedColumns[width]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width,
      );
    }
  });
});
