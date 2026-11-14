import { expect, type Page, test } from '@playwright/test';
import { gotoSettled } from './_helpers/streamed';

const WIDTHS = [320, 375, 768] as const;
const ROUTES = ['/', '/pt'] as const;
const VIEWPORT_HEIGHT = 812;
const DOCK_ITEMS = '.dock > a, .dock > button';
const SUBPIXEL_TOLERANCE_PX = 0.5;
const MIN_LABEL_GAP_PX = 1;
const TEXT_SPACING_STYLE = `
  * {
    line-height: 1.5 !important;
    letter-spacing: 0.12em !important;
    word-spacing: 0.16em !important;
  }
  p {
    margin-bottom: 2em !important;
  }
`;

interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

interface DockItemLayout {
  label: string;
  text: Box;
  item: Box;
  dock: Box;
  dockOverflow: number;
}

function readDock(page: Page): Promise<DockItemLayout[]> {
  return page.locator(DOCK_ITEMS).evaluateAll((nodes) =>
    nodes.map((node) => {
      const range = document.createRange();
      range.selectNodeContents(node);
      const text = range.getBoundingClientRect();
      const item = node.getBoundingClientRect();
      const dockNode = node.closest('.dock') as HTMLElement;
      const dock = dockNode.getBoundingClientRect();
      return {
        label: node.textContent?.trim() ?? '',
        text: { left: text.left, right: text.right, top: text.top, bottom: text.bottom },
        item: { left: item.left, right: item.right, top: item.top, bottom: item.bottom },
        dock: { left: dock.left, right: dock.right, top: dock.top, bottom: dock.bottom },
        dockOverflow: dockNode.scrollWidth - dockNode.clientWidth,
      };
    }),
  );
}

for (const route of ROUTES) {
  for (const width of WIDTHS) {
    test.describe(`${route} at ${width}px`, () => {
      test.use({
        viewport: { width, height: VIEWPORT_HEIGHT },
        isMobile: true,
        hasTouch: true,
      });

      test('dock labels stay apart and unclipped under WCAG 1.4.12 text spacing', async ({
        page,
      }) => {
        await gotoSettled(page, route);
        const dockDisplayed = await page.locator('.dock').first().isVisible();
        test.skip(!dockDisplayed, `the dock is not displayed at ${width}px`);
        await page.addStyleTag({ content: TEXT_SPACING_STYLE });
        const items = await readDock(page);
        expect(items.length, 'the dock lists its five controls').toBe(5);

        items.slice(1).forEach((next, index) => {
          const previous = items[index];
          const gap = next.text.left - (previous?.text.right ?? 0);
          expect(
            gap,
            `"${previous?.label}" and "${next.label}" overlap under text spacing at ${width}px`,
          ).toBeGreaterThanOrEqual(MIN_LABEL_GAP_PX);
        });

        for (const { label, text, item, dock, dockOverflow } of items) {
          expect(text.left, `"${label}" starts inside its control`).toBeGreaterThanOrEqual(
            item.left - SUBPIXEL_TOLERANCE_PX,
          );
          expect(text.right, `"${label}" ends inside its control`).toBeLessThanOrEqual(
            item.right + SUBPIXEL_TOLERANCE_PX,
          );
          expect(text.left, `"${label}" starts inside the viewport`).toBeGreaterThanOrEqual(0);
          expect(text.right, `"${label}" ends inside the viewport`).toBeLessThanOrEqual(width);
          expect(text.bottom, `"${label}" is not clipped by the dock bottom`).toBeLessThanOrEqual(
            dock.bottom + SUBPIXEL_TOLERANCE_PX,
          );
          expect(text.top, `"${label}" is not clipped by the dock top`).toBeGreaterThanOrEqual(
            dock.top - SUBPIXEL_TOLERANCE_PX,
          );
          expect(dockOverflow, 'the dock scrolls sideways').toBeLessThanOrEqual(0);
        }
      });
    });
  }
}
