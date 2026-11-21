import { type BrowserContext, expect, test } from '@playwright/test';
import { VIEWPORTS, WIDTH } from '../../../tests/e2e/_helpers/geometry';
import { freezeMotion, MOTION_CHOICE, seedMotionChoice } from '../../../tests/e2e/_helpers/motion';

const DESKTOP = { width: WIDTH.DESKTOP, height: 900 };
const PHONE = VIEWPORTS.PHONE;
const BOUNDARY_SWAP = /\$RC\("B:/g;
const BOUNDARY_HELD = 'void("B:';
const APP_SCRIPT = /\/_next\/static\/.*\.js/;
const LOADING_BOX = '.daw-mixer-loading';
const BOOT_CURSOR = '.mixer-boot-cursor';
const BLINK_ANIMATION = 'mixer-boot-blink';
const STEPPED_TIMING = /steps\(/;

async function holdMixerLoading(context: BrowserContext) {
  await context.route('**/*', async (route) => {
    const request = route.request();
    if (request.resourceType() === 'script' && APP_SCRIPT.test(request.url())) {
      await route.abort();
      return;
    }
    if (request.resourceType() !== 'document') {
      await route.continue();
      return;
    }
    const response = await route.fetch();
    const body = (await response.text()).replace(BOUNDARY_SWAP, BOUNDARY_HELD);
    await route.fulfill({ response, body });
  });
}

test.describe('Guitar mixer loading state', () => {
  test('the boot cursor blinks in steps while motion is on', async ({ page, context }) => {
    await seedMotionChoice(context, MOTION_CHOICE.on);
    await holdMixerLoading(context);
    await page.setViewportSize(DESKTOP);
    await page.goto('/');
    const cursor = page.locator(BOOT_CURSOR);
    await expect(cursor).toHaveCount(1);
    await expect(cursor).toHaveCSS('animation-name', BLINK_ANIMATION);
    await expect(cursor).toHaveCSS('animation-timing-function', STEPPED_TIMING);
  });

  test('the boot cursor stays still while the MOTION switch is off', async ({ page, context }) => {
    await freezeMotion(context);
    await holdMixerLoading(context);
    await page.setViewportSize(DESKTOP);
    await page.goto('/');
    await expect(page.locator(BOOT_CURSOR)).toHaveCount(1);
    await expect(page.locator('body')).toHaveAttribute('data-motion', 'reduce');
    await expect(page.locator(BOOT_CURSOR)).toHaveCSS('animation-name', 'none');
  });

  for (const viewport of [DESKTOP, PHONE]) {
    test(`the loading box keeps its reserved height at ${viewport.width}px`, async ({
      page,
      context,
    }) => {
      await freezeMotion(context);
      await holdMixerLoading(context);
      await page.setViewportSize(viewport);
      await page.goto('/');
      const box = page.locator(LOADING_BOX);
      await expect(box).toHaveCount(1);
      const heights = await box.evaluate((element) => {
        const probe = document.createElement('div');
        probe.style.height = 'var(--daw-mixer-loading-height)';
        element.append(probe);
        const reserved = probe.getBoundingClientRect().height;
        probe.remove();
        return { reserved, minHeight: Number.parseFloat(getComputedStyle(element).minHeight) };
      });
      expect(
        heights.reserved,
        'the reserved height token resolves to a real length',
      ).toBeGreaterThan(0);
      expect(heights.minHeight, 'the box holds the token as its minimum height').toBeCloseTo(
        heights.reserved,
        1,
      );
      expect((await box.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(heights.reserved - 1);
    });
  }
});
