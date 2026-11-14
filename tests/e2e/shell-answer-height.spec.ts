import { expect, test } from '@playwright/test';
import { settleFrames } from './_helpers/geometry';
import { waitForHydration } from './_helpers/hydration';
import { freezeMotion } from './_helpers/motion';

const REQUEST_ID = '3f1c9a2e-7b44-4d0a-9c1e-5a8d2b6f0e71';
const ANSWER = 'Short answer.';
const VIEWPORT_HEIGHT = 844;
const PHONE_AND_TABLET_WIDTHS = [320, 375, 390, 480, 540, 600, 767] as const;
const REFERENCE = '[data-testid="shell-receipt"]';
const SHELL_INPUT = '[aria-label="shell command"]';

for (const width of PHONE_AND_TABLET_WIDTHS) {
  test(`at ${width}px the shell section keeps its height when a short answer lands with a real request id`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
    await freezeMotion(page);
    await page.route('**/api/ask', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'text/plain; charset=utf-8',
        headers: { 'X-Request-Id': REQUEST_ID },
        body: ANSWER,
      }),
    );
    await page.goto('/');
    await page.getByTestId('shell-form').scrollIntoViewIfNeeded();
    await waitForHydration(page, '[data-testid="shell-form"]');
    await settleFrames(page);
    const section = page.locator('#sec-shell');
    const idle = await section.evaluate((node) => node.getBoundingClientRect().height);

    await page.locator(SHELL_INPUT).fill('who is erik?');
    await page.keyboard.press('Enter');
    await expect(page.locator(REFERENCE)).toBeVisible();
    await settleFrames(page);
    const answered = await section.evaluate((node) => node.getBoundingClientRect().height);

    expect(
      answered,
      `idle ${idle}, answered ${answered}: the feed grew when the reference row landed`,
    ).toBe(idle);
  });
}
