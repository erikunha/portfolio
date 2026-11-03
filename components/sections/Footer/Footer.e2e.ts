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
    await expect(tree.getByRole('link', { name: '30S_SUMMARY', exact: true })).toHaveAttribute(
      'href',
      '/summary',
    );
    await expect(tree.getByRole('link', { name: 'VIEW_CV', exact: true })).toHaveAttribute(
      'href',
      '/cv',
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
    await page.getByRole('link', { name: 'press R to reboot, back to top' }).click();
    await expect(page.locator('[data-testid="hero-name"]:visible')).toBeFocused();
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
    await expect(page.locator('[data-testid="hero-name"]:visible')).toBeFocused();
    await expect(status).toHaveText(/rebooted/i);
  });

  test('every netstat endpoint is a link to its destination and the R key has a 44px target', async ({
    page,
  }) => {
    await loadFooter(page);
    const netstat = page.locator('.footer-netstat');
    const rows = await netstat.locator('tbody tr').allTextContents();
    expect(rows).toHaveLength(4);
    const endpoints = netstat.locator('tbody tr td:last-child a');
    await expect(endpoints).toHaveCount(4);
    const hrefs = await endpoints.evaluateAll((links) =>
      links.map((link) => link.getAttribute('href')),
    );
    expect(hrefs).toEqual([
      'https://github.com/erikunha',
      'https://www.linkedin.com/in/erikunha/',
      'https://www.erikunha.dev',
      '/design-system',
    ]);
    for (const glyph of await endpoints.locator('.footer-link-glyph').all()) {
      await expect(glyph).toHaveText('↗');
    }
    await expect(
      page.getByRole('button', { name: 'Copy netstat rows' }),
      'the netstat table links out, it does not copy',
    ).toHaveCount(0);
    const size = await page.locator('.footer-reboot kbd').evaluate((element) => {
      const style = getComputedStyle(element);
      return { width: Number.parseFloat(style.width), height: Number.parseFloat(style.height) };
    });
    expect(size.width).toBeGreaterThanOrEqual(44);
    expect(size.height).toBeGreaterThanOrEqual(44);
  });

  test('mobile footer keeps its measured height with a one-column site map and netstat on one line', async ({
    browser,
  }) => {
    for (const width of [390, 1280]) {
      const isPhone = width === 390;
      const context = await browser.newContext({
        viewport: { width, height: isPhone ? 844 : 720 },
        hasTouch: isPhone,
        isMobile: isPhone,
      });
      const page = await context.newPage();
      await loadFooter(page);
      await page.evaluate(() => document.fonts.ready);
      if (width === 390) {
        const footer = await page.locator('footer').boundingBox();
        expect(footer?.height).toBeGreaterThanOrEqual(2050);
        expect(footer?.height).toBeLessThanOrEqual(2150);
      }
      const cells = page.locator('.footer-netstat :is(th, td)');
      for (const cell of await cells.all()) {
        const metrics = await cell.evaluate((element) => {
          const range = document.createRange();
          let lines = 0;
          let labelTop = 0;
          const walk = (node: Node) => {
            for (const child of node.childNodes) {
              if (child.nodeType === Node.ELEMENT_NODE) {
                if ((child as Element).getAttribute('aria-hidden') === 'true') continue;
                walk(child);
              } else if (child.nodeType === Node.TEXT_NODE && child.textContent?.trim()) {
                range.selectNodeContents(child);
                const rects = [...range.getClientRects()].filter((rect) => rect.width > 0);
                lines += rects.length;
                if (lines === 1) labelTop = rects[0]?.top ?? 0;
              }
            }
          };
          walk(element);
          const glyph = element.querySelector('.footer-link-glyph');
          const glyphTop = glyph ? glyph.getBoundingClientRect().top : labelTop;
          return {
            lines,
            width: element.clientWidth,
            contentWidth: element.scrollWidth,
            glyphOffset: Math.abs(glyphTop - labelTop),
          };
        });
        expect(metrics.lines).toBe(1);
        expect(metrics.contentWidth).toBeLessThanOrEqual(metrics.width);
        expect(metrics.glyphOffset).toBeLessThan(2);
      }
      await context.close();
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

  test('site map follows the type scale and the phi grid: three columns at desktop and tablet, one centered below', async ({
    page,
  }) => {
    const expectedColumns: Record<number, number> = { 1280: 3, 768: 3, 390: 1, 320: 1 };
    for (const width of [1280, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 812 });
      await loadFooter(page);
      const tree = page.getByRole('navigation', { name: 'Site map' });
      const scale = await page.evaluate(() => {
        const probe = document.createElement('span');
        const read = (token: string) => {
          probe.style.fontSize = `var(${token})`;
          document.body.append(probe);
          const size = Number.parseFloat(getComputedStyle(probe).fontSize);
          probe.remove();
          return size;
        };
        return {
          body: read('--text-body'),
          base: read('--text-base'),
          title: read('--text-section-title'),
        };
      });
      for (const id of ['session', 'netstat', 'tree']) {
        await expect(page.locator(`#footer-${id}-title`)).toHaveCSS(
          'font-size',
          `${scale.title}px`,
        );
      }
      const heading = tree.locator('.sm-title').first();
      await expect(heading).toHaveCSS('font-size', `${scale.base}px`);
      await expect(heading).toHaveCSS('font-weight', '700');
      for (const link of await tree.getByRole('link').all()) {
        await expect(link).toHaveCSS('font-size', `${scale.body}px`);
        await expect(link).toHaveCSS('color', 'rgb(230, 255, 230)');
        const box = await link.boundingBox();
        expect(box?.height).toBeGreaterThanOrEqual(24);
        const fits = await link.evaluate((element) => element.scrollWidth <= element.clientWidth);
        expect(fits, `${await link.textContent()} must wrap only between words at ${width}`).toBe(
          true,
        );
      }
      const columns = await tree
        .locator('.sm-groups')
        .evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').length);
      expect(columns).toBe(expectedColumns[width]);
      const edges = await page.evaluate(() => {
        const left = (selector: string) =>
          document.querySelector(selector)?.getBoundingClientRect().left ?? Number.NaN;
        return {
          tree: left('#footer-tree-title'),
          netstat: left('#footer-netstat-title'),
          session: left('#footer-session-title'),
        };
      });
      expect(edges.tree).toBeCloseTo(edges.session, 0);
      if (width < 900) expect(edges.tree).toBeCloseTo(edges.netstat, 0);
      const gaps = await tree.evaluate((element) => {
        const style = getComputedStyle(element.querySelector('.sm-groups') as Element);
        const title = getComputedStyle(
          element.closest('.footer-tree')?.querySelector('.footer-card-title') as Element,
        );
        return {
          column: style.columnGap,
          row: style.rowGap,
          title: title.marginBottom,
        };
      });
      expect(Number.parseFloat(gaps.row)).toBeGreaterThanOrEqual(Number.parseFloat(gaps.column));
      expect(gaps.title).toBe(gaps.column);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width,
      );
    }
  });

  test('the single mobile column is centered in its card', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 812 });
    await loadFooter(page);
    const offsets = await page.evaluate(() => {
      const card = document.querySelector('.footer-tree')?.getBoundingClientRect();
      const list = document.querySelector('.sm-groups > li')?.getBoundingClientRect();
      if (!card || !list) throw new Error('site map missing');
      return { left: list.left - card.left, right: card.right - list.right };
    });
    expect(Math.abs(offsets.left - offsets.right)).toBeLessThan(2);
  });

  test('tree links keep 44px touch targets under a coarse pointer', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    });
    const page = await context.newPage();
    await loadFooter(page);
    expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true);
    for (const link of await page
      .getByRole('navigation', { name: 'Site map' })
      .getByRole('link')
      .all()) {
      const box = await link.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
    await context.close();
  });
});
