import { expect, test } from '@playwright/test';
import { NAVIGATION } from '../../content/navigation';
import { SITE_LOCALE } from '../../content/site-locale';
import { gotoSettled } from './_helpers/streamed';

const WIDTHS = [320, 390];
const MIN_LABEL_GAP_PX = 8;
const VIEWPORT_HEIGHT = 844;
const ENGLISH_LANG = SITE_LOCALE.en;

for (const width of WIDTHS) {
  test(`the pt dock keeps every label apart and marks the English term at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
    await gotoSettled(page, '/pt');
    const items = await page.locator('.dock > a, .dock > button').evaluateAll((nodes) =>
      nodes.map((node) => {
        const range = document.createRange();
        range.selectNodeContents(node);
        const text = range.getBoundingClientRect();
        return {
          label: node.textContent?.trim() ?? '',
          lang: node.getAttribute('lang'),
          left: text.left,
          right: text.right,
        };
      }),
    );
    expect(items.map((item) => item.label)).toEqual(
      NAVIGATION[SITE_LOCALE.pt].dock.map((control) => control.label),
    );
    items.slice(1).forEach((item, index) => {
      const gap = item.left - (items[index]?.right ?? 0);
      expect(
        gap,
        `"${items[index]?.label}" and "${item.label}" sit ${gap}px apart at ${width}px`,
      ).toBeGreaterThanOrEqual(MIN_LABEL_GAP_PX);
    });
    const marked = items.filter((item) => item.lang === ENGLISH_LANG).map((item) => item.label);
    expect(
      marked,
      'SHELL is the English product term inside a Portuguese dock, so it carries lang="en"',
    ).toEqual(['SHELL']);
  });
}

test('the en dock marks no label as another language', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: VIEWPORT_HEIGHT });
  await gotoSettled(page, '/');
  await expect(page.locator('.dock > [lang]')).toHaveCount(0);
});
