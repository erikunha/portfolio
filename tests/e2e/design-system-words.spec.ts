import { expect, test } from '@playwright/test';
import { DS_NAV_GROUPS } from '@/app/(en)/design-system/_components/ds-nav';
import { freezeMotion } from './_helpers/motion';
import { gotoSettled } from './_helpers/streamed';
import { renderEverything, splitWords, WORD_VIEWPORTS } from './_helpers/words';

const ROUTES = DS_NAV_GROUPS.flatMap((group) => group.links.map((link) => link.href));
const ARTICLE_SCOPE = 'main';
const CODE_BREAK_AFTER = '_/.@:[>';

for (const route of ROUTES) {
  for (const viewport of WORD_VIEWPORTS) {
    test(`${route} at ${viewport.width}px breaks identifiers only after an underscore`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await freezeMotion(page);
      await gotoSettled(page, route);
      await renderEverything(page);
      expect(
        await splitWords(page, ARTICLE_SCOPE, CODE_BREAK_AFTER),
        'a code identifier, path or tag runs onto a second line only after a break character, never inside a word',
      ).toEqual([]);
    });
  }
}
