import { expect, type Page, test } from '@playwright/test';
import { gotoSettled } from './_helpers/streamed';

const WIDTHS = [320, 390, 768, 1280];
const BODY_RGB = 'rgb(230, 255, 230)';
const TEXT_BASE_PX = 16;
const TEXT_LG_PX = 18;
const TEXT_BODY_PX = 14;
const TEXT_XS_PX = 12;
const CODE_TITLE_FULL_SIZE_MIN_WIDTH = 390;
const RESPONSIBILITIES_TITLE_FULL_SIZE_MIN_WIDTH = 375;
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
      await gotoSettled(page, '/');
      for (const selector of ['.project-name', '.measured-heading', '.panel-title']) {
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
      await gotoSettled(page, '/');
      const size = await px(page, '.ab-code .panel-title', 'font-size');
      expect(size, '.ab-code .panel-title stays at or above --text-xs').toBeGreaterThanOrEqual(
        TEXT_XS_PX,
      );
      if (width >= CODE_TITLE_FULL_SIZE_MIN_WIDTH) {
        expect(size, '.ab-code .panel-title reaches the full base size').toBe(TEXT_BASE_PX);
      } else {
        expect(size, '.ab-code .panel-title shrinks only where it would not fit').toBeLessThan(
          TEXT_BASE_PX,
        );
      }
    });

    test(`the responsibilities panel title scales with the viewport and never drops below the label size at ${width}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await gotoSettled(page, '/');
      const size = await px(page, '.ab-resp .panel-title', 'font-size');
      expect(size, '.ab-resp .panel-title stays at or above --text-xs').toBeGreaterThanOrEqual(
        TEXT_XS_PX,
      );
      if (width >= RESPONSIBILITIES_TITLE_FULL_SIZE_MIN_WIDTH) {
        expect(size, '.ab-resp .panel-title reaches the full base size').toBe(TEXT_BASE_PX);
      } else {
        expect(size, '.ab-resp .panel-title shrinks only where it would not fit').toBeLessThan(
          TEXT_BASE_PX,
        );
      }
    });

    test(`section titles agree and are uppercase at ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await gotoSettled(page, '/');
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
      await gotoSettled(page, '/');
      for (const selector of ['.about-section', '.career-section']) {
        expect(await px(page, selector, 'margin-bottom'), `${selector} margin-bottom`).toBe(
          sectionSpace(width),
        );
      }
    });

    test(`git log and project copy read at the body size at ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await gotoSettled(page, '/');
      for (const selector of ['.career-command', '.measured-description']) {
        expect(await px(page, selector, 'font-size'), `${selector} is reading text`).toBe(
          TEXT_BODY_PX,
        );
      }
    });

    test(`hero context meta steps down to the xs token below 390 at ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await gotoSettled(page, '/');
      expect(
        await px(page, '.hero-context', 'font-size'),
        '.hero-context stays on the type scale at every width',
      ).toBe(width < 390 ? TEXT_XS_PX : TEXT_BODY_PX);
    });

    test(`career descriptions render in the body color at ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await gotoSettled(page, '/');
      const color = await page
        .locator('.career-body')
        .first()
        .evaluate((el) => getComputedStyle(el).color);
      expect(color, 'the career description is a sentence, so it carries --color-tertiary-50').toBe(
        BODY_RGB,
      );
    });

    test(`community block fills the section width at ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await gotoSettled(page, '/');
      const widths = await page.evaluate(() => {
        const group = document.querySelector('#sec-community');
        const block = group?.querySelector('.career-community');
        return {
          group: group?.getBoundingClientRect().width ?? 0,
          block: block?.getBoundingClientRect().width ?? 0,
        };
      });
      expect(widths.block, 'the community block uses the horizontal space').toBeGreaterThanOrEqual(
        widths.group - 1,
      );
    });

    test(`README code panel never scrolls sideways at ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await gotoSettled(page, '/');
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
