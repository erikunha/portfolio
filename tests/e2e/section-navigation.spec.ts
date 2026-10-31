import { expect, test } from '@playwright/test';
import { topbarChrome } from '@/content/terminal-chrome';

const SCROLL_PROBE_PX = 400;
const TOPBAR_WIDTHS = [768, 1024, 1280, 1440];
const SECTION_SHORTCUT_WIDTH = 1280;
const SEARCH_TRIGGER_WIDTH = 1024;
const MOTION_TIER_WIDTH = 1280;
const FOOT_GAP_LIMIT_PX = 32;

for (const width of [390, 768, 1024, 1280, 1536]) {
  test.describe(`section navigation: INDEX trigger at ${width}px`, () => {
    test.use({ viewport: { width, height: 844 } });

    test('the menu stays closed until the INDEX button opens it, and never shifts content', async ({
      page,
    }) => {
      await page.goto('/');
      const main = page.locator('#main-content');
      const leftBefore = await main.evaluate((element) => element.getBoundingClientRect().left);
      const menu = page.locator('#section-drawer');
      await expect(menu, 'the section menu must be closed at every width').toBeHidden();
      const trigger = page.getByRole('button', { name: /INDEX/ }).locator('visible=true');
      await expect(trigger).toHaveAttribute('aria-expanded', 'false');
      await trigger.click();
      await expect(menu).toBeVisible();
      await expect(trigger).toHaveAttribute('aria-expanded', 'true');
      const leftOpen = await main.evaluate((element) => element.getBoundingClientRect().left);
      expect(leftOpen, 'the drawer overlays: content must not reflow').toBe(leftBefore);
      await page.keyboard.press('Escape');
      await expect(menu).toBeHidden();
      await expect(trigger, 'focus returns to the INDEX trigger').toBeFocused();
    });
  });
}

for (const width of TOPBAR_WIDTHS) {
  test.describe(`desktop topbar at ${width}px`, () => {
    test.use({ viewport: { width, height: 720 } });

    test('the topbar row neither overflows its column nor clips a control', async ({ page }) => {
      await page.goto('/');
      const bar = page.locator('.desktop-topbar');
      const row = bar.locator('> div');

      const metrics = await row.evaluate((element) => ({
        scroll: element.scrollWidth,
        client: element.clientWidth,
      }));
      expect(
        metrics.scroll,
        'the topbar row content must fit the page column: a wider row pushes the last control past the viewport',
      ).toBeLessThanOrEqual(metrics.client);

      const clipped = await bar.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        return [...element.querySelectorAll('nav a, nav button')]
          .filter((control) => control.getBoundingClientRect().width > 0)
          .map((control) => ({
            text: (control.textContent ?? '').trim(),
            right: Math.round(control.getBoundingClientRect().right),
          }))
          .filter((control) => control.right > bounds.right + 1);
      });
      expect(clipped, 'no topbar control may reach past the bar').toEqual([]);
    });

    test('the brand badge stays on the row, beside the INDEX trigger, unclipped', async ({
      page,
    }) => {
      await page.goto('/');
      const bar = page.locator('.desktop-topbar');
      const brand = bar.getByText(topbarChrome.brandLabel, { exact: true });

      await expect(
        brand,
        'the brand badge belongs on the desktop topbar at every desktop width',
      ).toBeVisible();

      const fit = await bar.evaluate((element, label) => {
        const badge = [...element.querySelectorAll('span')].find(
          (node) => node.textContent === label,
        );
        const index = element.querySelector('.index-trigger');
        const badgeBox = badge?.getBoundingClientRect();
        const indexBox = index?.getBoundingClientRect();
        return {
          badgeLeft: badgeBox?.x ?? Number.NaN,
          badgeRight: badgeBox?.right ?? Number.NaN,
          indexRight: indexBox?.right ?? Number.NaN,
          barRight: element.getBoundingClientRect().right,
        };
      }, topbarChrome.brandLabel);

      expect(fit.badgeRight, 'the brand badge must not reach past the bar').toBeLessThanOrEqual(
        fit.barRight + 1,
      );
      expect(
        fit.indexRight,
        'the INDEX trigger must sit on the left of the brand badge',
      ).toBeLessThanOrEqual(fit.badgeLeft + 1);
    });

    test('the topbar shows one vocabulary and the search trigger opens the drawer', async ({
      page,
    }) => {
      await page.goto('/');
      const nav = page.getByRole('navigation', { name: 'Site navigation' });
      await expect(nav.getByRole('link', { name: 'VIEW_CV' })).toBeVisible();
      await expect(nav.getByRole('link', { name: 'HIRE_ON_LINKEDIN' })).toBeVisible();
      if (width >= SECTION_SHORTCUT_WIDTH) {
        for (const label of ['ABOUT', 'WORK', 'CAREER', 'CONTACT', 'DESIGN_SYSTEM']) {
          await expect(nav.getByRole('link', { name: label })).toBeVisible();
        }
      }

      const search = nav.locator('.topbar-search');
      if (width >= SEARCH_TRIGGER_WIDTH) {
        await expect(search, 'the search trigger joins the row from 1024px').toBeVisible();
        await search.click();
        await expect(page.getByRole('dialog', { name: 'Section menu' })).toBeVisible();
      } else {
        await expect(
          search,
          'below 1024px the row has no room for the search trigger, so it stays off the row',
        ).toBeHidden();
      }
    });
  });
}

