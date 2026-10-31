import { expect, type Page, test } from '@playwright/test';
import { stripVolatileChrome } from './_helpers/mask-volatile';

const INPUT = '[aria-label="shell command"]';

type Rgb = [number, number, number];

function relativeLuminance(rgb: Rgb): number {
  const channel = (value: number) => {
    const normalized = value / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
}

function contrastRatio(foreground: Rgb, background: Rgb): number {
  const light = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const dark = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (light + 0.05) / (dark + 0.05);
}

function parseRgb(value: string): Rgb {
  const channels = value.match(/\d+(\.\d+)?/g);
  if (!channels || channels.length < 3) throw new Error(`unparsable color: ${value}`);
  return [Number(channels[0]), Number(channels[1]), Number(channels[2])];
}

async function documentBox(page: Page, selector: string) {
  return page
    .locator(selector)
    .first()
    .evaluate((node) => {
      const rect = node.getBoundingClientRect();
      return {
        x: rect.left + window.scrollX,
        y: rect.top + window.scrollY,
        width: rect.width,
        height: rect.height,
      };
    });
}

async function focusByKeyboard(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    await page.keyboard.press('Tab');
    const reached = await page
      .locator(INPUT)
      .first()
      .evaluate((node) => node === document.activeElement);
    if (reached) return;
  }
  throw new Error('the shell input was not reachable with the keyboard');
}

async function openShell(page: Page): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.waitForSelector('[data-testid="shell-form"]', { state: 'visible' });
  await page.locator(INPUT).first().scrollIntoViewIfNeeded();
  await stripVolatileChrome(page);
}

test.describe('shell input states', () => {
  test('the input keeps the same box when the keyboard moves focus into it', async ({ page }) => {
    await openShell(page);
    const input = page.locator(INPUT).first();

    const before = await documentBox(page, INPUT);
    expect(before.width, 'the shell input must have a box before focus').toBeGreaterThan(0);

    await focusByKeyboard(page);
    const focusVisible = await input.evaluate((node) => node.matches(':focus-visible'));
    expect(
      focusVisible,
      'the shell input must expose a focus-visible state on the keyboard path',
    ).toBe(true);

    const after = await documentBox(page, INPUT);
    expect(after, 'focusing the shell input must not move or resize the field').toEqual(before);
  });

  test('the focus indicator is painted inside the field and leaves the panel around it untouched', async ({
    page,
  }) => {
    await openShell(page);
    const input = page.locator(INPUT).first();
    await input.click();
    await input.fill('x');
    await input.blur();

    const box = await input.boundingBox();
    expect(box, 'the shell input must have a box').not.toBeNull();
    if (!box) return;

    const bandAbove = {
      x: box.x,
      y: Math.max(0, box.y - 10),
      width: box.width,
      height: 10,
    };
    const inside = {
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
    };

    const bandBefore = await page.screenshot({ clip: bandAbove });
    const insideBefore = await page.screenshot({ clip: inside });

    await input.click();
    await page.waitForTimeout(120);

    const bandAfter = await page.screenshot({ clip: bandAbove });
    const insideAfter = await page.screenshot({ clip: inside });

    expect(
      insideBefore.equals(insideAfter),
      'focusing the shell input must paint a visible focus indicator inside the field',
    ).toBe(false);
    expect(
      bandBefore.equals(bandAfter),
      'the focus indicator must stay inside the field instead of drawing a ring outside it',
    ).toBe(true);
  });

  test('the focus indicator uses the site focus color and keeps 3:1 contrast on the panel', async ({
    page,
  }) => {
    await openShell(page);
    const input = page.locator(INPUT).first();
    await input.click();

    const indicator = await input.evaluate((node) => {
      const computed = getComputedStyle(node);
      const panel = getComputedStyle(document.querySelector('.interactive-shell') ?? node);
      return {
        outlineStyle: computed.outlineStyle,
        outlineWidth: Number.parseFloat(computed.outlineWidth),
        outlineOffset: Number.parseFloat(computed.outlineOffset),
        boxShadow: computed.boxShadow,
        focusColor: getComputedStyle(document.documentElement)
          .getPropertyValue('--color-primary-500')
          .trim(),
        panelBackground: panel.backgroundColor,
      };
    });

    const paintsOutside =
      indicator.outlineStyle !== 'none' &&
      indicator.outlineWidth > 0 &&
      indicator.outlineOffset > 0;
    expect(paintsOutside, 'the shell input must not paint a focus ring outside its own box').toBe(
      false,
    );

    const shadow = indicator.boxShadow;
    const shadowColor = shadow.match(/rgba?\([^)]+\)/)?.[0];
    expect(
      shadowColor ?? null,
      'the shell input must paint a focus indicator that does not change its box',
    ).not.toBeNull();
    if (!shadowColor) return;

    const ratio = contrastRatio(parseRgb(shadowColor), parseRgb(indicator.panelBackground));
    expect(
      ratio,
      `the focus indicator must keep 3:1 contrast against the panel background (${shadowColor} on ${indicator.panelBackground})`,
    ).toBeGreaterThanOrEqual(3);
  });

  test('clicking the input shows the same indicator as the keyboard path', async ({ page }) => {
    await openShell(page);
    const input = page.locator(INPUT).first();

    await focusByKeyboard(page);
    const keyboardIndicator = await input.evaluate((node) => {
      const computed = getComputedStyle(node);
      return { boxShadow: computed.boxShadow, outline: computed.outline };
    });

    await input.blur();
    await input.click();
    const clickIndicator = await input.evaluate((node) => {
      const computed = getComputedStyle(node);
      return { boxShadow: computed.boxShadow, outline: computed.outline };
    });

    expect(
      clickIndicator,
      'a pointer focus must show the same focus indicator as the keyboard path',
    ).toEqual(keyboardIndicator);
  });

  test('the input stays inside the panel at 320', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await openShell(page);
    const input = page.locator(INPUT).first();

    const inputBox = await input.boundingBox();
    const panelBox = await page.locator('.interactive-shell').boundingBox();
    expect(inputBox).not.toBeNull();
    expect(panelBox).not.toBeNull();
    if (!inputBox || !panelBox) return;

    expect(
      inputBox.x,
      'the shell input must not overflow the panel on the left at 320',
    ).toBeGreaterThanOrEqual(panelBox.x);
    expect(
      inputBox.x + inputBox.width,
      'the shell input must not overflow the panel on the right at 320',
    ).toBeLessThanOrEqual(panelBox.x + panelBox.width + 1);
  });
});
