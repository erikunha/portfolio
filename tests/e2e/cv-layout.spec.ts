import { expect, type Page, test } from '@playwright/test';
import { cvDocument } from '../../content/reading-views';
import { SITE_LOCALE, type SiteLocale } from '../../content/site-locale';
import { gotoSettled } from './_helpers/streamed';

const CASES: { path: string; locale: SiteLocale }[] = [
  { path: '/cv', locale: SITE_LOCALE.en },
  { path: '/pt/cv', locale: SITE_LOCALE.pt },
];
const TWO_COLUMN_VIEWPORTS = [
  { width: 1024, height: 768 },
  { width: 1280, height: 800 },
  { width: 1920, height: 1080 },
];
const ROW_VIEWPORTS = [{ width: 768, height: 1024 }, ...TWO_COLUMN_VIEWPORTS];
const STACKED_VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 1280, height: 800 },
];
const MAX_VALUE_LINES = 2;
const EDGE_TOLERANCE_PX = 1;
const SKILLS = '[aria-labelledby="cv-skills"]';
const ASIDE = '.reading-side';
const EXPERIENCE = '#cv-experience';

async function open(page: Page, path: string, viewport: { width: number; height: number }) {
  await page.setViewportSize(viewport);
  await gotoSettled(page, path);
}

for (const { path, locale } of CASES) {
  test.describe(`${path} layout`, () => {
    for (const viewport of STACKED_VIEWPORTS) {
      test(`${viewport.width}: the actions row sits below the name and the contact links`, async ({
        page,
      }) => {
        await open(page, path, viewport);
        const name = await page.locator('.reading-name').boundingBox();
        const links = await page.locator('.reading-links').boundingBox();
        const actions = await page.locator('.reading-actions').boundingBox();
        if (!name || !links || !actions) throw new Error('the CV header renders no boxes');

        expect(
          actions.y,
          'the actions row must come after the contact links, not above the name',
        ).toBeGreaterThanOrEqual(links.y + links.height - EDGE_TOLERANCE_PX);
        expect(actions.y).toBeGreaterThan(name.y + name.height);
      });
    }

    test('skills read as one labeled row per category, not one paragraph', async ({ page }) => {
      await open(page, path, TWO_COLUMN_VIEWPORTS[1] ?? { width: 1280, height: 800 });
      const { skills } = cvDocument[locale];

      await expect(page.locator(`${SKILLS} dt`), 'one term per skill category').toHaveText(
        skills.map((group) => group.label),
      );
      await expect(page.locator(`${SKILLS} dd`)).toHaveCount(skills.length);
      await expect(
        page.locator(`${SKILLS} > p`),
        'no paragraph may hold the skills as a wall of text',
      ).toHaveCount(0);
    });

    test('every achievement line shows a list marker', async ({ page }) => {
      await open(page, path, TWO_COLUMN_VIEWPORTS[1] ?? { width: 1280, height: 800 });
      const styles = await page.locator('.reading-entry li').evaluateAll((items) =>
        items.map((item) => {
          const style = getComputedStyle(item);
          return { type: style.listStyleType, display: style.display };
        }),
      );

      expect(styles.length).toBeGreaterThan(0);
      for (const style of styles) {
        expect(style.display, 'a list item must stay display: list-item to draw its marker').toBe(
          'list-item',
        );
        expect(style.type, 'achievement lines must not have list-style: none').not.toBe('none');
      }
    });

    for (const viewport of TWO_COLUMN_VIEWPORTS) {
      test(`${viewport.width}: the aside stays in view beside the long experience column`, async ({
        page,
      }) => {
        await open(page, path, viewport);
        const topbar = (await page.getByRole('banner').first().boundingBox())?.height ?? 0;
        const target = await page.locator(EXPERIENCE).evaluate((heading) => {
          const column = heading.closest('.reading-main') ?? heading;
          const box = column.getBoundingClientRect();
          return box.top + window.scrollY + box.height / 2 - window.innerHeight / 2;
        });
        await page.evaluate((top) => window.scrollTo(0, top), target);
        await page.evaluate(
          () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
        );
        const aside = await page.locator(ASIDE).boundingBox();
        if (!aside) throw new Error('the aside renders no box');

        expect(aside.height, 'the aside must fit the viewport to stay pinned').toBeLessThan(
          viewport.height - topbar,
        );
        expect(
          aside.y,
          'half way down the experience column the aside must still be on screen',
        ).toBeGreaterThanOrEqual(topbar - EDGE_TOLERANCE_PX);
        expect(aside.y + aside.height).toBeLessThanOrEqual(viewport.height + EDGE_TOLERANCE_PX);
      });
    }

    for (const viewport of ROW_VIEWPORTS) {
      test(`${viewport.width}: certification and education values wrap to ${MAX_VALUE_LINES} lines at most`, async ({
        page,
      }) => {
        await open(page, path, viewport);
        const lines = await page.locator('.reading-row-value').evaluateAll((values) =>
          values.map((value) => {
            const style = getComputedStyle(value);
            return {
              text: value.textContent ?? '',
              lines: Math.round(
                value.getBoundingClientRect().height / Number.parseFloat(style.lineHeight),
              ),
            };
          }),
        );

        expect(lines.length).toBeGreaterThan(0);
        for (const row of lines) {
          expect(
            row.lines,
            `"${row.text}" must not wrap past ${MAX_VALUE_LINES} lines`,
          ).toBeLessThanOrEqual(MAX_VALUE_LINES);
        }
      });
    }
  });
}
