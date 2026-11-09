import { expect, test } from '@playwright/test';
import { gotoSettled } from './_helpers/streamed';

const COMPACT_WIDTHS = [320, 360, 390, 399] as const;
const CARD_WIDTHS = [390, 768, 1024, 1280, 1920] as const;
const ABOUT_WIDTHS = [320, 390, 479] as const;
const VIEWPORT_HEIGHT = 900;
const MIN_TEXT_CLEARANCE_PX = 4;
const SAME_ROW_TOLERANCE_PX = 2;
const MAX_CARD_VOID_PX = 24;

test.describe('hero actions stack in one column under 400px', () => {
  for (const width of COMPACT_WIDTHS) {
    test(`at ${width}px the actions share one column and no label touches a border`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
      await gotoSettled(page, '/');
      const rows = await page.locator('.hero-mobile .hero-actions > a').evaluateAll((links) =>
        links.map((link) => {
          const box = link.getBoundingClientRect();
          const range = document.createRange();
          range.selectNodeContents(link);
          const text = range.getBoundingClientRect();
          return {
            left: box.left,
            right: box.right,
            top: box.top,
            textLeft: text.left - box.left,
            textRight: box.right - text.right,
          };
        }),
      );
      expect(rows.length).toBeGreaterThan(1);
      for (const row of rows) {
        expect(row.left, 'every action starts on the same left edge').toBeCloseTo(
          rows[0]?.left ?? 0,
          0,
        );
        expect(row.right, 'every action ends on the same right edge').toBeCloseTo(
          rows[0]?.right ?? 0,
          0,
        );
        expect(Math.min(row.textLeft, row.textRight)).toBeGreaterThanOrEqual(MIN_TEXT_CLEARANCE_PX);
      }
      const tops = rows.map((row) => row.top);
      expect(new Set(tops.map(Math.round)).size, 'one action per row').toBe(rows.length);
    });
  }
});

test.describe('the About code panel header keeps the marker with its title', () => {
  for (const width of ABOUT_WIDTHS) {
    test(`at ${width}px the marker and title share a row and the link sits centered under them`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
      await gotoSettled(page, '/');
      const header = await page.locator('.ab-code .panel-head').evaluate((head) => {
        const rect = (selector: string) =>
          (head.querySelector(selector) as HTMLElement).getBoundingClientRect();
        const box = head.getBoundingClientRect();
        const marker = rect('.panel-marker');
        const title = rect('.panel-title');
        const link = rect('a');
        return {
          markerMiddle: marker.top + marker.height / 2,
          titleTop: title.top,
          titleBottom: title.bottom,
          linkTop: link.top,
          linkMiddle: link.left + link.width / 2,
          headMiddle: box.left + box.width / 2,
        };
      });
      expect(header.markerMiddle, 'the marker sits on the title row').toBeGreaterThanOrEqual(
        header.titleTop - SAME_ROW_TOLERANCE_PX,
      );
      expect(header.markerMiddle).toBeLessThanOrEqual(header.titleBottom + SAME_ROW_TOLERANCE_PX);
      expect(header.linkTop, 'the link wraps under the title').toBeGreaterThanOrEqual(
        header.titleBottom - SAME_ROW_TOLERANCE_PX,
      );
      expect(Math.abs(header.linkMiddle - header.headMiddle)).toBeLessThanOrEqual(
        SAME_ROW_TOLERANCE_PX,
      );
    });
  }
});

test.describe('project cards keep their stats under the description', () => {
  for (const width of CARD_WIDTHS) {
    test(`at ${width}px no card has more than ${MAX_CARD_VOID_PX}px between description and stats`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
      await gotoSettled(page, '/');
      await page.locator('.projects-grid').scrollIntoViewIfNeeded();
      const gaps = await page.locator('.project-card').evaluateAll((cards) =>
        cards.map((card) => {
          const desc = (card.querySelector('.project-desc') as HTMLElement).getBoundingClientRect();
          const stats = (
            card.querySelector('.project-stats') as HTMLElement
          ).getBoundingClientRect();
          return Math.round(stats.top - desc.bottom);
        }),
      );
      expect(gaps.length).toBeGreaterThan(0);
      expect(
        Math.max(...gaps),
        'a stretched card must not push its stats to the bottom',
      ).toBeLessThanOrEqual(MAX_CARD_VOID_PX);
    });
  }
});

const ERROR_BOX_WIDTHS = [390, 1280] as const;
const FILL_TOLERANCE_PX = 1;

test.describe('the eval error box fills the block it stands in', () => {
  for (const width of ERROR_BOX_WIDTHS) {
    test(`at ${width}px the box is as tall as the block and centers its message`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
      await gotoSettled(page, '/');
      const box = page.locator('.measured-error');
      test.skip((await box.count()) === 0, 'the eval store answered, so there is no error box');
      await box.scrollIntoViewIfNeeded();
      const geometry = await box.evaluate((node) => {
        const block = node.parentElement?.getBoundingClientRect();
        const self = node.getBoundingClientRect();
        const message = node.querySelector('strong')?.getBoundingClientRect();
        return {
          blockHeight: block?.height ?? 0,
          boxHeight: self.height,
          messageMiddle: (message?.left ?? 0) + (message?.width ?? 0) / 2,
          boxMiddle: self.left + self.width / 2,
        };
      });
      expect(
        Math.abs(geometry.boxHeight - geometry.blockHeight),
        'the box must fill the reserved height, not leave it empty beneath',
      ).toBeLessThanOrEqual(FILL_TOLERANCE_PX);
      expect(
        Math.abs(geometry.messageMiddle - geometry.boxMiddle),
        'the message sits centered in the box',
      ).toBeLessThanOrEqual(FILL_TOLERANCE_PX * 2);
    });
  }
});
