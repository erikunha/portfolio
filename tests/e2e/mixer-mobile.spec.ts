import { expect, test } from '@playwright/test';
import { installMockBackend } from './_helpers/mock-backend';

const MIXER_SELECTOR = '#sec-daw-mixer';
const MOBILE_WIDTHS = [320, 390];
const VIEWPORT_HEIGHT = 800;
const SUBPIXEL_TOLERANCE = 1;
const TOUCH_TARGET_PX = '44px';
const SPACING_2_PX = '8px';
const SPACING_3_PX = '12px';

for (const width of MOBILE_WIDTHS) {
  test(`mixer reflows without horizontal overflow at ${width}px`, async ({ page }) => {
    await installMockBackend(page, { log: 'accept', forget: 'happy' });
    await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
    await page.goto('/');
    const mixer = page.locator(MIXER_SELECTOR);
    await mixer.scrollIntoViewIfNeeded();
    await expect(mixer.locator('[data-testid^="channel-"]').first()).toBeVisible();

    const result = await page.evaluate((selector) => {
      const root = document.querySelector(selector);
      const viewport = window.innerWidth;
      const offenders: string[] = [];
      for (const el of root?.querySelectorAll('*') ?? []) {
        const style = getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') continue;
        if (el.closest('.mx-skip')) continue;
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) continue;
        if (rect.right > viewport + 1 || rect.left < -1) {
          offenders.push(
            `${el.tagName}.${String(el.className).slice(0, 40)} right=${Math.round(rect.right)}`,
          );
        }
      }
      return { offenders, scrollWidth: document.documentElement.scrollWidth, viewport };
    }, MIXER_SELECTOR);

    expect(result.offenders, 'mixer elements extend past the viewport').toEqual([]);
    expect(result.scrollWidth).toBeLessThanOrEqual(result.viewport + SUBPIXEL_TOLERANCE);
  });
}

for (const width of MOBILE_WIDTHS) {
  test(`rms buttons meet the touch target at ${width}px`, async ({ page }) => {
    await installMockBackend(page, { log: 'accept', forget: 'happy' });
    await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
    await page.goto('/');
    const mixer = page.locator(MIXER_SELECTOR);
    await mixer.scrollIntoViewIfNeeded();
    await expect(mixer.locator('[data-testid^="channel-"]').first()).toBeVisible();

    const buttonBox = await page.evaluate((selector) => {
      const button = document.querySelector(`${selector} .rms-buttons > button`);
      const group = document.querySelector(`${selector} .rms-buttons`);
      const buttonStyle = button ? getComputedStyle(button) : null;
      return {
        minHeight: buttonStyle?.minHeight ?? null,
        renderedHeight: button?.getBoundingClientRect().height ?? null,
        gap: group ? getComputedStyle(group).gap : null,
      };
    }, MIXER_SELECTOR);

    expect(buttonBox.minHeight, 'utilities must not pin min-height over the components layer').toBe(
      TOUCH_TARGET_PX,
    );
    expect(buttonBox.renderedHeight).toBeGreaterThanOrEqual(44);
    expect(buttonBox.gap, 'utilities must not pin gap over the components layer').toBe(
      SPACING_2_PX,
    );
  });
}

test('channel rows use the compact padding between 768px and 1100px', async ({ page }) => {
  await installMockBackend(page, { log: 'accept', forget: 'happy' });
  await page.setViewportSize({ width: 900, height: VIEWPORT_HEIGHT });
  await page.goto('/');
  const mixer = page.locator(MIXER_SELECTOR);
  await mixer.scrollIntoViewIfNeeded();
  await expect(mixer.locator('[data-testid^="channel-"]').first()).toBeVisible();

  const padding = await page.evaluate((selector) => {
    const row = document.querySelector(`${selector} fieldset.daw-channel-row`);
    const style = row ? getComputedStyle(row) : null;
    return style
      ? `${style.paddingTop} ${style.paddingRight} ${style.paddingBottom} ${style.paddingLeft}`
      : null;
  }, MIXER_SELECTOR);

  expect(padding, 'utilities must not pin row padding over the components layer').toBe(
    `${SPACING_3_PX} ${SPACING_3_PX} ${SPACING_3_PX} ${SPACING_3_PX}`,
  );
});
