import { expect, type Page, test } from '@playwright/test';
import { VIEWPORTS } from './_helpers/geometry';

const MAX_HERO_CLS = 0.01;
const BOOT_LINE_COUNT = 11;
const BOOT_SETTLE_MS = 1500;
const MOBILE_BOOT_MIN_WIDTH_PX = 390;
const VIEWPORT_WIDTHS = [
  { name: 'narrow phone', ...VIEWPORTS.PHONE_NARROW },
  { name: 'phone', ...VIEWPORTS.PHONE },
  { name: 'tablet', ...VIEWPORTS.TABLET },
  { name: 'small desktop', width: 1024, height: 768 },
  { name: 'desktop', ...VIEWPORTS.DESKTOP },
] as const;

async function trackLayoutShift(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const shifts: number[] = [];
    Object.defineProperty(window, '__layoutShifts', { value: shifts });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const shift = entry as PerformanceEntry & { value: number; hadRecentInput: boolean };
        if (!shift.hadRecentInput) shifts.push(shift.value);
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });
}

function totalShift(page: Page): Promise<number> {
  return page.evaluate(() =>
    (window as unknown as { __layoutShifts: number[] }).__layoutShifts.reduce(
      (sum, value) => sum + value,
      0,
    ),
  );
}

test.describe('the hero boot sequence never moves the page', () => {
  for (const viewport of VIEWPORT_WIDTHS) {
    test(`at ${viewport.width}px (${viewport.name}) a real load shifts less than ${MAX_HERO_CLS}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await trackLayoutShift(page);
      await page.goto('/', { waitUntil: 'load' });
      if (viewport.width >= VIEWPORT_WIDTHS[2].width) {
        await expect
          .poll(() => page.locator('.hero-desktop [data-testid="boot-line"]').count(), {
            timeout: 15_000,
          })
          .toBeGreaterThanOrEqual(BOOT_LINE_COUNT);
      } else if (viewport.width >= MOBILE_BOOT_MIN_WIDTH_PX) {
        await expect(page.locator('.hero-mobile .hero-boot-cmd')).not.toBeEmpty({
          timeout: 15_000,
        });
      }
      await page.waitForTimeout(BOOT_SETTLE_MS);
      expect(
        await totalShift(page),
        'boot lines appended after hydration must fill reserved slots, not push the layout',
      ).toBeLessThan(MAX_HERO_CLS);
    });
  }
});
