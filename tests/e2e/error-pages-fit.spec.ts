import { expect, test } from '@playwright/test';
import { gotoSettled } from './_helpers/streamed';

const SMALL_PHONE = { width: 320, height: 700 } as const;
const ROUTES = ['/this-route-does-not-exist', '/pt/rota-que-nao-existe'];

test.describe(`the 404 page at ${SMALL_PHONE.width}x${SMALL_PHONE.height}`, () => {
  test.use({ viewport: SMALL_PHONE });

  for (const route of ROUTES) {
    test(`${route} fits the viewport without a vertical scroll`, async ({ page }) => {
      await gotoSettled(page, route);
      const overflow = await page.evaluate(() => {
        const root = document.scrollingElement ?? document.documentElement;
        return root.scrollHeight - root.clientHeight;
      });
      expect(
        overflow,
        'the panel, suggestions and action need more room than the viewport leaves under the bars',
      ).toBeLessThanOrEqual(0);
    });

    test(`${route} keeps its controls at one touch target and its text at the type floor`, async ({
      page,
    }) => {
      await gotoSettled(page, route);
      const sizes = await page.evaluate(() => {
        const probe = document.createElement('div');
        probe.style.cssText =
          'position:absolute;width:var(--spacing-target);height:var(--spacing-target)';
        document.body.append(probe);
        const target = probe.getBoundingClientRect().height;
        probe.remove();
        const heights = [...document.querySelectorAll('.err-suggest a, .err-actions a')].map(
          (control) => control.getBoundingClientRect().height,
        );
        const fonts = [
          ...document.querySelectorAll('main :is(.err-label, .err-link, .cmd-line)'),
        ].map((node) => Number.parseFloat(getComputedStyle(node).fontSize));
        return { target, heights, fonts };
      });
      expect(Math.min(...sizes.heights)).toBeGreaterThanOrEqual(sizes.target);
      expect(Math.min(...sizes.fonts)).toBeGreaterThanOrEqual(13);
    });
  }
});
