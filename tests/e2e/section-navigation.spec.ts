import { expect, test } from '@playwright/test';
import { brand as brandContent } from '@/content/brand';
import { HIRE_ACCESSIBLE_NAME } from '@/content/nav';

const SCROLL_PROBE_PX = 400;
const TOPBAR_WIDTHS = [768, 1024, 1280, 1440];
const SECTION_SHORTCUT_WIDTH = 1280;
const SEARCH_TRIGGER_WIDTH = 1024;
const ACTION_TIER_WIDTH = 1024;
const MOTION_TIER_WIDTH = 1280;
const FOOT_GAP_LIMIT_PX = 32;

for (const width of [390, 768, 1024, 1280, 1536]) {
  test.describe(`section navigation: menu trigger at ${width}px`, () => {
    test.use({ viewport: { width, height: 844 } });

    test('the menu stays closed until the menu button opens it, and never shifts content', async ({
      page,
    }) => {
      await page.goto('/');
      const main = page.locator('#main-content');
      const leftBefore = await main.evaluate((element) => element.getBoundingClientRect().left);
      const menu = page.locator('#section-drawer');
      await expect(menu, 'the section menu must be closed at every width').toBeHidden();
      const trigger = page
        .getByRole('button', { name: 'Open menu', exact: true })
        .locator('visible=true');
      await expect(trigger).toHaveAttribute('aria-expanded', 'false');
      await trigger.click();
      await expect(menu).toBeVisible();
      await expect(trigger).toHaveAttribute('aria-expanded', 'true');
      const leftOpen = await main.evaluate((element) => element.getBoundingClientRect().left);
      expect(leftOpen, 'the drawer overlays: content must not reflow').toBe(leftBefore);
      await page.keyboard.press('Escape');
      await expect(menu).toBeHidden();
      await expect(trigger, 'focus returns to the menu trigger').toBeFocused();
    });

    test('keyboard focus reaches the brand first and the menu trigger last, then opens and restores', async ({
      page,
    }) => {
      await page.goto('/');
      const header = page.locator('.desktop-topbar, .mobile-title-bar').locator('visible=true');
      const order = await header.evaluate((element) => {
        const tabbables = [...element.querySelectorAll<HTMLElement>('a[href], button')].filter(
          (node) => node.getClientRects().length > 0,
        );
        return {
          first: tabbables[0]?.classList.contains('brand-link') ?? false,
          last: tabbables.at(-1)?.classList.contains('menu-trigger') ?? false,
        };
      });
      expect(order.first, 'the brand link is the first tab stop in the header').toBe(true);
      expect(order.last, 'the menu trigger is the last tab stop in the header').toBe(true);

      const trigger = header.locator('.menu-trigger');
      await trigger.focus();
      await page.keyboard.press('Enter');
      await expect(page.locator('#section-drawer')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(trigger, 'focus returns to the menu trigger').toBeFocused();
    });

    test('the trigger is the menu icon alone, and a 44px target', async ({ page }) => {
      await page.goto('/');
      const trigger = page
        .getByRole('button', { name: 'Open menu', exact: true })
        .locator('visible=true');
      await expect(trigger).toHaveAttribute('aria-controls', 'section-drawer');
      await expect(trigger, 'no INDEX label and no NN/9 counter on the trigger').toHaveText('');
      const box = await trigger.boundingBox();
      expect(box?.width ?? 0, 'target width').toBeGreaterThanOrEqual(44);
      expect(box?.height ?? 0, 'target height').toBeGreaterThanOrEqual(44);
      expect(
        box?.x ?? Number.NEGATIVE_INFINITY,
        'the trigger sits in the right half, as the last item in the header',
      ).toBeGreaterThan(width / 2);
      expect(
        (box?.x ?? 0) + (box?.width ?? 0),
        'the trigger stays inside the viewport',
      ).toBeLessThanOrEqual(width);
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

    test('the brand icon sits at the far left and the menu trigger at the far right, unclipped', async ({
      page,
    }) => {
      await page.goto('/');
      const bar = page.locator('.desktop-topbar');
      const brand = bar.getByRole('link', { name: brandContent.accessibleName });

      await expect(
        brand,
        'the brand icon link belongs on the topbar at every desktop width',
      ).toBeVisible();
      await expect(bar.locator('.window-chrome'), 'the header draws no window dots').toHaveCount(0);

      const fit = await bar.evaluate((element) => {
        const boxOf = (selector: string) =>
          element.querySelector(selector)?.getBoundingClientRect();
        const brandBox = boxOf('.brand-link');
        const triggerBox = boxOf('.menu-trigger');
        const nav = boxOf('nav');
        return {
          brandLeft: brandBox?.x ?? Number.NaN,
          brandHeight: brandBox?.height ?? Number.NaN,
          triggerLeft: triggerBox?.x ?? Number.NaN,
          triggerRight: triggerBox?.right ?? Number.NaN,
          triggerHeight: triggerBox?.height ?? Number.NaN,
          navRight: nav?.right ?? Number.NaN,
          barRight: element.getBoundingClientRect().right,
        };
      });

      expect(fit.triggerRight, 'the menu trigger must not reach past the bar').toBeLessThanOrEqual(
        fit.barRight + 1,
      );
      expect(
        fit.triggerLeft,
        'the menu trigger must sit to the right of the navigation and the HIRE button',
      ).toBeGreaterThanOrEqual(fit.navRight - 1);
      expect(fit.brandLeft, 'the brand icon is left of everything').toBeLessThan(fit.triggerLeft);
      expect(fit.brandHeight, 'brand hit target is at least 44px').toBeGreaterThanOrEqual(44);
      expect(fit.triggerHeight, 'menu hit target is at least 44px').toBeGreaterThanOrEqual(44);
    });

    test('the topbar shows one vocabulary and the search trigger opens the drawer', async ({
      page,
    }) => {
      await page.goto('/');
      const nav = page.getByRole('navigation', { name: 'Site navigation' });
      const cv = nav.getByRole('link', { name: 'VIEW_CV' });
      const hire = nav.getByRole('link', { name: HIRE_ACCESSIBLE_NAME });
      if (width >= ACTION_TIER_WIDTH) {
        await expect(cv, 'from 1024px the topbar keeps its own VIEW_CV action').toBeVisible();
        await expect(hire, 'from 1024px the topbar keeps its own hire action').toBeVisible();
      } else {
        await expect(
          cv,
          'below 1024px the dock and the hero already carry the hire path, so the topbar hides it',
        ).toBeHidden();
        await expect(
          hire,
          'below 1024px the dock and the hero already carry the hire path, so the topbar hides it',
        ).toBeHidden();
      }
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

test.describe('desktop topbar: one hire action per viewport', () => {
  for (const width of [768, 1023, 1024, 1280]) {
    test.describe(`at ${width}px`, () => {
      test.use({ viewport: { width, height: 720 } });

      test('VIEW_CV and the hire link follow the dock breakpoint', async ({ page }) => {
        await page.goto('/');
        const bar = page.locator('.desktop-topbar');
        const nav = bar.getByRole('navigation', { name: 'Site navigation' });
        const cv = nav.getByRole('link', { name: 'VIEW_CV' });
        const hire = nav.getByRole('link', { name: HIRE_ACCESSIBLE_NAME });

        await expect(
          page.getByRole('button', { name: 'Open menu', exact: true }),
          'the menu trigger stays on the row at every topbar width',
        ).toBeVisible();
        await expect(
          bar.getByRole('link', { name: brandContent.accessibleName }),
          'the brand icon stays on the row at every topbar width',
        ).toBeVisible();

        if (width >= ACTION_TIER_WIDTH) {
          await expect(
            cv,
            'from 1024px the topbar keeps its own VIEW_CV and hire actions',
          ).toBeVisible();
          await expect(hire).toBeVisible();
        } else {
          await expect(
            cv,
            'below 1024px the dock HIRE and the hero action carry the hire path, so a hidden ' +
              'topbar control must not stay focusable or in the accessibility tree',
          ).toBeHidden();
          await expect(
            hire,
            'below 1024px the dock HIRE and the hero action carry the hire path, so a hidden ' +
              'topbar control must not stay focusable or in the accessibility tree',
          ).toBeHidden();
        }
      });
    });
  }
});

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

        await page
          .getByRole('button', { name: 'Open menu', exact: true })
          .locator('visible=true')
          .click();
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

    await expect(drawer.locator('.menu-badge span[aria-hidden="true"]')).toHaveText('10');
    await expect(drawer.locator('.menu-badge')).toContainText('10 sections');
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
    await expect(drawer.getByRole('link', { name: HIRE_ACCESSIBLE_NAME })).toHaveAttribute(
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
      page.getByRole('button', { name: 'Open menu', exact: true }).locator('visible=true'),
      'the trigger still reports the open drawer after the viewport change',
    ).toHaveAttribute('aria-expanded', 'true');
    await expect(
      page.locator('html'),
      'the scroll lock must survive the viewport change while the drawer is open',
    ).toHaveCSS('overflow', 'hidden');
  });

  test('closing after the viewport change returns focus to a rendered menu trigger', async ({
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
      page.locator('.desktop-topbar .menu-trigger'),
      'focus must return to the menu trigger that is rendered after the viewport change: the ' +
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

const SIDE_LINE_MAX_THICKNESS_PX = 4;
const RIGHT_EDGE_RATIO = 0.95;

for (const { width, height } of [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
]) {
  test.describe(`section navigation: side position line at ${width}px`, () => {
    test.use({ viewport: { width, height } });

    test('the position line runs down the right edge and follows the scroll', async ({ page }) => {
      await page.goto('/');
      const bar = page.getByRole('progressbar', { name: 'Page position' });
      await expect(bar, 'the line is present below 1024px, not hidden').toBeVisible();
      const box = await bar.boundingBox();
      expect(box?.width ?? Number.POSITIVE_INFINITY, 'a thin vertical line').toBeLessThanOrEqual(
        SIDE_LINE_MAX_THICKNESS_PX,
      );
      expect(box?.height ?? 0, 'it spans the viewport height').toBeGreaterThanOrEqual(height - 1);
      expect(
        (box?.x ?? 0) + (box?.width ?? 0),
        'it sits on the right edge, left of any classic scrollbar',
      ).toBeGreaterThanOrEqual(width * RIGHT_EDGE_RATIO);
      await expect(bar).toHaveAttribute('aria-valuenow', '0');
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await expect(bar).toHaveAttribute('aria-valuenow', '100');
      await expect(bar).toHaveCSS('pointer-events', 'none');
    });

    test('the position line does not print', async ({ page }) => {
      await page.goto('/');
      await page.emulateMedia({ media: 'print' });
      await expect(page.getByRole('progressbar', { name: 'Page position' })).toBeHidden();
    });

    test('the trigger carries no position counter', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('.menu-trigger').locator('visible=true')).toHaveText('');
    });
  });
}

test.describe('section navigation: top position line at 1280px', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test('the desktop line stays a thin horizontal line across the top', async ({ page }) => {
    await page.goto('/');
    const box = await page.getByRole('progressbar', { name: 'Page position' }).boundingBox();
    expect(box?.height ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(SIDE_LINE_MAX_THICKNESS_PX);
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(1280 * 0.9);
    expect(box?.y ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(1);
  });
});
