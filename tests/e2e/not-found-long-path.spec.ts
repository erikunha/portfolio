import { expect, test } from '@playwright/test';
import { gotoSettled } from './_helpers/streamed';

const LONG_PATH_CHARS = 200;
const NARROW_PHONE = { width: 320, height: 640 } as const;
const ROUTES = [`/${'a'.repeat(LONG_PATH_CHARS)}`, `/pt/${'b'.repeat(LONG_PATH_CHARS)}`];

test.describe(`the 404 command line at ${NARROW_PHONE.width}px`, () => {
  test.use({ viewport: NARROW_PHONE });

  for (const route of ROUTES) {
    test(`wraps a ${LONG_PATH_CHARS}-character path inside its panel on ${route.slice(0, 4)}`, async ({
      page,
    }) => {
      await gotoSettled(page, route);
      const line = page.locator('main .cmd-line');
      await expect(line).toBeVisible();
      const size = await line.evaluate((node) => ({
        scroll: node.scrollWidth,
        client: node.clientWidth,
      }));
      expect(size.scroll, 'the requested path runs past the panel').toBeLessThanOrEqual(
        size.client,
      );
    });
  }
});
