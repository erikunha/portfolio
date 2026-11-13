import { expect, type Page, test } from '@playwright/test';
import { settleFrames } from './_helpers/geometry';
import { waitForHydration } from './_helpers/hydration';
import { freezeMotion } from './_helpers/motion';

const VIEWPORTS = [
  { width: 320, height: 844 },
  { width: 375, height: 844 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
] as const;
const SHELL_INPUT = '[aria-label="shell command"]';
const SHELL_FORM = '[data-testid="shell-form"]';
const FEED = '[role="log"]';
const STOP_ROW = '.shell-stop-row';
const ESC_HINT = '.shell-esc-hint';
const STOP_NAME = 'Stop answer';
const FILLER_COMMAND = 'help';
const MAX_FILLER_COMMANDS = 24;
const EDGE_INSET_PX = 2;
const PROBE_ROWS = 3;
const BORDER_WIDTH_PX = 1;
const TRANSPARENT = 'rgba(0, 0, 0, 0)';
const FEED_LINE_SELECTOR = '.shell-line';

async function openBusyShell(page: Page, viewport: { width: number; height: number }) {
  await page.setViewportSize(viewport);
  await freezeMotion(page);
  await page.route('**/api/ask', () => new Promise(() => undefined));
  await page.goto('/');
  await page.getByTestId('shell-form').scrollIntoViewIfNeeded();
  await waitForHydration(page, SHELL_FORM);
  const input = page.locator(SHELL_INPUT);
  const feed = page.locator(FEED);
  for (let count = 0; count < MAX_FILLER_COMMANDS; count++) {
    if (await feed.evaluate((node) => node.scrollHeight > node.clientHeight)) break;
    await input.fill(FILLER_COMMAND);
    await page.keyboard.press('Enter');
  }
  await input.fill('who is erik?');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: STOP_NAME })).toBeVisible();
  expect(
    await feed.evaluate((node) => node.scrollHeight > node.clientHeight),
    'the filler commands must overflow the feed',
  ).toBe(true);
}

type Coverage = { misses: string[]; samples: number };

function sampleRowCoverage(page: Page): Promise<Coverage> {
  return page.evaluate(
    ([rowSelector, inset, rows, borderWidth]) => {
      const row = document.querySelector(rowSelector);
      if (!row) return { misses: ['no stop row'], samples: 0 };
      const box = row.getBoundingClientRect();
      const wrap = (row.parentElement ?? row).getBoundingClientRect();
      const xs = [wrap.left + inset, wrap.left + wrap.width / 2, wrap.right - inset];
      const ys = Array.from(
        { length: rows },
        (_, index) =>
          box.top +
          borderWidth +
          ((box.height - borderWidth - inset) * index) / Math.max(rows - 1, 1),
      );
      const misses: string[] = [];
      for (const x of xs) {
        for (const y of ys) {
          const hit = document.elementFromPoint(x, y);
          if (hit !== row && !row.contains(hit)) {
            const described = hit
              ? `${hit.tagName.toLowerCase()}.${hit.className} "${(hit.textContent ?? '').slice(0, 24)}"`
              : 'nothing';
            misses.push(`(${Math.round(x)},${Math.round(y)}) hits ${described}`);
          }
        }
      }
      return { misses, samples: xs.length * ys.length };
    },
    [STOP_ROW, EDGE_INSET_PX, PROBE_ROWS, BORDER_WIDTH_PX] as const,
  );
}

for (const viewport of VIEWPORTS) {
  test.describe(`at ${viewport.width}px the busy stop bar`, () => {
    test('covers the whole row width over a feed scrolled up', async ({ page }) => {
      await openBusyShell(page, viewport);
      await page.locator(FEED).evaluate((feed) => {
        feed.scrollTop = 0;
      });
      await settleFrames(page);
      const coverage = await sampleRowCoverage(page);
      expect(coverage.samples).toBeGreaterThan(0);
      expect(coverage.misses, 'feed text shows beside or under the stop row').toEqual([]);
    });

    test('covers the whole row width with the feed at the end', async ({ page }) => {
      await openBusyShell(page, viewport);
      await page.locator(FEED).evaluate((feed) => {
        feed.scrollTop = feed.scrollHeight;
      });
      await settleFrames(page);
      const coverage = await sampleRowCoverage(page);
      expect(coverage.misses, 'feed text shows beside or under the stop row').toEqual([]);
    });

    test('leaves the last feed line fully readable above the bar at the end', async ({ page }) => {
      await openBusyShell(page, viewport);
      await page.locator(FEED).evaluate((feed) => {
        feed.scrollTop = feed.scrollHeight;
      });
      await settleFrames(page);
      const gap = await page.evaluate(
        ([rowSelector, lineSelector, feedSelector]) => {
          const row = document.querySelector(rowSelector)?.getBoundingClientRect();
          const feed = document.querySelector(feedSelector);
          const lines = feed?.querySelectorAll(lineSelector);
          const last = lines?.[lines.length - 1]?.getBoundingClientRect();
          return row && last ? row.top - last.bottom : Number.NaN;
        },
        [STOP_ROW, FEED_LINE_SELECTOR, FEED] as const,
      );
      expect(gap, 'the last line must end above the top of the bar').toBeGreaterThanOrEqual(0);
    });

    test('draws a border token separator and an opaque background', async ({ page }) => {
      await openBusyShell(page, viewport);
      const style = await page.locator(STOP_ROW).evaluate((row) => {
        const computed = getComputedStyle(row);
        const shell = getComputedStyle(row.closest('.interactive-shell') ?? row);
        return {
          topWidth: computed.borderTopWidth,
          topStyle: computed.borderTopStyle,
          topColor: computed.borderTopColor,
          background: computed.backgroundColor,
          shellBackground: shell.backgroundColor,
          boxWidth: row.getBoundingClientRect().width,
          wrapWidth: row.parentElement?.getBoundingClientRect().width ?? 0,
        };
      });
      expect(style.topWidth).toBe('1px');
      expect(style.topStyle).toBe('solid');
      expect(style.topColor).not.toBe(TRANSPARENT);
      expect(style.background).toBe(style.shellBackground);
      expect(style.boxWidth).toBe(style.wrapWidth);
    });
  });
}

test.describe('the Esc hint', () => {
  test.use({ hasTouch: false, isMobile: false });

  test('is visible with a fine pointer on desktop', async ({ page }) => {
    await openBusyShell(page, VIEWPORTS[3]);
    const fine = await page.evaluate(
      () => matchMedia('(hover: hover) and (pointer: fine)').matches,
    );
    expect(fine).toBe(true);
    await expect(page.locator(ESC_HINT)).toBeVisible();
  });
});

test.describe('the Esc hint on a touch phone', () => {
  test.use({ hasTouch: true, isMobile: true });

  test('is hidden with a coarse pointer', async ({ page }) => {
    await openBusyShell(page, VIEWPORTS[1]);
    const coarse = await page.evaluate(() => matchMedia('(pointer: coarse)').matches);
    expect(coarse, 'the emulated viewport must report a coarse pointer').toBe(true);
    await expect(page.locator(ESC_HINT)).toBeHidden();
    await expect(page.getByRole('button', { name: STOP_NAME })).toBeVisible();
  });
});
