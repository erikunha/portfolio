import { expect, test } from '@playwright/test';
import { gotoHydrated, MOBILE_BAR_CONTROL, STATUS_BAR } from './_helpers/hydration';

const PHONE = { width: 390, height: 844 };
const READING_OFFSET_PX = 3000;
const STICKY_BAR_CONTROLS =
  '.mobile-title-bar :is(a, button):visible, .status-bar :is(a, button):visible';

test.describe('focusing the phone header bars', () => {
  test.use({ viewport: PHONE });

  test('leaves the reading position alone for every control in the sticky bars', async ({
    page,
  }) => {
    await gotoHydrated(page, '/', [MOBILE_BAR_CONTROL, STATUS_BAR]);
    const controls = page.locator(STICKY_BAR_CONTROLS);
    const count = await controls.count();
    expect(count, 'the sticky bars must expose their controls at phone width').toBeGreaterThan(0);

    for (let index = 0; index < count; index++) {
      await page.evaluate((top) => window.scrollTo(0, top), READING_OFFSET_PX);
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(READING_OFFSET_PX);
      const control = controls.nth(index);

      await control.focus();

      await expect(control).toBeFocused();
      expect(
        await page.evaluate(() => window.scrollY),
        'a control inside a stuck bar is already on screen: focusing it must not scroll the page, the html scroll-padding-top reserves the room the bars themselves occupy',
      ).toBe(READING_OFFSET_PX);
    }
  });
});
