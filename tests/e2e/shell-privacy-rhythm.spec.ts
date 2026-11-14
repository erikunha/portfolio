import { expect, test } from '@playwright/test';
import { revealDeferredContent } from './_helpers/snapshot';
import { gotoSettled } from './_helpers/streamed';

const WIDTHS = [320, 375, 768, 1280] as const;
const VIEWPORT_HEIGHT = 900;
const TARGET_PX = 44;
const SUBPIXEL_PX = 1;
const SHELL_EMAIL = '.shell-privacy-notice a[href^="mailto:"]';

for (const width of WIDTHS) {
  test(`at ${width}px the shell privacy email keeps a 44px target without stretching its line`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
    await gotoSettled(page, '/');
    await revealDeferredContent(page);
    const link = page.locator(SHELL_EMAIL);
    await link.scrollIntoViewIfNeeded();
    const measure = await link.evaluate((node) => {
      const paragraph = node.closest('p') as HTMLElement;
      const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT);
      const rects: DOMRect[] = [];
      for (let text = walker.nextNode(); text; text = walker.nextNode()) {
        const range = document.createRange();
        range.selectNodeContents(text);
        rects.push(...range.getClientRects());
      }
      const tops = [...new Set(rects.map((rect) => Math.round(rect.top)))];
      tops.sort((a, b) => a - b);
      const gaps = tops.slice(1).map((top, index) => top - (tops[index] ?? top));
      return {
        gaps,
        lineHeight: Number.parseFloat(getComputedStyle(paragraph).lineHeight),
        target: node.getBoundingClientRect().height,
      };
    });
    expect(measure.target, 'the email link is a 44px target').toBeGreaterThanOrEqual(TARGET_PX);
    for (const gap of measure.gaps) {
      expect(
        Math.abs(gap - measure.lineHeight),
        `uneven line gap ${measure.gaps}`,
      ).toBeLessThanOrEqual(SUBPIXEL_PX);
    }
  });
}
