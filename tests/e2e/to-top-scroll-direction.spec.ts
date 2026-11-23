import { boxOf, WIDTH } from './_helpers/geometry';
import { freezeMotion } from './_helpers/motion';
import { expect, type Page, test } from './_helpers/test';
import { scrollByInput } from './_helpers/to-top';

const PHONE = { width: WIDTH.PHONE_COMPACT, height: 812 } as const;
const WHEEL_DOWN_STEP_PX = 250;
const WHEEL_DOWN_STEPS = 6;
const WHEEL_UP_PX = 120;
const BEYOND_THRESHOLD_PX = 400;
const AT_TOP_BELOW_PX = 10;
const SCROLL_SETTLE_TIMEOUT_MS = 8000;

test.use({ viewport: PHONE });

async function wheelDown(page: Page): Promise<void> {
  for (let step = 0; step < WHEEL_DOWN_STEPS; step += 1) {
    await scrollByInput(page, WHEEL_DOWN_STEP_PX);
    await page.waitForTimeout(60);
  }
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(BEYOND_THRESHOLD_PX);
}

test.describe('the back-to-top tab shows only on a scroll up', { tag: '@cross-browser' }, () => {
  test.beforeEach(async ({ page }) => {
    await freezeMotion(page);
    await page.goto('/');
  });

  test('stays hidden and inert while reading down, then shows on a small scroll up', async ({
    page,
  }) => {
    const tab = page.locator('.to-top-btn');
    await wheelDown(page);
    await expect(tab, 'scrolling down is reading: the tab must not cover text').not.toHaveClass(
      /to-top-show/,
    );
    await expect(tab).toHaveAttribute('inert', '');
    await expect(tab).toHaveCSS('pointer-events', 'none');

    await scrollByInput(page, -WHEEL_UP_PX);
    await expect(tab).toHaveClass(/to-top-show/);
    await expect(tab).not.toHaveAttribute('inert', '');
    const box = await boxOf(tab, 'the back-to-top tab');
    expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44);

    await tab.click();
    await expect
      .poll(() => page.evaluate(() => window.scrollY), { timeout: SCROLL_SETTLE_TIMEOUT_MS })
      .toBeLessThan(AT_TOP_BELOW_PX);
    await expect(tab).not.toHaveClass(/to-top-show/);
  });

  test('hides again when the reader resumes scrolling down', async ({ page }) => {
    const tab = page.locator('.to-top-btn');
    await wheelDown(page);
    await scrollByInput(page, -WHEEL_UP_PX);
    await expect(tab).toHaveClass(/to-top-show/);
    await scrollByInput(page, WHEEL_UP_PX);
    await expect(tab).not.toHaveClass(/to-top-show/);
    await expect(tab).toHaveAttribute('inert', '');
  });
});
