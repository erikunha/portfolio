import { expect, type Page, test } from '@playwright/test';

const SIGNAL_GREEN = 'rgb(0, 255, 65)';
const FIRST_THUMB = '.links-thumb';
const WIDTHS = [320, 390, 768, 1280];

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
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/links');
    await page.locator(`a:has(${FIRST_THUMB})`).first().hover();
    await expect.poll(async () => (await tint(page)).opacity, { timeout: 2000 }).toBeLessThan(0.5);
    const filter = await page
      .locator(`${FIRST_THUMB} img`)
      .first()
      .evaluate((node) => getComputedStyle(node).filter);
    expect(filter).toBe('none');
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
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/links');
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
      await expect(page.locator(FIRST_THUMB).first()).toBeVisible();
    });
  }
});
