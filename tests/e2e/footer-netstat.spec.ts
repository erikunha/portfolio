import { expect, type Page, test } from '@playwright/test';

const FINE_ROW_MAX_PX = 30;
const TOUCH_ROW_MIN_PX = 44;
const ENDPOINT_ONE_LINE_MAX_PX = 30;
const TABLE_NAME = /NETSTAT/;
const ROWS_WITH_HEADER = 5;

async function openFooter(page: Page, width: number) {
  await page.setViewportSize({ width, height: 800 });
  await page.goto('/');
  await page.locator('.footer-netstat').scrollIntoViewIfNeeded();
}

function endpointHeights(page: Page) {
  return page
    .locator('.footer-netstat tbody .footer-link')
    .evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height));
}

test.describe('footer netstat table', () => {
  for (const width of [320, 390, 768, 1280]) {
    test(`keeps every endpoint on one line at ${width}`, async ({ page }) => {
      await openFooter(page, width);
      for (const height of await endpointHeights(page)) {
        expect(height).toBeLessThanOrEqual(ENDPOINT_ONE_LINE_MAX_PX + TOUCH_ROW_MIN_PX);
      }
      const wrapped = await page
        .locator('.footer-netstat tbody .footer-link')
        .evaluateAll((nodes) =>
          nodes
            .filter((node) => {
              const range = document.createRange();
              range.selectNodeContents(node);
              const rects = [...range.getClientRects()]
                .filter((rect) => rect.width > 0)
                .sort((a, b) => a.top - b.top);
              let lines = 0;
              let lineBottom = Number.NEGATIVE_INFINITY;
              for (const rect of rects) {
                if (rect.top >= lineBottom - 1) {
                  lines += 1;
                  lineBottom = rect.bottom;
                } else {
                  lineBottom = Math.max(lineBottom, rect.bottom);
                }
              }
              return lines > 1;
            })
            .map((node) => node.textContent),
        );
      expect(wrapped).toEqual([]);
    });

    test(`has no sideways scroll inside the card at ${width}`, async ({ page }) => {
      await openFooter(page, width);
      const scroll = page.locator('.footer-netstat-scroll');
      const [clientWidth, scrollWidth] = await scroll.evaluate((node) => [
        node.clientWidth,
        node.scrollWidth,
      ]);
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
    });
  }

  test('rows are 28px tall for a fine pointer', async ({ page }) => {
    await openFooter(page, 1280);
    const rows = await page
      .locator('.footer-netstat tbody tr')
      .evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height));
    expect(rows).toHaveLength(ROWS_WITH_HEADER - 1);
    for (const height of rows) expect(height).toBeLessThanOrEqual(FINE_ROW_MAX_PX);
  });

  test('keeps table semantics when the rows stack', async ({ page }) => {
    await openFooter(page, 320);
    const table = page.getByRole('table', { name: TABLE_NAME });
    await expect(table.getByRole('row')).toHaveCount(ROWS_WITH_HEADER);
    await expect(table.getByRole('columnheader')).toHaveCount(3);
  });

  test.describe('touch pointer', () => {
    test.use({ hasTouch: true, isMobile: true });

    test('endpoint targets are 44px tall', async ({ page }) => {
      await openFooter(page, 390);
      for (const height of await endpointHeights(page)) {
        expect(height).toBeGreaterThanOrEqual(TOUCH_ROW_MIN_PX);
      }
    });
  });
});
