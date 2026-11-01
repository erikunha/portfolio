import { expect, type Page, test } from '@playwright/test';
import {
  DS_DRAWER_CLOSE_LABEL,
  DS_DRAWER_ID,
  DS_MENU_TRIGGER_LABEL,
  DS_PAGER,
} from '@/app/design-system/_components/ds-nav';

const MIN_TARGET_PX = 24;
const WIDTHS = [320, 390, 768, 1024, 1280];
const MOBILE_HEIGHT = 812;
const DESKTOP_HEIGHT = 720;

async function openMenu(page: Page) {
  const trigger = page.getByRole('button', { name: DS_MENU_TRIGGER_LABEL, exact: true });
  await trigger.click();
  const drawer = page.locator(`#${DS_DRAWER_ID}`);
  await expect(drawer).toHaveClass(/is-open/);
  await expect(page.getByRole('button', { name: DS_DRAWER_CLOSE_LABEL })).toBeFocused();
  return { trigger, drawer };
}

test.describe('design-system mobile menu', () => {
  test.use({ viewport: { width: 320, height: MOBILE_HEIGHT } });

  test('Escape closes the menu and returns focus to the trigger', async ({ page }) => {
    await page.goto('/design-system');
    const { trigger, drawer } = await openMenu(page);
    await page.keyboard.press('Escape');
    await expect(drawer).not.toHaveClass(/is-open/);
    await expect(trigger).toBeFocused();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  test('Tab and Shift+Tab stay inside the open menu', async ({ page }) => {
    await page.goto('/design-system');
    const { drawer } = await openMenu(page);
    const count = await drawer.locator('a[href], button').count();
    for (let step = 0; step < count + 2; step += 1) {
      await page.keyboard.press('Tab');
      expect(await drawer.evaluate((node) => node.contains(document.activeElement))).toBe(true);
    }
    await page.keyboard.press('Shift+Tab');
    expect(await drawer.evaluate((node) => node.contains(document.activeElement))).toBe(true);
  });

  test('a real click on the scrim outside the menu closes it', async ({ page }) => {
    await page.goto('/design-system');
    const { trigger, drawer } = await openMenu(page);
    const box = await drawer.boundingBox();
    const viewport = page.viewportSize();
    if (!box || !viewport) throw new Error('drawer and viewport must have geometry');
    const outsideX =
      box.x > 0 ? box.x / 2 : box.x + box.width + (viewport.width - box.x - box.width) / 2;
    await page.mouse.click(outsideX, viewport.height / 2);
    await expect(drawer).not.toHaveClass(/is-open/);
    await expect(trigger).toBeFocused();
  });

  test('activating a menu link navigates and closes the menu', async ({ page }) => {
    await page.goto('/design-system');
    const { drawer } = await openMenu(page);
    await drawer.getByRole('link', { name: 'TOKENS', exact: true }).click();
    await expect(page).toHaveURL(/\/design-system\/tokens$/);
    await expect(page.locator(`#${DS_DRAWER_ID}`)).not.toHaveClass(/is-open/);
  });
});

for (const width of WIDTHS) {
  test(`design-system shell reflows without sideways scroll at ${width}`, async ({ page }) => {
    await page.setViewportSize({
      width,
      height: width < 768 ? MOBILE_HEIGHT : DESKTOP_HEIGHT,
    });
    for (const { href } of DS_PAGER) {
      await page.goto(href);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${href} scrolls sideways at ${width}`).toBeLessThanOrEqual(0);
      const small = await page
        .locator('.site-bar a:visible, .site-bar button:visible, nav.pager a:visible')
        .evaluateAll(
          (nodes, min) =>
            nodes
              .map((node) => node.getBoundingClientRect())
              .filter((box) => box.width < min || box.height < min).length,
          MIN_TARGET_PX,
        );
      expect(small, `${href} has targets under ${MIN_TARGET_PX}px at ${width}`).toBe(0);
    }
  });
}

test('pager links carry previous and next accessible names', async ({ page }) => {
  await page.goto('/design-system/tokens');
  const pager = page.getByRole('navigation', { name: 'Pagination' });
  await expect(pager.getByRole('link', { name: 'Previous: Overview' })).toHaveAttribute(
    'href',
    '/design-system',
  );
  await expect(pager.getByRole('link', { name: 'Next: Components' })).toHaveAttribute(
    'href',
    '/design-system/components',
  );
});
