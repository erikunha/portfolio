import { expect, type Page, test } from '@playwright/test';
import { freezeMotion } from './_helpers/motion';
import { askShell, openShell, SHELL_SELECTOR } from './_helpers/shell';

const WIDTHS = [320, 1280] as const;
const VIEWPORT_HEIGHT = 844;
const TENTHS_CHARS = 4;
const WHOLE_SECONDS_CHARS = 2;
const SUBPIXEL_PX = 0.5;
const TIME = '.shell-stop-time';

async function openPending(page: Page) {
  await page.route('**/api/ask', () => new Promise(() => undefined));
  await openShell(page);
  await askShell(page, 'are you there?');
  await expect(page.locator(SHELL_SELECTOR.stopPill)).toBeVisible();
}

function measure(page: Page) {
  return page.locator(TIME).evaluate((node) => {
    const probe = document.createElement('span');
    probe.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;inline-size:10ch';
    node.append(probe);
    const ch = probe.getBoundingClientRect().width / 10;
    probe.remove();
    return { width: node.getBoundingClientRect().width, ch, text: node.textContent ?? '' };
  });
}

for (const width of WIDTHS) {
  test.describe(`the stop pill timer at ${width}px`, () => {
    test.use({ viewport: { width, height: VIEWPORT_HEIGHT } });

    test('with MOTION off reserves room for whole seconds only', async ({ page }) => {
      await freezeMotion(page);
      await openPending(page);
      const { width: reserved, ch, text } = await measure(page);
      expect(text, 'whole seconds, no tenths').toMatch(/^\d+$/);
      expect(reserved, 'a gap of unused tenths sits before the digits').toBeLessThanOrEqual(
        WHOLE_SECONDS_CHARS * ch + SUBPIXEL_PX,
      );
    });

    test('with MOTION on reserves room for tenths so the pill holds its width', async ({
      page,
    }) => {
      await openPending(page);
      const { width: reserved, ch, text } = await measure(page);
      expect(text).toMatch(/^\d+\.\d$/);
      expect(reserved).toBeGreaterThanOrEqual(TENTHS_CHARS * ch - SUBPIXEL_PX);
    });
  });
}
