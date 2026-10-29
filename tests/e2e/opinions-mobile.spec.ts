import { expect, test } from '@playwright/test';

const MOBILE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 720 };
const ROW_TOLERANCE_PX = 1;

async function takeGeometry(page: import('@playwright/test').Page) {
  await page.goto('/');
  const takes = page.locator('#sec-hottest-takes [data-testid="hottest-takes-list"] h3');
  await takes.first().scrollIntoViewIfNeeded();
  return takes.evaluateAll((headings) =>
    headings.map((heading) => {
      const tag = heading.querySelector('span') as HTMLElement;
      const textNode = Array.from(heading.childNodes).find(
        (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
      ) as Text;
      const range = document.createRange();
      range.selectNodeContents(textNode);
      const firstLine = range.getClientRects()[0] as DOMRect;
      const tagRect = tag.getBoundingClientRect();
      return {
        tagLeft: tagRect.left,
        tagRight: tagRect.right,
        tagTop: tagRect.top,
        tagBottom: tagRect.bottom,
        textLeft: firstLine.left,
        textTop: firstLine.top,
      };
    }),
  );
}

test.describe('hottest takes reflow', () => {
  test('below 768 the category tag sits above the take text on one left edge', async ({ page }) => {
    await page.setViewportSize(MOBILE);
    const takes = await takeGeometry(page);
    expect(takes.length).toBeGreaterThan(0);
    for (const take of takes) {
      expect(Math.abs(take.tagLeft - take.textLeft)).toBeLessThanOrEqual(ROW_TOLERANCE_PX);
      expect(take.tagBottom).toBeLessThanOrEqual(take.textTop + ROW_TOLERANCE_PX);
    }
  });

  test('at 1280 the category tag sits beside the take text', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    const takes = await takeGeometry(page);
    expect(takes.length).toBeGreaterThan(0);
    for (const take of takes) {
      expect(take.textLeft).toBeGreaterThanOrEqual(take.tagRight - ROW_TOLERANCE_PX);
      expect(take.textTop).toBeLessThan(take.tagBottom);
    }
  });
});
