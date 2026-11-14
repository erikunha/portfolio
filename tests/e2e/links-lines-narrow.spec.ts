import { expect, test } from '@playwright/test';
import { gotoSettled } from './_helpers/streamed';

const ROUTES = ['/links', '/links/en'] as const;
const WIDTHS = [320, 375, 390, 768, 1024, 1280] as const;
const LEFT_EDGE_TOLERANCE_PX = 1;

for (const route of ROUTES) {
  for (const width of WIDTHS) {
    test(`${route} at ${width}px keeps every host on one line, left under its label when stacked`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await gotoSettled(page, route);
      const rows = await page.evaluate(() => {
        const range = document.createRange();
        return [...document.querySelectorAll('.links-line')].map((line) => {
          const host = line.querySelector('.links-line-host') as HTMLElement;
          const label = line.querySelector('.links-line-label') as HTMLElement;
          range.selectNodeContents(host);
          const rects = [...range.getClientRects()].filter((rect) => rect.width > 0);
          const lines = new Set(rects.map((rect) => Math.round(rect.top))).size;
          const hostBox = host.getBoundingClientRect();
          const labelBox = label.getBoundingClientRect();
          return {
            text: host.textContent ?? '',
            lines,
            stacked: hostBox.top >= labelBox.bottom - 1,
            hostLeft: Math.min(...rects.map((rect) => rect.left)),
            labelLeft: labelBox.left,
          };
        });
      });
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) {
        expect(row.lines, `${row.text} stays on one line`).toBe(1);
        if (row.stacked) {
          expect(
            Math.abs(row.hostLeft - row.labelLeft),
            `${row.text} sits left-aligned under its label`,
          ).toBeLessThanOrEqual(LEFT_EDGE_TOLERANCE_PX);
        }
      }
    });
  }
}

test('a stacked row at 320px puts the host on its own line under the label', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await gotoSettled(page, '/links/en');
  const stacked = await page.evaluate(
    () =>
      [...document.querySelectorAll('.links-line')].filter((line) => {
        const host = line.querySelector('.links-line-host')?.getBoundingClientRect();
        const label = line.querySelector('.links-line-label')?.getBoundingClientRect();
        return host !== undefined && label !== undefined && host.top >= label.bottom - 1;
      }).length,
  );
  expect(stacked).toBeGreaterThan(0);
});
