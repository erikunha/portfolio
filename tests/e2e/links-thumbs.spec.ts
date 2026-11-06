import { expect, type Page, test } from '@playwright/test';
import { horizontalOverflow, VIEWPORTS } from './_helpers/geometry';

const SIGNAL_GREEN = 'rgb(0, 255, 65)';
const FIRST_THUMB = '.links-thumb';
const WIDTHS = [320, 390, 768, 1280];
const THUMB_FIXTURE = 'tests/e2e/fixtures/thumb.jpg';
const OPTIMIZER_ROUTE = '**/_next/image**';
const VIDEO_RATIO = 16 / 9;
const RATIO_TOLERANCE = 0.02;

const tint = (page: Page) =>
  page
    .locator(FIRST_THUMB)
    .first()
    .evaluate((node) => {
      const after = getComputedStyle(node, '::after');
      return {
        background: after.backgroundColor,
        blend: after.mixBlendMode,
        opacity: Number.parseFloat(after.opacity),
      };
    });

test.describe('/links thumbnail theme overlay', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(OPTIMIZER_ROUTE, (route) =>
      route.fulfill({ path: THUMB_FIXTURE, contentType: 'image/jpeg' }),
    );
  });

  test('every thumbnail sits in the themed frame', async ({ page }) => {
    await page.goto('/links');
    const images = page.locator('main a img[src*="ytimg"], main a img[src*="_next/image"]');
    const count = await images.count();
    expect(count).toBeGreaterThan(0);
    for (const image of await images.all()) {
      await expect(
        image.locator('xpath=ancestor::*[contains(@class,"links-thumb")][1]'),
      ).toHaveCount(1);
    }
  });

  test('covers are grayscale under a signal-green multiply layer from the tokens', async ({
    page,
  }) => {
    await page.goto('/links');
    const filter = await page
      .locator(`${FIRST_THUMB} img`)
      .first()
      .evaluate((node) => getComputedStyle(node).filter);
    expect(filter).toContain('grayscale(1)');
    const layer = await tint(page);
    expect(layer.background).toBe(SIGNAL_GREEN);
    expect(layer.blend).toBe('multiply');
    expect(layer.opacity).toBeGreaterThan(0.5);
  });

  test('a real hover reveals the cover colour and the layer relaxes', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.DESKTOP);
    await page.goto('/links');
    await page.locator(`a:has(${FIRST_THUMB})`).first().hover();
    await expect.poll(async () => (await tint(page)).opacity, { timeout: 2000 }).toBeLessThan(0.5);
    await expect
      .poll(
        () =>
          page
            .locator(`${FIRST_THUMB} img`)
            .first()
            .evaluate((node) => getComputedStyle(node).filter),
        { timeout: 2000 },
      )
      .toBe('none');
  });

  test('reduced motion removes the reveal transition', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/links');
    const durations = await page
      .locator(`${FIRST_THUMB} img`)
      .first()
      .evaluate((node) => getComputedStyle(node).transitionDuration);
    expect(durations).toBe('0s');
  });

  for (const width of WIDTHS) {
    test(`no sideways scroll and a framed cover at ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: VIEWPORTS.DESKTOP.height });
      await page.goto('/links');
      const overflow = await horizontalOverflow(page);
      expect(overflow).toBeLessThanOrEqual(0);
      await expect(page.locator(FIRST_THUMB).first()).toBeVisible();
    });
  }

  for (const width of WIDTHS) {
    test(`every cover frame is 16:9 and the image fills it at ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: VIEWPORTS.DESKTOP.height });
      await page.goto('/links');
      const frames = await page.locator(FIRST_THUMB).evaluateAll((nodes) =>
        nodes.map((node) => {
          const frame = node.getBoundingClientRect();
          const image = node.querySelector('img')?.getBoundingClientRect();
          return {
            ratio: frame.width / frame.height,
            widthGap: image ? Math.abs(image.width - frame.width) : Number.POSITIVE_INFINITY,
            heightGap: image ? Math.abs(image.height - frame.height) : Number.POSITIVE_INFINITY,
          };
        }),
      );
      expect(frames.length).toBeGreaterThan(0);
      for (const frame of frames) {
        expect(Math.abs(frame.ratio - VIDEO_RATIO)).toBeLessThan(RATIO_TOLERANCE * VIDEO_RATIO);
        expect(frame.widthGap).toBeLessThan(1);
        expect(frame.heightGap).toBeLessThan(1);
      }
    });
  }
});
