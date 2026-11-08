import { expect, test } from '@playwright/test';
import { footerContent } from '@/content/footer';
import { SITE_LOCALE } from '@/content/site-locale';
import { freezeMotion } from '../../../tests/e2e/_helpers/motion';
import { gotoSettled } from '../../../tests/e2e/_helpers/streamed';

const TOUCH_CONTEXT = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true };
const KEYBOARD_CONTEXT = {
  viewport: { width: 1280, height: 720 },
  hasTouch: false,
  isMobile: false,
};
const TOUCH_TARGET_PX = 44;
const LOCALES = [
  { path: '/', locale: SITE_LOCALE.en },
  { path: '/pt', locale: SITE_LOCALE.pt },
] as const;

for (const { path, locale } of LOCALES) {
  const { touch, key } = footerContent[locale].reboot;

  test(`${locale}: a touch screen shows the tap wording, not the key hint`, async ({ browser }) => {
    const context = await browser.newContext(TOUCH_CONTEXT);
    const page = await context.newPage();
    await freezeMotion(page);
    await gotoSettled(page, path);
    const link = page.locator('footer .footer-reboot');
    await link.scrollIntoViewIfNeeded();
    expect(
      await link.evaluate((node) => getComputedStyle(node, '::before').content),
      'the tap wording comes from the data-touch-label attribute',
    ).toBe(`"${touch}"`);
    await expect(link.locator('.footer-reboot-keys')).toBeHidden();
    const box = await link.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(TOUCH_TARGET_PX);
    expect(box?.width).toBeGreaterThanOrEqual(TOUCH_TARGET_PX);
    await context.close();
  });

  test(`${locale}: a keyboard device shows the key hint, not the tap wording`, async ({
    browser,
  }) => {
    const context = await browser.newContext(KEYBOARD_CONTEXT);
    const page = await context.newPage();
    await freezeMotion(page);
    await gotoSettled(page, path);
    const link = page.locator('footer .footer-reboot');
    await link.scrollIntoViewIfNeeded();
    expect(await link.evaluate((node) => getComputedStyle(node, '::before').content)).toBe('none');
    await expect(link.locator('.footer-reboot-keys kbd')).toHaveText(key);
    await context.close();
  });
}
