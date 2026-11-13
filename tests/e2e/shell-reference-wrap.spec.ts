import { expect, test } from '@playwright/test';
import { installChunkedAsk } from './_helpers/mock-backend';
import { freezeMotion } from './_helpers/motion';
import { askShell, openShell, SHELL_SELECTOR } from './_helpers/shell';

const WIDTHS = [320, 375, 768, 1280] as const;
const VIEWPORT_HEIGHT = 844;
const QUESTION = 'who is erik?';
const ANSWER = 'Erik builds agent platforms.';
const UUID_REQUEST_ID = '3f1c9a2e-7b44-4d0a-9c1e-5a8d2b6f0e71';

for (const width of WIDTHS) {
  test(`at ${width}px the request reference stays inside the feed`, async ({ page }) => {
    await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
    await freezeMotion(page);
    const chunked = await installChunkedAsk(page, { requestId: UUID_REQUEST_ID });
    await openShell(page);
    await askShell(page, QUESTION);
    await expect.poll(chunked.requests).toBe(1);
    await chunked.push(ANSWER);
    await chunked.end();
    await expect(page.locator(SHELL_SELECTOR.reference)).toBeVisible();

    const fit = await page.locator(SHELL_SELECTOR.feed).evaluate((feed) => {
      const code = feed.querySelector('[data-testid="shell-reference"] code');
      const feedBox = feed.getBoundingClientRect();
      const lines = code ? [...code.getClientRects()] : [];
      return {
        scrollOverflow: feed.scrollWidth - feed.clientWidth,
        rightmost: Math.max(0, ...lines.map((rect) => rect.right)) - feedBox.right,
      };
    });
    expect(fit.scrollOverflow, 'the feed scrolls sideways').toBeLessThanOrEqual(0);
    expect(fit.rightmost, 'the reference id runs past the feed edge').toBeLessThanOrEqual(0);
  });
}
