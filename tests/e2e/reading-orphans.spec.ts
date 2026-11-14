import { expect, test } from '@playwright/test';
import { freezeMotion } from './_helpers/motion';
import { gotoSettled } from './_helpers/streamed';
import {
  lastLineOrphans,
  ORPHAN_MAX_CHARS,
  renderEverything,
  WORD_VIEWPORTS,
} from './_helpers/words';

const READING_ROUTES = ['/cv', '/pt/cv', '/summary', '/pt/summary'] as const;
const READING_SCOPE = 'main';
const PRINT_VIEWPORT = { width: 794, height: 1123 } as const;
const ENVIRONMENTS = [
  { name: 'phone', touch: { isMobile: true, hasTouch: true } },
  { name: 'narrow desktop window', touch: { isMobile: false, hasTouch: false } },
] as const;

for (const environment of ENVIRONMENTS) {
  test.describe(`reading views never end a block on a lone short token on a ${environment.name}`, () => {
    test.use(environment.touch);

    for (const route of READING_ROUTES) {
      for (const viewport of WORD_VIEWPORTS) {
        test(`${route} at ${viewport.width}px`, async ({ page }) => {
          await page.setViewportSize(viewport);
          await freezeMotion(page);
          await gotoSettled(page, route);
          await renderEverything(page);
          expect(
            await lastLineOrphans(page, READING_SCOPE),
            `a year, a level or a short word of ${ORPHAN_MAX_CHARS} characters or fewer stays with the word before it`,
          ).toEqual([]);
        });
      }
    }
  });
}

test.describe('reading views in print', () => {
  for (const route of READING_ROUTES) {
    test(`${route} keeps a short last token with the word before it`, async ({ page }) => {
      await page.setViewportSize(PRINT_VIEWPORT);
      await freezeMotion(page);
      await gotoSettled(page, route);
      await page.emulateMedia({ media: 'print' });
      expect(await lastLineOrphans(page, READING_SCOPE)).toEqual([]);
    });
  }
});
