import { expect, type Page, test } from '@playwright/test';
import { waitForHydration } from '../../../tests/e2e/_helpers/hydration';
import { freezeMotion } from '../../../tests/e2e/_helpers/motion';

const RAIN_CANVAS = 'canvas[style*="position: fixed"]';
const TOGGLE = '.topbar-action-toggle';
const SAMPLE_GAP_MS = 700;
const RAIN_START_TIMEOUT_MS = 8000;
const CANVAS_DEFAULT_WIDTH = 300;

async function snapshot(page: Page): Promise<string> {
  return page.locator(RAIN_CANVAS).evaluate((canvas) => (canvas as HTMLCanvasElement).toDataURL());
}

async function waitForRainSized(page: Page): Promise<void> {
  await expect
    .poll(
      () => page.locator(RAIN_CANVAS).evaluate((canvas) => (canvas as HTMLCanvasElement).width),
      {
        timeout: RAIN_START_TIMEOUT_MS,
        message: 'the rain sizes and paints its canvas in the first idle window',
      },
    )
    .not.toBe(CANVAS_DEFAULT_WIDTH);
}

test.describe('Matrix rain follows the MOTION control', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test('starts when MOTION is switched on after loading with reduced motion', async ({ page }) => {
    await freezeMotion(page);
    await page.goto('/');
    await waitForHydration(page, TOGGLE);
    await expect(page.locator(RAIN_CANVAS)).toBeAttached();
    await waitForRainSized(page);
    await expect(page.locator(TOGGLE)).toHaveAttribute('aria-pressed', 'false');

    const still = await snapshot(page);
    await page.waitForTimeout(SAMPLE_GAP_MS);
    expect(await snapshot(page), 'the rain is still while motion is off').toBe(still);

    await page.locator(TOGGLE).click();
    await expect(page.locator(TOGGLE)).toHaveAttribute('aria-pressed', 'true');
    await expect
      .poll(async () => (await snapshot(page)) !== still, {
        timeout: RAIN_START_TIMEOUT_MS,
        message: 'the rain must start falling once motion is switched on',
      })
      .toBe(true);
  });

  test('stays still through a tab return while motion is off', async ({ page }) => {
    await freezeMotion(page);
    await page.goto('/');
    await waitForHydration(page, TOGGLE);
    await expect(page.locator(RAIN_CANVAS)).toBeAttached();
    await waitForRainSized(page);

    const still = await snapshot(page);
    await page.evaluate(() => {
      for (const hidden of [true, false]) {
        Object.defineProperty(document, 'hidden', { value: hidden, configurable: true });
        document.dispatchEvent(new Event('visibilitychange'));
      }
    });
    await page.waitForTimeout(SAMPLE_GAP_MS);

    expect(await snapshot(page), 'a tab return must not restart the rain with motion off').toBe(
      still,
    );
  });
});
