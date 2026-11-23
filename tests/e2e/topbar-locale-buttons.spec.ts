import { WIDTH } from './_helpers/geometry';
import { gotoSettled } from './_helpers/streamed';
import { expect, type Locator, test } from './_helpers/test';

const VIEWPORT_HEIGHT = 720;
const TOPBAR = '.desktop-topbar';
const VISUALLY_HIDDEN_MAX_PX = 1;
const GUTTER_STEP_PX = 32;
const WCAG_TARGET_PX = 24;
const BOX_PROPERTIES = [
  'height',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'fontSize',
  'fontWeight',
  'letterSpacing',
  'textTransform',
  'borderTopWidth',
  'borderTopStyle',
  'borderRadius',
] as const;
const LANGUAGES = [
  { code: 'EN', name: 'English', hreflang: 'en' },
  { code: 'PT', name: 'Portugu', hreflang: 'pt' },
] as const;

type BoxStyle = Record<(typeof BOX_PROPERTIES)[number], string>;

const boxStyle = (locator: Locator): Promise<BoxStyle> =>
  locator.evaluate((node, properties) => {
    const style = getComputedStyle(node);
    return Object.fromEntries(
      properties.map((property) => [property, style[property as keyof CSSStyleDeclaration]]),
    ) as BoxStyle;
  }, BOX_PROPERTIES);

const size = (locator: Locator) =>
  locator.evaluate((node) => {
    const box = node.getBoundingClientRect();
    return { width: box.width, height: box.height };
  });

test.describe('desktop topbar language buttons', () => {
  test.use({ viewport: { width: WIDTH.DESKTOP, height: VIEWPORT_HEIGHT } });

  test('EN and PT measure the same as VIEW_CV', async ({ page }) => {
    await gotoSettled(page, '/');
    const topbar = page.locator(TOPBAR);
    const reference = await boxStyle(topbar.getByRole('link', { name: 'VIEW_CV' }));
    const language = topbar.getByRole('navigation', { name: 'Language' });
    for (const { code, hreflang } of LANGUAGES) {
      const button = language.locator(`a[hreflang="${hreflang}"]`);
      expect(await boxStyle(button), `${code} against VIEW_CV`).toEqual(reference);
    }
  });

  test('the current language has the signal border and the other the quiet border', async ({
    page,
  }) => {
    await gotoSettled(page, '/');
    const language = page.locator(TOPBAR).getByRole('navigation', { name: 'Language' });
    const border = (hreflang: string) =>
      language
        .locator(`a[hreflang="${hreflang}"]`)
        .evaluate((node) => getComputedStyle(node).borderTopColor);
    const active = await border('en');
    const inactive = await border('pt');
    expect(active, 'the active locale keeps the signal border').toBe(
      await page
        .locator(TOPBAR)
        .getByRole('link', { name: 'VIEW_CV' })
        .evaluate((node) => getComputedStyle(node).borderTopColor),
    );
    expect(inactive, 'the inactive locale uses the quiet border').not.toBe(active);
    await expect(language.locator('a[hreflang="en"]')).toHaveAttribute('aria-current', 'page');
  });

  test('the visible label is the short code and the full name stays in the accessible name', async ({
    page,
  }) => {
    await gotoSettled(page, '/');
    const language = page.locator(TOPBAR).getByRole('navigation', { name: 'Language' });
    for (const { code, name } of LANGUAGES) {
      const button = language.getByRole('link', { name: new RegExp(`^${code}\\s*${name}`) });
      await expect(button).toBeVisible();
      const hidden = await size(button.locator('[lang]'));
      expect(hidden.width, `${code} full name takes no room`).toBeLessThanOrEqual(
        VISUALLY_HIDDEN_MAX_PX,
      );
      expect(hidden.height).toBeLessThanOrEqual(VISUALLY_HIDDEN_MAX_PX);
      const visible = await size(button);
      expect(visible.width).toBeGreaterThanOrEqual(WCAG_TARGET_PX);
      expect(visible.height).toBeGreaterThanOrEqual(WCAG_TARGET_PX);
    }
  });

  test('the current language keeps aria-current and the other does not', async ({ page }) => {
    await gotoSettled(page, '/pt');
    const language = page.locator(TOPBAR).locator('[data-lang-switch]');
    await expect(language.locator('a[hreflang="pt"]')).toHaveAttribute('aria-current', 'page');
    await expect(language.locator('a[hreflang="en"]')).not.toHaveAttribute('aria-current');
  });

  test('the first and last controls sit one spacing step in from the viewport edges', async ({
    page,
  }) => {
    await page.setViewportSize({ width: WIDTH.LAPTOP, height: VIEWPORT_HEIGHT });
    await gotoSettled(page, '/');
    const edges = await page
      .locator(TOPBAR)
      .locator('a, button')
      .evaluateAll((nodes) => {
        const boxes = nodes
          .map((node) => node.getBoundingClientRect())
          .filter((box) => box.width > 0 && box.height > 0);
        return {
          left: Math.min(...boxes.map((box) => box.left)),
          right: document.documentElement.clientWidth - Math.max(...boxes.map((box) => box.right)),
        };
      });
    expect(edges.left).toBeGreaterThanOrEqual(GUTTER_STEP_PX);
    expect(edges.right).toBeGreaterThanOrEqual(GUTTER_STEP_PX);
  });
});
