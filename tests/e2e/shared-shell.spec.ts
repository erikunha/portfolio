import { expect, type Page, test } from '@playwright/test';
import { brandByLocale } from '@/content/brand';

const SHELL_PATHS = ['/', '/design-system', '/design-system/tokens', '/links', '/links/en'];
const OVERFLOW_PATHS = [
  '/',
  '/design-system',
  '/design-system/tokens',
  '/design-system/components',
  '/links',
  '/links/en',
];
const DESKTOP = { width: 1280, height: 800 };
const PHONE = { width: 390, height: 844 };
const WIDTHS = [320, 390, 768, 1024, 1280, 1536];
const PHONE_MAX_WIDTH = 767;
const MENU_NAME = 'Open menu';
const DRAWER = '#section-drawer';
const DS_DRAWER_NAV = 'Design system menu';

async function overflow(page: Page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

test.describe('one shell on every page', () => {
  for (const path of SHELL_PATHS) {
    test(`${path} carries the home topbar at desktop`, async ({ page }) => {
      await page.setViewportSize(DESKTOP);
      await page.goto(path);
      const topbar = page.locator('.desktop-topbar');
      await expect(topbar).toBeVisible();
      const homeLink = topbar.getByRole('link', { name: brandByLocale.en.accessibleName });
      await expect(homeLink).toBeVisible();
      await expect(topbar.locator('.window-chrome, [class*="window-chrome"]')).toHaveCount(0);
      const menu = topbar.getByRole('button', { name: MENU_NAME });
      await expect(menu).toBeVisible();
      const [iconBox, menuBox] = await Promise.all([homeLink.boundingBox(), menu.boundingBox()]);
      expect(
        iconBox?.x ?? Number.NEGATIVE_INFINITY,
        'the brand icon sits right of the menu trigger, at the far end of the bar',
      ).toBeGreaterThan(menuBox?.x ?? 0);
      await expect(topbar.getByRole('link', { name: /hire/i })).toBeVisible();
      await expect(page.locator('.site-bar')).toHaveCount(0);
    });

    test(`${path} carries the mobile title bar and the dock on a phone`, async ({ page }) => {
      await page.setViewportSize(PHONE);
      await page.goto(path);
      const bar = page.locator('.mobile-title-bar');
      await expect(bar).toBeVisible();
      await expect(bar.getByRole('link', { name: brandByLocale.en.accessibleName })).toBeVisible();
      await expect(bar.getByRole('button', { name: MENU_NAME })).toBeVisible();
      await expect(page.getByRole('navigation', { name: 'primary' })).toBeVisible();
      await expect(page.locator('main#main-content')).toHaveCount(1);
    });
  }

  test('a real click on the menu trigger opens the one drawer that links the other pages', async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/links');
    await page.locator('.desktop-topbar').getByRole('button', { name: MENU_NAME }).click();
    const drawer = page.locator(DRAWER);
    await expect(drawer).toHaveClass(/is-open/);
    for (const name of ['CV', 'DESIGN_SYSTEM', 'LINKS']) {
      await expect(drawer.getByRole('link', { name: new RegExp(name) })).toBeVisible();
    }
  });

  test('the design-system drawer also lists the design-system pages', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto('/design-system/tokens');
    await page.locator('.mobile-title-bar').getByRole('button', { name: MENU_NAME }).click();
    const drawer = page.locator(DRAWER);
    await expect(drawer).toHaveClass(/is-open/);
    const pages = drawer.getByRole('navigation', { name: DS_DRAWER_NAV });
    await expect(pages.getByRole('link', { name: 'COMPONENTS' })).toBeVisible();
    await expect(pages.getByRole('link', { name: 'TOKENS' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  test('no dock item claims the home section off the home page', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto('/links');
    await expect(
      page.getByRole('navigation', { name: 'primary' }).locator('[aria-current]'),
    ).toHaveCount(0);
  });

  for (const width of [390, 768]) {
    test(`the design-system side rail is not repeated at the end of a ${width}px page`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: PHONE.height });
      await page.goto('/design-system');
      await expect(page.locator('.ds-sidebar:visible')).toHaveCount(0);
    });
  }

  test('the design-system side rail shows from 1024px', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: DESKTOP.height });
    await page.goto('/design-system');
    await expect(page.locator('.ds-sidebar:visible')).toHaveCount(1);
  });

  for (const width of WIDTHS) {
    for (const path of OVERFLOW_PATHS) {
      test(`${path} has no sideways scroll at ${width}`, async ({ page }) => {
        await page.setViewportSize({
          width,
          height: width <= PHONE_MAX_WIDTH ? PHONE.height : DESKTOP.height,
        });
        await page.goto(path);
        expect(await overflow(page)).toBeLessThanOrEqual(0);
      });
    }
  }
});

for (const path of ['/', '/pt']) {
  for (const width of [320, 390]) {
    test(`${path} centers the EN/PT switch in the mobile title bar at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto(path);
      const bar = page.locator('.mobile-title-bar');
      const toggle = bar.locator('[data-lang-switch]');
      await expect(toggle).toBeVisible();
      const [barBox, switchBox] = await Promise.all([bar.boundingBox(), toggle.boundingBox()]);
      if (!barBox || !switchBox) throw new Error('the bar and the switch must both render a box');
      const barCenter = barBox.x + barBox.width / 2;
      const switchCenter = switchBox.x + switchBox.width / 2;
      expect(Math.abs(switchCenter - barCenter)).toBeLessThanOrEqual(1);
    });
  }
}
