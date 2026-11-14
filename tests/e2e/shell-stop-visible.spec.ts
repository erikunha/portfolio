import { expect, test } from '@playwright/test';
import { settleFrames } from './_helpers/geometry';
import { waitForHydration } from './_helpers/hydration';
import { freezeMotion } from './_helpers/motion';

const WIDTHS = [320, 375] as const;
const VIEWPORT_HEIGHT = 844;
const SHELL_INPUT = '[aria-label="shell command"]';
const FEED = '[role="log"]';
const STOP_NAME = 'Stop answer';
const FILLER_COMMAND = 'help';
const MAX_FILLER_COMMANDS = 24;

for (const width of WIDTHS) {
  test(`at ${width}px STOP stays in view and clickable after the feed scrolls to the top mid-stream`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
    await freezeMotion(page);
    await page.route('**/api/ask', () => new Promise(() => undefined));
    await page.goto('/');
    await page.getByTestId('shell-form').scrollIntoViewIfNeeded();
    await waitForHydration(page, '[data-testid="shell-form"]');
    const input = page.locator(SHELL_INPUT);
    const feed = page.locator(FEED);
    for (let count = 0; count < MAX_FILLER_COMMANDS; count++) {
      if (await feed.evaluate((node) => node.scrollHeight > node.clientHeight)) break;
      await input.fill(FILLER_COMMAND);
      await page.keyboard.press('Enter');
    }
    await input.fill('who is erik?');
    await page.keyboard.press('Enter');
    const stop = page.getByRole('button', { name: STOP_NAME });
    await expect(stop).toBeVisible();

    const scrollable = await page
      .locator(FEED)
      .evaluate((feed) => feed.scrollHeight > feed.clientHeight);
    expect(scrollable, 'the filler commands must overflow the feed').toBe(true);
    await page.locator(FEED).evaluate((feed) => {
      feed.scrollTop = 0;
    });
    await settleFrames(page);

    const placement = await stop.evaluate((button) => {
      const box = button.getBoundingClientRect();
      const feed = document.querySelector('[role="log"]')?.getBoundingClientRect();
      const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      return {
        top: box.top,
        bottom: box.bottom,
        height: box.height,
        feedTop: feed?.top ?? 0,
        feedBottom: feed?.bottom ?? 0,
        viewport: window.innerHeight,
        reachable: hit === button || button.contains(hit),
        inLiveRegion: button.closest('[role="log"], [aria-live]') !== null,
      };
    });
    expect(placement.top, 'STOP sits inside the answer area').toBeGreaterThanOrEqual(
      placement.feedTop,
    );
    expect(placement.bottom).toBeLessThanOrEqual(placement.feedBottom + 1);
    expect(placement.bottom).toBeLessThanOrEqual(placement.viewport);
    expect(placement.height).toBeGreaterThanOrEqual(44);
    expect(placement.reachable, 'another element covers STOP').toBe(true);
    expect(placement.inLiveRegion, 'a live region would announce the button').toBe(false);

    await stop.click();
    await expect(stop).toHaveCount(0);
    await expect(input).toBeFocused();
  });
}
