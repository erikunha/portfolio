import { expect, test } from '@playwright/test';
import { NAVIGATION } from '@/content/navigation';

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
  test('the search shortcut ships in the server HTML and never shifts the trigger', async ({
    browser,
    baseURL,
    page,
  }) => {
    if (!baseURL) throw new Error('SectionNavigation e2e requires the configured baseURL.');
    const serverContext = await browser.newContext({
      javaScriptEnabled: false,
      baseURL,
      viewport: DESKTOP,
    });
    const serverPage = await serverContext.newPage();
    await serverPage.goto('/');
    const serverTrigger = serverPage.locator('.topbar-search');
    const serverBox = await serverTrigger.boundingBox();
    await serverContext.close();

    const response = await page.request.get('/');
    const html = await response.text();
    expect(
      html,
      'the shortcut must be in the server HTML, an empty slot pops in after hydration',
    ).toContain(NAVIGATION.copy.searchShortcutApple);
    expect(html).toContain(NAVIGATION.copy.searchShortcutOther);

    await page.setViewportSize(DESKTOP);
    await page.goto('/');
    await page.waitForFunction(() =>
      document.documentElement.classList.contains('type-reveal-ready'),
    );
    const hydratedBox = await page.locator('.topbar-search').boundingBox();
    expect(
      hydratedBox?.width,
      'the shortcut slot must reserve its width, so the label swap cannot move the trigger',
    ).toBeCloseTo(serverBox?.width ?? 0, 1);
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

  test.describe('the motion control reports the operating system reduction', () => {
    test.use({ reducedMotion: 'reduce' });

    test('the drawer reads MOTION: REDUCED', async ({ page }) => {
      await page.goto('/');
      await openDrawer(page);
      await expect(page.locator('.menu-motion')).toContainText(NAVIGATION.copy.motionReduced);
    });
  });

  test.describe('the motion control reports motion on by default', () => {
    test.use({ reducedMotion: 'no-preference' });

    test('the drawer reads MOTION: ON', async ({ page }) => {
      await page.goto('/');
      await openDrawer(page);
      await expect(page.locator('.menu-motion')).toContainText(NAVIGATION.copy.motionOn);
    });
  });
});
