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
    await expect(tree.getByRole('link', { name: 'Home', exact: true })).toBeHidden();
    await tree.locator('summary', { hasText: './whoami/' }).click();
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

  test('mobile footer keeps its measured height with the folded site map and netstat on one line', async ({
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
        expect(footer?.height).toBeGreaterThanOrEqual(1680);
        expect(footer?.height).toBeLessThanOrEqual(1770);
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

  test('site map follows the type scale: six columns at desktop, three at tablet, folder rows on phones', async ({
    page,
  }) => {
    const expectedColumns: Record<number, number> = { 1280: 6, 768: 3 };
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
      const phone = expectedColumns[width] === undefined;
      const heading = phone
        ? tree.locator('.sm-fold-head').first()
        : tree.locator('.sm-title').first();
      await expect(heading).toBeVisible();
      await expect(heading).toHaveCSS('font-size', `${scale.body}px`);
      await expect(heading).toHaveCSS('font-weight', '700');
      if (phone) {
        await expect(tree.locator('.sm-groups')).toBeHidden();
        await tree.locator('.sm-fold-head', { hasText: './measured/' }).click();
        await page.mouse.move(0, 0);
      } else {
        await expect(tree.locator('.sm-folds')).toBeHidden();
        const columns = await tree
          .locator('.sm-groups')
          .evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').length);
        expect(columns).toBe(expectedColumns[width]);
      }
      const links = await tree.getByRole('link').all();
      expect(links.length, 'the visible links are one layout, never both').toBe(phone ? 2 : 13);
      for (const link of links) {
        await expect(link).toHaveCSS('font-size', `${scale.body}px`);
        await expect(link).toHaveCSS('color', 'rgb(230, 255, 230)');
        const box = await link.boundingBox();
        expect(box?.height).toBeGreaterThanOrEqual(44);
        expect(
          box?.height,
          `${await link.textContent()} stays on one line at ${width}`,
        ).toBeLessThanOrEqual(44);
        const fits = await link.evaluate((element) => element.scrollWidth <= element.clientWidth);
        expect(fits, `${await link.textContent()} must not overflow at ${width}`).toBe(true);
      }
      const edges = await page.evaluate(() => {
        const left = (selector: string) => {
          const element = document.querySelector(selector);
          if (!element) return Number.NaN;
          return (
            element.getBoundingClientRect().left +
            Number.parseFloat(getComputedStyle(element).paddingLeft)
          );
        };
        return {
          tree: left('#footer-tree-title'),
          netstat: left('#footer-netstat-title'),
          session: left('#footer-session-title'),
          content: Math.min(
            ...[...document.querySelectorAll('.sm-dir')]
              .map((element) => element.getBoundingClientRect())
              .filter((rect) => rect.width > 0)
              .map((rect) => rect.left),
          ),
        };
      });
      expect(edges.tree).toBeCloseTo(edges.session, 0);
      expect(edges.content, 'the tree starts at the card title edge').toBeCloseTo(edges.tree, 0);
      if (width < 900) expect(edges.tree).toBeCloseTo(edges.netstat, 0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width,
      );
    }
  });

  test('the phone site map is an exclusive accordion that opens on ./work/', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 812 });
    await loadFooter(page);
    const tree = page.getByRole('navigation', { name: 'Site map' });
    const heads = tree.locator('.sm-fold-head');
    await expect(heads).toHaveText([
      /\.\/whoami\/\s*2 files/,
      /\.\/work\/\s*2 files/,
      /\.\/measured\/\s*2 files/,
      /\.\/off_hours\/\s*2 files/,
      /\.\/contact\/\s*1 file/,
      /\.\/pages\/\s*4 files/,
    ]);
    await expect(tree.getByRole('link')).toHaveText(['Projects', 'Career']);
    await heads.filter({ hasText: './pages/' }).click();
    await expect(tree.getByRole('link')).toHaveText([
      '30S_SUMMARY',
      'DESIGN_SYSTEM',
      'LINK_IN_BIO',
      'VIEW_CV',
    ]);
    await heads.filter({ hasText: './pages/' }).press('Enter');
    await expect(tree.getByRole('link')).toHaveCount(0);
    for (const head of await heads.all()) {
      const box = await head.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
  });

  test('sections seen reaches every section after scrolling the page, even sections taller than the screen', async ({
    browser,
  }) => {
    for (const [width, height, isMobile] of [
      [390, 844, true],
      [1280, 800, false],
    ] as const) {
      const context = await browser.newContext({
        viewport: { width, height },
        isMobile,
        hasTouch: isMobile,
      });
      const page = await context.newPage();
      await page.goto('/');
      await expect(
        page.locator('[data-sess="seen"]'),
        'the counter observes the hero before the first scroll, so it must be live',
      ).not.toHaveText('0');
      const total = await page.evaluate(() => document.documentElement.scrollHeight);
      for (let y = 0; y < total; y += height / 2) {
        await page.mouse.wheel(0, height / 2);
        await page.waitForTimeout(50);
      }
      await expect(
        page.locator('[data-sess="seen"]'),
        `a section taller than four screens never reaches a 25% visible ratio at ${width}`,
      ).toHaveText('9');
      await context.close();
    }
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
    const tree = page.getByRole('navigation', { name: 'Site map' });
    let checked = 0;
    for (const head of await tree.locator('.sm-fold-head').all()) {
      const headBox = await head.boundingBox();
      expect(headBox?.height).toBeGreaterThanOrEqual(44);
      const open = await head.evaluate(
        (element) => element.parentElement?.hasAttribute('open') ?? false,
      );
      if (!open) await head.tap();
      for (const link of await tree.getByRole('link').all()) {
        const box = await link.boundingBox();
        expect(box?.height).toBeGreaterThanOrEqual(44);
        checked += 1;
      }
    }
    expect(checked).toBe(13);
    await context.close();
  });
});
