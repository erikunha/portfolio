import { expect, type Page, test } from '@playwright/test';
import { NAVIGATION } from '@/content/navigation';
import { SITE_LOCALE, type SiteLocale } from '@/content/site-locale';
import { horizontalOverflow } from './_helpers/geometry';
import { DOCK_MENU, waitForHydration } from './_helpers/hydration';
import { freezeMotion } from './_helpers/motion';
import { gotoSettled } from './_helpers/streamed';

const SMALL_PHONE = { width: 320, height: 568 } as const;
const HOME_PATHS: Record<SiteLocale, string> = { en: '/', pt: '/pt' };
const DRAWER = '#section-drawer';
const DOCK_CONTROLS = '.dock > a, .dock > button';
const DRAWER_ROWS = `${DRAWER} a[href], ${DRAWER} button`;
const SCROLL_LOCK = 'html[data-scroll-locked]';
const SUBPIXEL_PX = 1;
const SCROLLED_PX = 400;
const WHEEL_PX = 600;
const SETTLE_MS = 150;
const WEBKIT = 'webkit';

async function openAt320(page: Page, locale: SiteLocale): Promise<void> {
  await page.setViewportSize(SMALL_PHONE);
  await freezeMotion(page);
  await gotoSettled(page, HOME_PATHS[locale]);
  await waitForHydration(page, DOCK_MENU);
}

for (const locale of Object.values(SITE_LOCALE)) {
  test.describe(`dock and drawer at ${SMALL_PHONE.width}x${SMALL_PHONE.height}, ${locale}`, () => {
    test('every dock control sits inside the viewport with its label whole', async ({ page }) => {
      await openAt320(page, locale);

      const boxes = await page.locator(DOCK_CONTROLS).evaluateAll((nodes) =>
        nodes.map((node) => {
          const box = node.getBoundingClientRect();
          return {
            label: node.textContent?.trim() ?? '',
            left: box.left,
            right: box.right,
            top: box.top,
            bottom: box.bottom,
            clipped: node.scrollWidth > node.clientWidth,
          };
        }),
      );

      expect(boxes.map((box) => box.label)).toEqual(
        NAVIGATION[locale].dock.map((control) => control.label),
      );
      for (const box of boxes) {
        expect(box.left, `${box.label} starts left of the viewport`).toBeGreaterThanOrEqual(0);
        expect(box.right, `${box.label} ends right of the viewport`).toBeLessThanOrEqual(
          SMALL_PHONE.width + SUBPIXEL_PX,
        );
        expect(box.top, `${box.label} starts above the viewport`).toBeGreaterThanOrEqual(0);
        expect(box.bottom, `${box.label} ends below the viewport`).toBeLessThanOrEqual(
          SMALL_PHONE.height + SUBPIXEL_PX,
        );
        expect(box.clipped, `${box.label} is wider than its control`).toBe(false);
      }
      expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    });

    test('every drawer row fits the width and the page does not scroll sideways', async ({
      page,
    }) => {
      await openAt320(page, locale);
      await page.locator(DOCK_MENU).click();
      await expect(page.locator(DRAWER)).toHaveClass(/is-open/);

      const rows = await page.locator(DRAWER_ROWS).evaluateAll((nodes) =>
        nodes.map((node) => {
          const box = node.getBoundingClientRect();
          return {
            label: (node.textContent ?? '').trim().replace(/\s+/g, ' '),
            left: box.left,
            right: box.right,
            clipped: node.scrollWidth > node.clientWidth,
          };
        }),
      );

      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) {
        expect(row.left, `${row.label} starts left of the viewport`).toBeGreaterThanOrEqual(0);
        expect(row.right, `${row.label} ends right of the viewport`).toBeLessThanOrEqual(
          SMALL_PHONE.width + SUBPIXEL_PX,
        );
        expect(row.clipped, `${row.label} is wider than its row`).toBe(false);
      }
      expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    });

    test('the open drawer locks the page scroll', async ({ page, browserName, isMobile }) => {
      await openAt320(page, locale);
      await page.evaluate((top) => window.scrollTo(0, top), SCROLLED_PX);
      await page.waitForTimeout(SETTLE_MS);
      const before = await page.evaluate(() => window.scrollY);
      expect(before, 'the page was scrolled before the drawer opened').toBeGreaterThan(0);
      await page.locator(DOCK_MENU).click();
      await expect(page.locator(DRAWER)).toHaveClass(/is-open/);
      await expect(page.locator(SCROLL_LOCK)).toHaveCount(1);

      expect(
        await page.evaluate(() => getComputedStyle(document.documentElement).overflowY),
        'the lock must hide the page scrollbar track',
      ).toBe('hidden');
      if (browserName === WEBKIT && isMobile) return;
      await page.mouse.move(SMALL_PHONE.width / 2, SMALL_PHONE.height / 2);
      await page.mouse.wheel(0, WHEEL_PX);
      await page.waitForTimeout(SETTLE_MS);
      expect(await page.evaluate(() => window.scrollY), 'the page behind the drawer moved').toBe(
        before,
      );
    });

    test('Tab cycles inside the open drawer and never reaches the page behind', async ({
      page,
      browserName,
    }) => {
      test.skip(
        browserName === WEBKIT,
        'WebKit on macOS leaves links and buttons out of the Tab order, so the trap has nothing to cycle',
      );
      await openAt320(page, locale);
      await page.locator(DOCK_MENU).click();
      await expect(page.locator(DRAWER)).toHaveClass(/is-open/);

      const controls = await page.locator(DRAWER_ROWS).count();
      for (let step = 0; step < controls + 2; step++) {
        await page.keyboard.press('Tab');
        const inside = await page.evaluate(
          (selector) => document.querySelector(selector)?.contains(document.activeElement),
          DRAWER,
        );
        expect(inside, `Tab ${step + 1} left the open drawer`).toBe(true);
      }
    });

    test('Escape closes the drawer, releases the lock and returns focus to the dock', async ({
      page,
    }) => {
      await openAt320(page, locale);
      const opener = page.locator(DOCK_MENU);
      await opener.click();
      await expect(page.locator(DRAWER)).toHaveClass(/is-open/);

      await page.keyboard.press('Escape');

      await expect(page.locator(DRAWER)).not.toHaveClass(/is-open/);
      await expect(page.locator(SCROLL_LOCK)).toHaveCount(0);
      await expect(opener).toBeFocused();
      await expect(opener).toHaveAttribute('aria-expanded', 'false');
    });
  });
}
