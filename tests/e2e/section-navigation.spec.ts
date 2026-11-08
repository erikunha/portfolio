import { expect, test } from '@playwright/test';
import { brandByLocale } from '@/content/brand';
import { HIRE_ACCESSIBLE_NAME } from '@/content/nav';
import { SITE_LOCALE } from '../../content/site-locale';
import { gotoSettled } from './_helpers/streamed';

const SCROLL_PROBE_PX = 400;
const TOPBAR_WIDTHS = [768, 1024, 1280, 1440];
const SECTION_SHORTCUT_WIDTH = 1280;
const ACTION_TIER_WIDTH = 1024;
const MOTION_TIER_WIDTH = 1280;
const FOOT_GAP_LIMIT_PX = 32;

for (const width of [390, 768, 1024, 1280, 1536]) {
  test.describe(`section navigation: menu trigger at ${width}px`, () => {
    test.use({ viewport: { width, height: 844 } });

    test('the menu stays closed until the menu button opens it, and never shifts content', async ({
      page,
    }) => {
      await gotoSettled(page, '/');
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

    test('keyboard focus reaches the menu trigger first and the brand last, then opens and restores', async ({
      page,
    }) => {
      await gotoSettled(page, '/');
      const header = page.locator('.desktop-topbar, .mobile-title-bar').locator('visible=true');
      const order = await header.evaluate((element) => {
        const tabbables = [...element.querySelectorAll<HTMLElement>('a[href], button')].filter(
          (node) => node.getClientRects().length > 0,
        );
        return {
          first: tabbables[0]?.classList.contains('menu-trigger') ?? false,
          last: tabbables.at(-1)?.classList.contains('brand-link') ?? false,
        };
      });
      expect(order.first, 'the menu trigger is the first tab stop in the header').toBe(true);
      expect(order.last, 'the brand link is the last tab stop in the header').toBe(true);

      const trigger = header.locator('.menu-trigger');
      await trigger.focus();
      await page.keyboard.press('Enter');
      await expect(page.locator('#section-drawer')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(trigger, 'focus returns to the menu trigger').toBeFocused();
    });

    test('the trigger is the menu icon alone, and a 44px target', async ({ page }) => {
      await gotoSettled(page, '/');
      const trigger = page
        .getByRole('button', { name: 'Open menu', exact: true })
        .locator('visible=true');
      await expect(trigger).toHaveAttribute('aria-controls', 'section-drawer');
      await expect(trigger, 'no INDEX label and no NN/9 counter on the trigger').toHaveText('');
      const box = await trigger.boundingBox();
      expect(box?.width ?? 0, 'target width').toBeGreaterThanOrEqual(44);
      expect(box?.height ?? 0, 'target height').toBeGreaterThanOrEqual(44);
      expect(
        box?.x ?? Number.POSITIVE_INFINITY,
        'the trigger sits in the left half, leading the header',
      ).toBeLessThan(width / 2);
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
      await gotoSettled(page, '/');
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

    test('the menu trigger leads the bar and the brand icon closes it at the far right, unclipped', async ({
      page,
    }) => {
      await gotoSettled(page, '/');
      const bar = page.locator('.desktop-topbar');
      const brand = bar.getByRole('link', { name: brandByLocale.en.accessibleName });

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
          brandRight: brandBox?.right ?? Number.NaN,
          brandHeight: brandBox?.height ?? Number.NaN,
          triggerLeft: triggerBox?.x ?? Number.NaN,
          triggerRight: triggerBox?.right ?? Number.NaN,
          triggerHeight: triggerBox?.height ?? Number.NaN,
          navLeft: nav?.x ?? Number.NaN,
          navRight: nav?.right ?? Number.NaN,
          barRight: element.getBoundingClientRect().right,
        };
      });

      expect(
        fit.triggerLeft,
        'the menu trigger must not start before the bar',
      ).toBeGreaterThanOrEqual(-1);
      expect(
        fit.brandLeft,
        'the brand icon sits right of the navigation, separated by a gap',
      ).toBeGreaterThan(fit.navRight);
      expect(fit.brandRight, 'the brand icon must not reach past the bar').toBeLessThanOrEqual(
        fit.barRight + 1,
      );
      expect(
        fit.navLeft,
        'the navigation must sit to the right of the menu trigger',
      ).toBeGreaterThanOrEqual(fit.triggerRight - 1);
      expect(fit.navRight, 'the navigation must not reach past the bar').toBeLessThanOrEqual(
        fit.barRight + 1,
      );
      expect(fit.brandHeight, 'brand hit target is at least 44px').toBeGreaterThanOrEqual(44);
      expect(fit.triggerHeight, 'menu hit target is at least 44px').toBeGreaterThanOrEqual(44);
    });

    test('the topbar shows one vocabulary and carries no search trigger', async ({ page }) => {
      await gotoSettled(page, '/');
      const nav = page.getByRole('navigation', { name: 'Site navigation' });
      const cv = nav.getByRole('link', { name: 'VIEW_CV' });
      const hire = nav.getByRole('link', { name: HIRE_ACCESSIBLE_NAME[SITE_LOCALE.en] });
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
        for (const label of ['ABOUT', 'PROJECTS', 'CAREER', 'CONTACT', 'DESIGN_SYSTEM']) {
          await expect(nav.getByRole('link', { name: label })).toBeVisible();
        }
      }

      await expect(
        page.locator('.desktop-topbar').getByRole('button', { name: /^(SEARCH|BUSCAR)/ }),
        'the search trigger is gone at every width',
      ).toHaveCount(0);
    });
  });
}

test.describe('desktop topbar: one hire action per viewport', () => {
  for (const width of [768, 1023, 1024, 1280]) {
    test.describe(`at ${width}px`, () => {
      test.use({ viewport: { width, height: 720 } });

      test('VIEW_CV and the hire link follow the dock breakpoint', async ({ page }) => {
        await gotoSettled(page, '/');
        const bar = page.locator('.desktop-topbar');
        const nav = bar.getByRole('navigation', { name: 'Site navigation' });
        const cv = nav.getByRole('link', { name: 'VIEW_CV' });
        const hire = nav.getByRole('link', { name: HIRE_ACCESSIBLE_NAME[SITE_LOCALE.en] });

        await expect(
          page.getByRole('button', { name: 'Open menu', exact: true }),
          'the menu trigger stays on the row at every topbar width',
        ).toBeVisible();
        await expect(
          bar.getByRole('link', { name: brandByLocale.en.accessibleName }),
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
        await gotoSettled(page, '/');
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

  test('the drawer lists the reading views and the motion toggle, with no search row', async ({
    page,
  }) => {
    await gotoSettled(page, '/');
    await page
      .getByRole('navigation', { name: 'primary' })
      .getByRole('button', { name: /^MENU/ })
      .click();
    const drawer = page.getByRole('dialog', { name: 'Section menu' });

    await expect(drawer.locator('.menu-badge')).toHaveCount(0);
    await expect(drawer.locator('[data-section-count]')).toHaveCount(0);
    await expect(drawer.getByRole('button', { name: /^(SEARCH|BUSCAR)/ })).toHaveCount(0);
    await expect(drawer.locator('.menu-search')).toHaveCount(0);
    await expect(
      drawer.locator('[data-lang-switch], a[hreflang]'),
      'the language switch lives in the header, not the drawer',
    ).toHaveCount(0);
    await expect(drawer.getByRole('link', { name: 'VIEW_CV' })).toHaveAttribute('href', '/cv');
    await expect(drawer.getByRole('link', { name: '30S_SUMMARY' })).toHaveAttribute(
      'href',
      '/summary',
    );
    await expect(drawer.getByRole('link', { name: 'DESIGN_SYSTEM' })).toHaveAttribute(
      'href',
      '/design-system',
    );
    await expect(
      drawer.getByRole('link', { name: HIRE_ACCESSIBLE_NAME[SITE_LOCALE.en] }),
    ).toHaveAttribute('href', /linkedin\.com\/in\/erikunha/);
    await expect(drawer.locator('.menu-motion')).toBeVisible();
  });

  test('the drawer foot follows the section list instead of floating at the bottom', async ({
    page,
  }) => {
    await gotoSettled(page, '/');
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
    await gotoSettled(page, '/');
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
    await gotoSettled(page, '/');
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
    await expect(async () => {
      await page.mouse.wheel(0, SCROLL_PROBE_PX);
      expect(
        await page.evaluate(() => window.scrollY),
        'a wheel after the drawer closes must scroll the page; one wheel can land before the released page takes input under load, so the user scrolls again',
      ).toBeGreaterThan(0);
    }).toPass();
  });
});

test.describe('section navigation: drawer across a viewport change', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('the open drawer survives the change to a desktop width', async ({ page }) => {
    await gotoSettled(page, '/');
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
    await gotoSettled(page, '/');
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
    await gotoSettled(page, '/');
    const bar = page.locator('.pos-line');
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
      await gotoSettled(page, '/');
      const bar = page.locator('.pos-line');
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
      await expect(bar).toHaveCSS('--posf', '0');
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await expect(bar).toHaveCSS('--posf', '1');
      await expect(bar).toHaveCSS('pointer-events', 'none');
    });

    test('the position line does not print', async ({ page }) => {
      await gotoSettled(page, '/');
      await page.emulateMedia({ media: 'print' });
      await expect(page.locator('.pos-line')).toBeHidden();
    });

    test('the trigger carries no position counter', async ({ page }) => {
      await gotoSettled(page, '/');
      await expect(page.locator('.menu-trigger').locator('visible=true')).toHaveText('');
    });
  });
}

test.describe('section navigation: top position line at 1280px', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test('the desktop line stays a thin horizontal line across the top', async ({ page }) => {
    await gotoSettled(page, '/');
    const box = await page.locator('.pos-line').boundingBox();
    expect(box?.height ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(SIDE_LINE_MAX_THICKNESS_PX);
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(1280 * 0.9);
    expect(box?.y ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(1);
  });
});

test('a section reached from the menu takes focus without the browser outline', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await gotoSettled(page, '/');
  await page.locator('.desktop-topbar .menu-trigger').click();
  await page
    .locator('#section-drawer')
    .getByRole('link', { name: /Career/ })
    .click();
  const career = page.locator('#sec-git-log');
  await expect(career, 'the jump moves focus to the section').toBeFocused();
  expect(
    await career.evaluate((element) => getComputedStyle(element).outlineStyle),
    'a non-interactive focus target paints no off-palette browser outline',
  ).toBe('none');
});

const LANGUAGE_LABEL = { en: 'Language', pt: 'Idioma' } as const;
const FINE_POINTER_TARGET_PX = 36;
const COARSE_POINTER_TARGET_PX = 44;
const HEADER_VIEWPORTS = [
  { name: 'desktop topbar', selector: '.desktop-topbar', width: 1280, height: 720 },
  { name: 'mobile title bar', selector: '.mobile-title-bar', width: 390, height: 844 },
] as const;

for (const { name, selector, width, height } of HEADER_VIEWPORTS) {
  test.describe(`language switch in the ${name}`, () => {
    test.use({ viewport: { width, height } });

    test('sits in the header with compact targets, left of the brand icon', async ({ page }) => {
      await gotoSettled(page, '/');
      const header = page.locator(selector);
      const langSwitch = header.getByRole('navigation', { name: LANGUAGE_LABEL.en });
      await expect(langSwitch).toBeVisible();
      await expect(page.locator('#section-drawer [data-lang-switch]')).toHaveCount(0);

      const geometry = await header.evaluate((element) => {
        const barBox = element.getBoundingClientRect();
        const switchNode = element.querySelector('[data-lang-switch]');
        const switchBox = switchNode?.getBoundingClientRect();
        const brandBox = element.querySelector('.brand-link')?.getBoundingClientRect();
        const siteNavBox = element
          .querySelector('nav[aria-label="Site navigation"]')
          ?.getBoundingClientRect();
        const boxes = Array.from(switchNode?.querySelectorAll('a') ?? []).map((link) =>
          link.getBoundingClientRect(),
        );
        return {
          count: boxes.length,
          coarse: window.matchMedia('(pointer: coarse)').matches,
          minHeight: Math.min(...boxes.map((box) => box.height)),
          minWidth: Math.min(...boxes.map((box) => box.width)),
          switchLeft: switchBox?.left ?? Number.NaN,
          switchRight: switchBox?.right ?? Number.NaN,
          brandLeft: brandBox?.left ?? Number.NaN,
          siteNavRight: siteNavBox?.right ?? Number.NaN,
          barRight: barBox.right,
          barBottom: barBox.bottom,
          switchBottom: switchBox?.bottom ?? Number.NaN,
        };
      });
      const target = geometry.coarse ? COARSE_POINTER_TARGET_PX : FINE_POINTER_TARGET_PX;
      expect(geometry.count).toBe(2);
      expect(
        geometry.minHeight,
        'each language link keeps its pointer-tier target',
      ).toBeGreaterThanOrEqual(target);
      expect(
        geometry.minWidth,
        'each language link keeps its pointer-tier target',
      ).toBeGreaterThanOrEqual(target);
      expect(geometry.switchRight, 'the switch stays left of the brand icon').toBeLessThanOrEqual(
        geometry.brandLeft,
      );
      expect(geometry.switchRight, 'the switch stays inside the bar').toBeLessThanOrEqual(
        geometry.barRight,
      );
      expect(geometry.switchBottom, 'the switch stays inside the bar').toBeLessThanOrEqual(
        geometry.barBottom + 1,
      );
      if (!Number.isNaN(geometry.siteNavRight)) {
        expect(
          geometry.switchLeft,
          'the switch follows the site navigation',
        ).toBeGreaterThanOrEqual(geometry.siteNavRight - 1);
      }
    });

    test('marks the current language and switches to Portuguese and back', async ({ page }) => {
      await gotoSettled(page, '/');
      const header = page.locator(selector);
      const english = header.getByRole('navigation', { name: LANGUAGE_LABEL.en });
      await expect(english.getByRole('link', { name: /^EN/ })).toHaveAttribute(
        'aria-current',
        'page',
      );
      await expect(english.getByRole('link', { name: /^PT/ })).not.toHaveAttribute(
        'aria-current',
        /.+/,
      );

      await english.getByRole('link', { name: /^PT/ }).click();
      await expect(page).toHaveURL(/\/pt$/);

      const portuguese = header.getByRole('navigation', { name: LANGUAGE_LABEL.pt });
      await expect(portuguese.getByRole('link', { name: /^PT/ })).toHaveAttribute(
        'aria-current',
        'page',
      );

      await portuguese.getByRole('link', { name: /^EN/ }).click();
      await expect(page).toHaveURL(/\/$/);
      await expect(header.getByRole('navigation', { name: LANGUAGE_LABEL.en })).toBeVisible();
    });
  });
}

test.describe('language switch order in the desktop topbar', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test('follows HIRE and precedes the brand icon in tab order', async ({ page }) => {
    await gotoSettled(page, '/');
    const stops = await page.locator('.desktop-topbar').evaluate((element) =>
      [...element.querySelectorAll<HTMLElement>('a[href], button')]
        .filter((node) => node.getClientRects().length > 0)
        .map((node) => {
          if (node.classList.contains('brand-link')) return 'brand';
          if (node.classList.contains('menu-trigger')) return 'menu';
          if (node.closest('[data-lang-switch]')) return 'lang';
          if (node.hasAttribute('aria-pressed')) return 'motion';
          if (node.getAttribute('href') === '/cv') return 'cv';
          if (node.getAttribute('href')?.includes('linkedin.com')) return 'hire';
          return 'link';
        }),
    );
    expect(stops.slice(-5)).toEqual(['cv', 'hire', 'lang', 'lang', 'brand']);
    expect(stops[0]).toBe('menu');
  });
});
