import { expect, test } from '@playwright/test';
import { SECTION_LABELS } from '@/content/section-labels';

const MODULE_IDS = [
  'sec-shell',
  'sec-live-metrics',
  'sec-projects',
  'sec-guitar',
  'sec-contact',
] as const;
const VIEWPORTS = [320, 390, 768, 1280];
const ICON_GAP_TOLERANCE_PX = 12;

for (const width of VIEWPORTS) {
  test.describe(`module headers at ${width}`, () => {
    test.use({ viewport: { width, height: 900 } });

    for (const id of MODULE_IDS) {
      test(`${id} shows its nav label and keeps the icon next to it`, async ({ page }) => {
        await page.goto('/');
        const heading = page.locator(`#${id} > header h2`);
        await heading.scrollIntoViewIfNeeded();
        const name = heading.locator('.module-name');
        await expect(name).toBeVisible();
        await expect(name).toHaveText(SECTION_LABELS[id]);
        const gap = await heading.evaluate((h2) => {
          const label = h2.querySelector('.module-name')?.getBoundingClientRect();
          const icon = h2.children[1]?.getBoundingClientRect();
          return label && icon ? icon.left - label.right : Number.NaN;
        });
        expect(gap, 'space between the title and its icon').toBeLessThanOrEqual(
          ICON_GAP_TOLERANCE_PX,
        );
        const overflow = await heading.evaluate((h2) => h2.scrollWidth - h2.clientWidth);
        expect(overflow, 'header text spills past its box').toBeLessThanOrEqual(0);
      });
    }
  });
}
