import { expect, type Page, test } from '@playwright/test';

const WIDTHS = [320, 390, 768, 1280];
const TEXT_BASE_PX = 16;
const TEXT_LG_PX = 18;
const TEXT_BODY_PX = 14;
const TEXT_XS_PX = 12;
const CODE_TITLE_FULL_SIZE_MIN_WIDTH = 390;
const TABLET_MIN_WIDTH = 768;
const SPACE_SECTION_PHONE = 32;
const SPACE_SECTION_TABLET = 48;

const px = (page: Page, selector: string, property: string) =>
  page
    .locator(selector)
    .first()
    .evaluate((el, prop) => getComputedStyle(el).getPropertyValue(prop), property)
    .then((value) => Number.parseFloat(value));

const sectionTitleSize = (width: number) => (width >= TABLET_MIN_WIDTH ? TEXT_LG_PX : TEXT_BASE_PX);
const sectionSpace = (width: number) =>
  width >= TABLET_MIN_WIDTH ? SPACE_SECTION_TABLET : SPACE_SECTION_PHONE;

test.describe('type scale', () => {
  for (const width of WIDTHS) {
    test(`card titles use the base size at ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      for (const selector of ['.project-name', '.measured-heading', '.ab-h']) {
        expect(
          await px(page, selector, 'font-size'),
          `${selector} must not drop below the 14px body copy it heads`,
        ).toBe(TEXT_BASE_PX);
      }
    });

    test(`the code panel title scales with the viewport and never drops below the label size at ${width}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      const size = await px(page, '.ab-code .ab-h', 'font-size');
      expect(size, '.ab-code .ab-h stays at or above --text-xs').toBeGreaterThanOrEqual(TEXT_XS_PX);
      if (width >= CODE_TITLE_FULL_SIZE_MIN_WIDTH) {
        expect(size, '.ab-code .ab-h reaches the full base size').toBe(TEXT_BASE_PX);
      } else {
        expect(size, '.ab-code .ab-h shrinks only where it would not fit').toBeLessThan(
          TEXT_BASE_PX,
        );
      }
    });

    test(`section titles agree and are uppercase at ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      for (const selector of ['.about-section-header h2', '.career-header h2']) {
        expect(await px(page, selector, 'font-size'), `${selector} follows Module h2`).toBe(
          sectionTitleSize(width),
        );
        const transform = await page
          .locator(selector)
          .first()
          .evaluate((el) => getComputedStyle(el).textTransform);
        expect(transform, `${selector} is uppercase like every other section title`).toBe(
          'uppercase',
        );
      }
    });

    test(`About and Career spacing follows --space-section at ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      for (const selector of ['.about-section', '.career-section']) {
        expect(await px(page, selector, 'margin-bottom'), `${selector} margin-bottom`).toBe(
          sectionSpace(width),
        );
      }
    });

    test(`git log and project copy read at the body size at ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      for (const selector of ['.career-command', '.measured-description']) {
        expect(await px(page, selector, 'font-size'), `${selector} is reading text`).toBe(
          TEXT_BODY_PX,
        );
      }
    });

    test(`README code panel never scrolls sideways at ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      const metrics = await page.locator('.ab-code-scroll').evaluate((el) => ({
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        preScrollWidth: el.querySelector('pre')?.scrollWidth ?? 0,
        preClientWidth: el.querySelector('pre')?.clientWidth ?? 0,
      }));
      expect(metrics.scrollWidth, 'code region must fit its panel').toBe(metrics.clientWidth);
      expect(metrics.preScrollWidth, 'code block must wrap, not overflow').toBe(
        metrics.preClientWidth,
      );
    });
  }
});
