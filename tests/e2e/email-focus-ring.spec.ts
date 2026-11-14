import { expect, type Page, test } from '@playwright/test';
import { revealDeferredContent } from './_helpers/snapshot';
import { gotoSettled } from './_helpers/streamed';

const PHONE_WIDTHS = [320, 375, 768] as const;
const VIEWPORT_HEIGHT = 812;
const ROUTES = ['/', '/pt'] as const;
const CONTACT_EMAIL = '.contact-channels-body a[href^="mailto:"]';
const SUBPIXEL_TOLERANCE_PX = 0.5;

interface RingLayout {
  ringStyle: string;
  ringLeft: number;
  ringRight: number;
  clipLeft: number;
  clipRight: number;
  clipper: string;
}

function measureRing(page: Page): Promise<RingLayout> {
  return page.locator(CONTACT_EMAIL).evaluate((link) => {
    const style = getComputedStyle(link as HTMLElement);
    const box = link.getBoundingClientRect();
    const reach = Number.parseFloat(style.outlineWidth) + Number.parseFloat(style.outlineOffset);
    let clipLeft = 0;
    let clipRight = document.documentElement.clientWidth;
    let clipper = 'viewport';
    for (let node = link.parentElement; node; node = node.parentElement) {
      const overflowX = getComputedStyle(node).overflowX;
      if (overflowX !== 'visible') {
        const rect = node.getBoundingClientRect();
        if (rect.left > clipLeft) clipLeft = rect.left;
        if (rect.right < clipRight) {
          clipRight = rect.right;
          clipper = node.className || node.tagName;
        }
      }
    }
    return {
      ringStyle: style.outlineStyle,
      ringLeft: box.left - reach,
      ringRight: box.right + reach,
      clipLeft,
      clipRight,
      clipper,
    };
  });
}

for (const width of PHONE_WIDTHS) {
  test.describe(`the focused email link at ${width}px`, () => {
    test.use({
      viewport: { width, height: VIEWPORT_HEIGHT },
      isMobile: true,
      hasTouch: true,
    });

    for (const route of ROUTES) {
      test(`${route}: the focus ring sits inside the viewport and every clipping ancestor`, async ({
        page,
      }) => {
        await gotoSettled(page, route);
        await revealDeferredContent(page);
        await page.locator(CONTACT_EMAIL).scrollIntoViewIfNeeded();
        await page.keyboard.press('Tab');
        await page.locator(CONTACT_EMAIL).focus();
        await expect(page.locator(CONTACT_EMAIL)).toBeFocused();
        const ring = await measureRing(page);
        expect(ring.ringStyle, 'the focused link draws an outline').not.toBe('none');
        expect(ring.ringLeft, 'the ring starts left of the clip edge').toBeGreaterThanOrEqual(
          ring.clipLeft - SUBPIXEL_TOLERANCE_PX,
        );
        expect(
          ring.ringRight,
          `the ring runs past the right edge of ${ring.clipper}`,
        ).toBeLessThanOrEqual(ring.clipRight + SUBPIXEL_TOLERANCE_PX);
      });
    }
  });
}
