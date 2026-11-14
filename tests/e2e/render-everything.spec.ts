import { expect, test } from '@playwright/test';
import { gotoSettled } from './_helpers/streamed';
import { renderEverything } from './_helpers/words';

const RETURN_BUDGET_MS = 10_000;

test('renderEverything returns when the page never paints another frame', async ({ page }) => {
  await gotoSettled(page, '/');
  await page.evaluate(() => {
    window.requestAnimationFrame = () => 0;
  });
  const started = Date.now();
  await renderEverything(page);
  expect(Date.now() - started).toBeLessThan(RETURN_BUDGET_MS);
});
