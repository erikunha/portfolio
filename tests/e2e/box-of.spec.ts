import { boxOf } from './_helpers/geometry';
import { expect, test } from './_helpers/test';

const SQUARE_PX = 40;
const SHORT_TIMEOUT_MS = 400;
const LATE_MS = 250;

const SQUARE = `<div id="slot"></div><style>.sq{width:${SQUARE_PX}px;height:${SQUARE_PX}px;margin-left:30px}</style>`;

test.describe('boxOf: a missing layout box is a failure, never a coordinate of 0', () => {
  test('waits for an element that is laid out late and returns its box', async ({ page }) => {
    await page.setContent(SQUARE);
    await page.evaluate((delay) => {
      setTimeout(() => {
        document.getElementById('slot')?.insertAdjacentHTML('beforeend', '<nav class="sq"></nav>');
      }, delay);
    }, LATE_MS);

    const box = await boxOf(page.locator('nav.sq'), 'the late nav');

    expect(box.width).toBe(SQUARE_PX);
    expect(box.x).toBeGreaterThanOrEqual(30);
  });

  test('re-resolves the locator when the first element is swapped for a copy', async ({ page }) => {
    await page.setContent(`${SQUARE}`);
    await page.evaluate(() => {
      const slot = document.getElementById('slot');
      slot?.insertAdjacentHTML('beforeend', '<nav class="sq" style="display:none"></nav>');
      setTimeout(() => {
        slot?.replaceChildren();
        slot?.insertAdjacentHTML('beforeend', '<nav class="sq"></nav>');
      }, 250);
    });

    const box = await boxOf(page.locator('nav.sq'), 'the swapped nav');

    expect(box.height).toBe(SQUARE_PX);
  });

  test('fails naming the element when it never gets a box', async ({ page }) => {
    await page.setContent(`${SQUARE}<nav class="sq" style="display:none"></nav>`);

    await expect(boxOf(page.locator('nav.sq'), 'the hidden nav', SHORT_TIMEOUT_MS)).rejects.toThrow(
      /the hidden nav must have a layout box/,
    );
  });
});
