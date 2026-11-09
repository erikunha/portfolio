import { expect, test } from '@playwright/test';
import { installMockBackend } from './_helpers/mock-backend';

const MIXER = '#sec-guitar [data-testid="daw-mixer-desktop"]';
const CONTROLS = [
  { name: 'knob', selector: `${MIXER} .knob-container`, touchAction: 'none' },
  { name: 'fader', selector: `${MIXER} .fader-track`, touchAction: 'pan-y' },
  { name: 'VU meter', selector: `${MIXER} .vu-meter`, touchAction: 'pan-y' },
];

test.describe('the interactive mixer keeps its drags on touch screens', () => {
  test.use({ viewport: { width: 1024, height: 800 } });

  for (const control of CONTROLS) {
    test(`the ${control.name} declares touch-action ${control.touchAction}`, async ({ page }) => {
      await installMockBackend(page, { log: 'accept', forget: 'happy' });
      await page.goto('/');
      await page.locator('#sec-guitar').scrollIntoViewIfNeeded();
      const node = page.locator(control.selector).first();
      await expect(node).toBeVisible();
      await expect(
        node,
        'without touch-action the browser takes over a touch drag as a scroll and fires pointercancel, which reverts the value',
      ).toHaveCSS('touch-action', control.touchAction);
    });
  }
});
