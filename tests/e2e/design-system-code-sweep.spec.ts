import { expect, test } from '@playwright/test';
import { freezeMotion } from './_helpers/motion';
import { gotoSettled } from './_helpers/streamed';
import { renderEverything, splitWords } from './_helpers/words';

const ROUTE = '/design-system/components';
const ARTICLE_SCOPE = 'main';
const CODE_BREAK_AFTER = '_/.@:[>';
const WIDTH_MIN_PX = 280;
const WIDTH_MAX_PX = 480;
const WIDTH_STEP_PX = 3;
const VIEWPORT_HEIGHT_PX = 800;

test(`${ROUTE} never breaks inline code inside a word at any phone width`, async ({ page }) => {
  await freezeMotion(page);
  await page.setViewportSize({ width: WIDTH_MIN_PX, height: VIEWPORT_HEIGHT_PX });
  await gotoSettled(page, ROUTE);
  await renderEverything(page);
  const failures: Record<number, unknown> = {};
  for (let width = WIDTH_MIN_PX; width <= WIDTH_MAX_PX; width += WIDTH_STEP_PX) {
    await page.setViewportSize({ width, height: VIEWPORT_HEIGHT_PX });
    const found = await splitWords(page, ARTICLE_SCOPE, CODE_BREAK_AFTER);
    if (found.length > 0) failures[width] = found;
  }
  expect(
    failures,
    'inline code runs onto a second line only after a break character, never inside a word, whatever the glyph advance of the platform',
  ).toEqual({});
});
