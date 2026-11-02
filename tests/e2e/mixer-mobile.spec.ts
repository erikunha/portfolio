import { expect, test } from '@playwright/test';
import { installMockBackend } from './_helpers/mock-backend';

const MIXER_SELECTOR = '#sec-guitar [data-testid="daw-mixer-desktop"]';
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

test('no two cells of a channel row overlap between 768px and 1100px', async ({ page }) => {
  await installMockBackend(page, { log: 'accept', forget: 'happy' });
  await page.setViewportSize({ width: 900, height: VIEWPORT_HEIGHT });
  await page.goto('/');
  const mixer = page.locator(MIXER_SELECTOR);
  await mixer.scrollIntoViewIfNeeded();
  await expect(mixer.locator('[data-testid^="channel-"]').first()).toBeVisible();

  const offenders = await page.evaluate((selector) => {
    const row = document.querySelector(`${selector} fieldset.daw-channel-row`);
    if (!row) return ['the mixer has no channel row'];
    const cells = Array.from(row.children).map((child, index) => ({
      index,
      label: child.className ? String(child.className).split(' ')[0] : child.tagName,
      rect: child.getBoundingClientRect(),
    }));
    const overlaps: string[] = [];
    for (let first = 0; first < cells.length; first += 1) {
      const a = cells[first];
      if (!a) continue;
      for (let second = first + 1; second < cells.length; second += 1) {
        const b = cells[second];
        if (!b) continue;
        if (a.rect.width === 0 || a.rect.height === 0) continue;
        if (b.rect.width === 0 || b.rect.height === 0) continue;
        const sharesX = a.rect.left < b.rect.right - 1 && b.rect.left < a.rect.right - 1;
        const sharesY = a.rect.top < b.rect.bottom - 1 && b.rect.top < a.rect.bottom - 1;
        if (sharesX && sharesY) {
          overlaps.push(`cell ${a.index} (${a.label}) overlaps cell ${b.index} (${b.label})`);
        }
      }
    }
    return overlaps;
  }, MIXER_SELECTOR);

  expect(offenders, 'grid cells of a channel row must not share the same grid area').toEqual([]);
});

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

const NARROW_WIDTHS = [320, 340, 360, 390];
const CELL_PARTS = [
  '.knob-container',
  '.rms-buttons > button',
  '.mx-channel-id > span',
  '.mx-channel-track > *',
  '.mx-channel-plugins .flex-none',
  '.mx-channel-meter',
  '.mx-fader',
].join(', ');
const OVERLAP_TOLERANCE_PX = 2;

for (const width of NARROW_WIDTHS) {
  test(`no knob, button or label of a channel row overlaps another at ${width}px`, async ({
    page,
  }) => {
    await installMockBackend(page, { log: 'accept', forget: 'happy' });
    await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
    await page.goto('/');
    const mixer = page.locator(MIXER_SELECTOR);
    await mixer.scrollIntoViewIfNeeded();
    await expect(mixer.locator('[data-testid^="channel-"]').first()).toBeVisible();

    const overlaps = await page.evaluate(
      ({ selector, parts, tolerance }) => {
        const found: string[] = [];
        for (const row of document.querySelectorAll(`${selector} fieldset.daw-channel-row`)) {
          const parts_ = Array.from(row.querySelectorAll(parts)).filter((part) => {
            const box = part.getBoundingClientRect();
            return box.width > 0 && box.height > 0;
          });
          for (const [index, first] of parts_.entries()) {
            for (const second of parts_.slice(index + 1)) {
              if (first.contains(second) || second.contains(first)) continue;
              const a = first.getBoundingClientRect();
              const b = second.getBoundingClientRect();
              const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left);
              const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
              if (overlapX > tolerance && overlapY > tolerance) {
                const name = (el: Element) => el.getAttribute('aria-label') ?? String(el.className);
                found.push(`${row.getAttribute('data-testid')}: ${name(first)} x ${name(second)}`);
              }
            }
          }
        }
        return found;
      },
      { selector: MIXER_SELECTOR, parts: CELL_PARTS, tolerance: OVERLAP_TOLERANCE_PX },
    );

    expect(overlaps, 'channel row controls must not share pixels').toEqual([]);
  });
}

test('rms buttons keep a 44px touch target on coarse pointers at desktop width', async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 1280, height: VIEWPORT_HEIGHT },
    hasTouch: true,
    isMobile: false,
  });
  const page = await context.newPage();
  await installMockBackend(page, { log: 'accept', forget: 'happy' });
  await page.goto('/');
  const mixer = page.locator(MIXER_SELECTOR);
  await mixer.scrollIntoViewIfNeeded();
  const button = mixer.locator('.rms-buttons > button').first();
  const coarse = await page.evaluate(() => matchMedia('(pointer: coarse)').matches);
  test.skip(!coarse, 'this browser context does not report a coarse pointer');
  const box = await button.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
  await context.close();
});
