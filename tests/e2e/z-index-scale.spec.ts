import { expect, type Page, test } from '@playwright/test';
import { gotoHydrated } from './_helpers/hydration';
import { freezeMotion } from './_helpers/motion';
import { gotoSettled } from './_helpers/streamed';

const PHONE = { width: 390, height: 844 };
const OFFLINE_BADGE = '○ NO SIGNAL';
const SCALE_ORDER = [
  '.crt-vignette',
  '.crt-scanlines',
  '.crt-mask',
  '.crt-noise',
  '.crt-scan-beam',
  '.page-main',
  '.mobile-title-bar',
  '.desktop-topbar',
  '.to-top-btn',
  '.offline-notice',
  '.dock',
  '.menu-scrim',
  '.pos-line',
  '.section-menu',
  '.skip-to-content',
] as const;

async function zIndexOf(page: Page, selector: string): Promise<number> {
  return page
    .locator(selector)
    .first()
    .evaluate((node) => Number.parseInt(getComputedStyle(node).zIndex, 10));
}

test.describe('the stacking scale', () => {
  test('layers stack in the order the --z-* scale names, from the CRT overlay to the skip link', async ({
    page,
  }) => {
    await page.setViewportSize(PHONE);
    await gotoSettled(page, '/');
    const stack: Record<string, number> = {};
    for (const selector of SCALE_ORDER) stack[selector] = await zIndexOf(page, selector);
    for (const [selector, value] of Object.entries(stack)) {
      expect(Number.isNaN(value), `${selector} has no numeric z-index`).toBe(false);
    }
    for (let i = 1; i < SCALE_ORDER.length; i++) {
      const lower = SCALE_ORDER[i - 1] as string;
      const upper = SCALE_ORDER[i] as string;
      expect(
        stack[upper],
        `${upper} (${stack[upper]}) must sit above ${lower} (${stack[lower]}); the order is the contract in the design-system tokens page`,
      ).toBeGreaterThan(stack[lower] as number);
    }
  });

  test('the open drawer and its scrim cover the offline notice instead of tying with it', async ({
    page,
    context,
  }) => {
    await freezeMotion(page);
    await page.setViewportSize(PHONE);
    await gotoHydrated(page, '/', '.mobile-title-bar button');
    await context.setOffline(true);
    const notice = page.locator('.offline-notice');
    await expect(notice).toContainText(OFFLINE_BADGE);
    await page.locator('.mobile-title-bar .menu-trigger').click();
    await expect(page.locator('.section-menu')).toHaveClass(/is-open/);

    const probe = await page.evaluate(() => {
      const noticeBox = document.querySelector('.offline-notice')?.getBoundingClientRect();
      const drawerBox = document.querySelector('.section-menu')?.getBoundingClientRect();
      if (!noticeBox || !drawerBox) return null;
      const y = noticeBox.top + noticeBox.height / 2;
      const hitAt = (x: number) =>
        document.elementFromPoint(x, y)?.closest('.section-menu, .menu-scrim, .offline-notice')
          ?.className ?? '';
      return {
        overDrawer: hitAt(drawerBox.left + drawerBox.width / 2),
        besideDrawer: hitAt(drawerBox.right + 1),
      };
    });
    expect(probe, 'the notice and the drawer must both render').not.toBeNull();
    expect(probe?.overDrawer, 'the drawer paints over the offline notice').toContain(
      'section-menu',
    );
    expect(probe?.besideDrawer, 'the scrim paints over the offline notice').toContain('menu-scrim');
  });
});
