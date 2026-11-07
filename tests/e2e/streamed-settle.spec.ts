import { expect, test } from '@playwright/test';
import { settleFrames } from './_helpers/geometry';
import { gotoSettled, PENDING_STREAMED } from './_helpers/streamed';

const BOUNDARY_SWAP = /\$RC\(("B:[^)]*)\)/g;
const HELD_SWAP = '(window.__heldSwaps=window.__heldSwaps||[]).push(()=>$RC($1))';
const HELD_FRAMES = 30;

test.describe('settling the streamed boundaries', () => {
  test.beforeEach(async ({ context }) => {
    await context.route('**/*', async (route) => {
      if (route.request().resourceType() !== 'document') {
        await route.continue();
        return;
      }
      const response = await route.fetch();
      const body = (await response.text()).replace(BOUNDARY_SWAP, HELD_SWAP);
      await route.fulfill({ response, body });
    });
  });

  test('gotoSettled stays pending until every held boundary swaps in', async ({ page }) => {
    let settled = false;
    const navigation = gotoSettled(page, '/').then(() => {
      settled = true;
    });

    await expect(
      page.locator(PENDING_STREAMED),
      'the held swap must leave a fallback in the DOM, or this test proves nothing',
    ).not.toHaveCount(0);
    await settleFrames(page, HELD_FRAMES);
    expect(settled, 'gotoSettled returned while a fallback was still in the DOM').toBe(false);

    await page.evaluate(() => {
      for (const swap of (window as unknown as { __heldSwaps: Array<() => void> }).__heldSwaps) {
        swap();
      }
    });
    await navigation;

    expect(settled).toBe(true);
    await expect(page.locator(PENDING_STREAMED)).toHaveCount(0);
    await expect(page.locator('.measured-heading').first()).toBeAttached();
  });
});