test.describe('section navigation: motion control tiers', () => {
  for (const width of [768, 1024, 1280, 1440]) {
    test.describe(`at ${width}px`, () => {
      test.use({ viewport: { width, height: 720 } });

      test('the topbar spells MOTION at the xl tier and the drawer carries it at every width', async ({
        page,
      }) => {
        await page.goto('/');
        const topbar = page.locator('.desktop-topbar');
        const toggle = topbar.locator('button[aria-pressed]');

        if (width >= MOTION_TIER_WIDTH) {
          await expect(
            toggle,
            'the topbar carries the compact MOTION control at the xl tier',
          ).toBeVisible();
          await expect(
            toggle,
            'the topbar spells the control MOTION, not MOTION: ON',
          ).toContainText('MOTION');
          await expect(toggle).not.toContainText('MOTION: ON');
        } else {
          await expect(
            toggle,
            'below the xl tier the topbar drops the motion control, so the drawer must carry it',
          ).toBeHidden();
        }

        await page.getByRole('button', { name: /INDEX/ }).locator('visible=true').click();
        const drawer = page.getByRole('dialog', { name: 'Section menu' });
        await expect(
          drawer.locator('.menu-motion'),
          'the drawer carries the motion control at every width, so motion stays reachable below the xl tier',
        ).toBeVisible();
        await expect(drawer.locator('.menu-motion')).toContainText('MOTION: ON');
      });
    });
  }
});

test.describe('section navigation: drawer rows', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('the drawer lists the search row, the count, the reading views and the motion toggle', async ({
    page,
  }) => {
    await page.goto('/');
    await page
      .getByRole('navigation', { name: 'primary' })
      .getByRole('button', { name: /^MENU/ })
      .click();
    const drawer = page.getByRole('dialog', { name: 'Section menu' });

    await expect(drawer.locator('.menu-badge span[aria-hidden="true"]')).toHaveText('9');
    await expect(drawer.locator('.menu-badge')).toContainText('9 sections');
    await expect(drawer.locator('.menu-search')).toBeVisible();
    await expect(drawer.getByRole('link', { name: 'VIEW_CV' })).toHaveAttribute('href', '/cv');
    await expect(drawer.getByRole('link', { name: '30S_SUMMARY' })).toHaveAttribute(
      'href',
      '/summary',
    );
    await expect(drawer.getByRole('link', { name: 'DESIGN_SYSTEM' })).toHaveAttribute(
      'href',
      '/design-system',
    );
    await expect(drawer.getByRole('link', { name: /LinkedIn/ })).toHaveAttribute(
      'href',
      /linkedin\.com\/in\/erikunha/,
    );
    await expect(drawer.locator('.menu-motion')).toBeVisible();
  });

  test('the drawer foot follows the section list instead of floating at the bottom', async ({
    page,
  }) => {
    await page.goto('/');
    await page
      .getByRole('navigation', { name: 'primary' })
      .getByRole('button', { name: /^MENU/ })
      .click();
    const drawer = page.getByRole('dialog', { name: 'Section menu' });

    const gap = await drawer.evaluate((panel) => {
      const nav = panel.querySelector('#section-nav') as HTMLElement;
      const foot = panel.querySelector('.menu-foot') as HTMLElement;
      return foot.getBoundingClientRect().top - nav.getBoundingClientRect().bottom;
    });

    expect(
      gap,
      'the drawer foot must not be pushed to the bottom of the panel: that leaves a dead gap under the sections',
    ).toBeLessThan(FOOT_GAP_LIMIT_PX);
  });
});

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

test.describe('section navigation: drawer across a viewport change', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('the open drawer survives the change to a desktop width', async ({ page }) => {
    await page.goto('/');
    await page
      .getByRole('navigation', { name: 'primary' })
      .getByRole('button', { name: /^MENU/ })
      .click();
    const drawer = page.getByRole('dialog', { name: 'Section menu' });
    await expect(drawer).toBeVisible();

    await page.setViewportSize({ width: 1280, height: 720 });

    await expect(
      drawer,
      'the drawer must stay open across a viewport change: the menu is a drawer at every width',
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /INDEX/ }).locator('visible=true'),
      'the trigger still reports the open drawer after the viewport change',
    ).toHaveAttribute('aria-expanded', 'true');
    await expect(
      page.locator('html'),
      'the scroll lock must survive the viewport change while the drawer is open',
    ).toHaveCSS('overflow', 'hidden');
  });

  test('closing after the viewport change returns focus to a rendered INDEX trigger', async ({
    page,
  }) => {
    await page.goto('/');
    await page
      .getByRole('navigation', { name: 'primary' })
      .getByRole('button', { name: /^MENU/ })
      .click();
    const drawer = page.getByRole('dialog', { name: 'Section menu' });
    await expect(drawer).toBeVisible();

    await page.setViewportSize({ width: 1280, height: 720 });

    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
    await expect(
      page.locator('.desktop-topbar .index-trigger'),
      'focus must return to the INDEX trigger that is rendered after the viewport change: the ' +
        'trigger that opened the drawer is inside the dock, which is hidden from 1024px',
    ).toBeFocused();
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
