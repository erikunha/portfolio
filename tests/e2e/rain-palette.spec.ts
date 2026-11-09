import { expect, test } from '@playwright/test';
import { gotoSettled } from './_helpers/streamed';

const RAIN_CANVAS = 'canvas[style*="position: fixed"]';
const RAIN_TOKENS = ['--color-rain-head', '--color-rain-body', '--rain-tail-alpha'];

test('the shipped stylesheet carries the rain palette and the rain mounts from it', async ({
  page,
}) => {
  await gotoSettled(page, '/');
  const values = await page.evaluate(
    (names) =>
      Object.fromEntries(
        names.map((name) => [
          name,
          getComputedStyle(document.documentElement).getPropertyValue(name).trim(),
        ]),
      ),
    RAIN_TOKENS,
  );
  for (const name of RAIN_TOKENS) {
    expect(values[name], `${name} must reach the page: the rain reads it at mount`).not.toBe('');
  }
  await expect(
    page.locator(RAIN_CANVAS),
    'the rain throws at mount, and its error boundary hides the canvas, when a token is missing',
  ).toBeAttached();
});
