import { expect, test } from '@playwright/test';
import { gotoSettled } from './_helpers/streamed';

const WIDTHS = [320, 360, 375, 390, 430] as const;
const VIEWPORT_HEIGHT = 812;
const AXIS_TOLERANCE_PX = 1;
const DOTS_TOLERANCE_PX = 2;

for (const width of WIDTHS) {
  test(`the contact window bar centres its labels on the bar axis at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
    await gotoSettled(page, '/');
    const chrome = page.locator('.contact-chrome').first();
    await chrome.scrollIntoViewIfNeeded();

    const layout = await chrome.evaluate((element) => {
      const box = element.getBoundingClientRect();
      const padding = Number.parseFloat(getComputedStyle(element).paddingLeft);
      const [dots, ...labels] = [...element.children]
        .map((child) => child.getBoundingClientRect())
        .filter((rect) => rect.width > 0);
      const axis = (box.left + box.right) / 2;
      return {
        dotsOffset: (dots?.left ?? 0) - (box.left + padding),
        labelOffsets: labels.map((label) => Math.abs((label.left + label.right) / 2 - axis)),
        overlaps: labels.some(
          (label) => dots !== undefined && label.top < dots.bottom && label.left < dots.right,
        ),
      };
    });

    expect(layout.dotsOffset).toBeLessThan(DOTS_TOLERANCE_PX);
    for (const offset of layout.labelOffsets) {
      expect(
        offset,
        'a label shifted off the axis is the dots column stealing room from one side only',
      ).toBeLessThan(AXIS_TOLERANCE_PX);
    }
    expect(layout.overlaps, 'a label runs into the window dots').toBe(false);
  });
}
