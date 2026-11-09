import { expect, test } from '@playwright/test';
import { NAVIGATION } from '@/content/navigation';
import { SITE_LOCALE } from '@/content/site-locale';
import { freezeMotion } from '../../../tests/e2e/_helpers/motion';

const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 720 };
const BAR_SELECTOR = '.status-bar, .mobile-title-bar, .desktop-topbar';
const SCROLL_SETTLE_TIMEOUT_MS = 8000;

async function settleScroll(page: import('@playwright/test').Page) {
  await page.waitForFunction(
    () => {
      const tracker = window as unknown as {
        __lastScrollY?: number;
        __stableReads?: number;
      };
      if (tracker.__lastScrollY === window.scrollY) {
        tracker.__stableReads = (tracker.__stableReads ?? 0) + 1;
      } else {
        tracker.__stableReads = 0;
        tracker.__lastScrollY = window.scrollY;
      }
      return (tracker.__stableReads ?? 0) >= 3;
    },
    undefined,
    { timeout: SCROLL_SETTLE_TIMEOUT_MS, polling: 150 },
  );
}

async function openDrawer(page: import('@playwright/test').Page) {
  const trigger = page
    .getByRole('button', { name: 'Open menu', exact: true })
    .locator('visible=true');
  await trigger.click();
  await expect(page.locator('#section-drawer')).toBeVisible();
}

test.describe('SectionNavigation', () => {
  test('the drawer carries no language links, the header does', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/');
    await openDrawer(page);

    await expect(page.locator('#section-drawer [data-lang-switch]')).toHaveCount(0);
    await expect(page.locator('#section-drawer a[hreflang]')).toHaveCount(0);
    await expect(
      page.locator('.desktop-topbar').getByRole('navigation', { name: 'Language' }),
    ).toBeVisible();
  });

  test('the page offers no search trigger and Cmd or Ctrl K does not open the drawer', async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/');
    await page.waitForFunction(() =>
      document.documentElement.classList.contains('type-reveal-ready'),
    );
    await expect(page.getByRole('button', { name: /^(SEARCH|BUSCAR)/ })).toHaveCount(0);

    await page.keyboard.press('Control+k');
    await page.keyboard.press('Meta+k');
    await expect(page.locator('#section-drawer')).not.toHaveClass(/is-open/);
  });

  test.describe('anchor jumps clear the fixed bars', () => {
    for (const viewport of [PHONE, DESKTOP]) {
      test(`the About heading clears every bar at ${viewport.width}px`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await page.goto('/');
        await openDrawer(page);
        await page.locator('#section-nav').getByRole('link', { name: 'About' }).click();
        await expect(page.locator('#sec-readme')).toBeInViewport();
        await settleScroll(page);

        const geometry = await page.evaluate((barSelector) => {
          const bars = [...document.querySelectorAll(barSelector)]
            .map((bar) => bar.getBoundingClientRect())
            .filter((box) => box.height > 0 && box.top < 200);
          const section = document.querySelector('#sec-readme');
          const heading = section?.querySelector('h2');
          return {
            barBottom: bars.reduce((lowest, box) => Math.max(lowest, box.bottom), 0),
            sectionTop: section?.getBoundingClientRect().top ?? Number.NaN,
            headingTop: heading?.getBoundingClientRect().top ?? Number.NaN,
          };
        }, BAR_SELECTOR);

        expect(
          geometry.sectionTop,
          'the scroll target must land below the bars, not under them',
        ).toBeGreaterThanOrEqual(geometry.barBottom);
        expect(
          geometry.headingTop,
          'the section heading must stay clear of the fixed bars',
        ).toBeGreaterThanOrEqual(geometry.barBottom);
      });
    }
  });

  for (const system of ['reduce', 'no-preference'] as const) {
    test.describe(`the motion control with the system set to ${system}`, () => {
      test.use({ reducedMotion: system });

      test('the drawer reads MOTION: ON on a first visit', async ({ page }) => {
        await page.goto('/');
        await openDrawer(page);
        await expect(page.locator('.menu-motion')).toContainText(
          NAVIGATION[SITE_LOCALE.en].copy.motionOn,
        );
      });

      test('the drawer reads MOTION: OFF once the visitor stored OFF', async ({ page }) => {
        await freezeMotion(page);
        await page.goto('/');
        await openDrawer(page);
        await expect(page.locator('.menu-motion')).toContainText(
          NAVIGATION[SITE_LOCALE.en].copy.motionOff,
        );
      });
    });
  }
});
