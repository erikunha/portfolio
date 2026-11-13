import { expect, type Page, test } from '@playwright/test';
import { shellUi } from '../../content/shell-ui';
import { SITE_LOCALE, type SiteLocale } from '../../content/site-locale';
import { settleFrames } from './_helpers/geometry';
import { installChunkedAsk } from './_helpers/mock-backend';
import { freezeMotion } from './_helpers/motion';
import { askShell, openShell, SHELL_SELECTOR, stopButton } from './_helpers/shell';

const CASES = [
  { width: 320, height: 844, locale: SITE_LOCALE.en, motionOff: true },
  { width: 375, height: 844, locale: SITE_LOCALE.pt, motionOff: false },
  { width: 768, height: 1024, locale: SITE_LOCALE.en, motionOff: false },
  { width: 1280, height: 800, locale: SITE_LOCALE.pt, motionOff: true },
] as const;
const PATHS: Record<SiteLocale, string> = { [SITE_LOCALE.en]: '/', [SITE_LOCALE.pt]: '/pt' };
const FILLER_COMMAND = 'help';
const MAX_FILLER_COMMANDS = 24;
const TARGET_PX = 44;
const OPAQUE_BLACK = 'rgb(0, 0, 0)';
const HALO_PX = '6px';
const PROBE_COLUMNS = 7;
const PROBE_ROWS = 3;
const EDGE_INSET_PX = 1;
const SUBPIXEL_PX = 1;
const ELAPSED_TENTHS = /\d+\.\ds$/;
const ELAPSED_WHOLE = /\s\d+s$/;

async function overflowFeed(page: Page): Promise<void> {
  const feed = page.locator(SHELL_SELECTOR.feed);
  for (let count = 0; count < MAX_FILLER_COMMANDS; count++) {
    if (await feed.evaluate((node) => node.scrollHeight > node.clientHeight)) return;
    await askShell(page, FILLER_COMMAND);
  }
}

function pillCoverage(page: Page) {
  return page.evaluate(
    ([columns, rows, inset]) => {
      const pill = document.querySelector('.shell-stop-pill');
      if (!pill) return { misses: ['no pill'], samples: 0 };
      const box = pill.getBoundingClientRect();
      const misses: string[] = [];
      for (let column = 0; column < columns; column++) {
        for (let row = 0; row < rows; row++) {
          const x = box.left + inset + ((box.width - 2 * inset) * column) / (columns - 1);
          const y = box.top + inset + ((box.height - 2 * inset) * row) / (rows - 1);
          const hit = document.elementFromPoint(x, y);
          if (hit !== pill && !pill.contains(hit)) {
            misses.push(`(${Math.round(x)},${Math.round(y)}) hits ${hit?.className ?? 'nothing'}`);
          }
        }
      }
      return { misses, samples: columns * rows };
    },
    [PROBE_COLUMNS, PROBE_ROWS, EDGE_INSET_PX] as const,
  );
}

async function expectOpaquePill(page: Page, locale: SiteLocale, motionOff: boolean) {
  const pill = stopButton(page, locale);
  await expect(pill).toBeVisible();
  const style = await pill.evaluate((node) => {
    const computed = getComputedStyle(node);
    const box = node.getBoundingClientRect();
    const wrap = node.parentElement?.getBoundingClientRect();
    return {
      background: computed.backgroundColor,
      shadow: computed.boxShadow,
      border: computed.borderTopWidth,
      height: box.height,
      centerOffset: wrap ? Math.abs(box.left + box.width / 2 - (wrap.left + wrap.width / 2)) : -1,
      inLive: node.closest('[role="log"], [aria-live]') !== null,
    };
  });
  expect(style.background).toBe(OPAQUE_BLACK);
  expect(style.shadow).toContain(HALO_PX);
  expect(style.border).toBe('1px');
  expect(style.height).toBeGreaterThanOrEqual(TARGET_PX);
  expect(style.centerOffset).toBeLessThanOrEqual(SUBPIXEL_PX);
  expect(style.inLive, 'a live region would announce the button').toBe(false);
  const coverage = await pillCoverage(page);
  expect(coverage.samples).toBeGreaterThan(0);
  expect(coverage.misses, 'feed text shows through or over the pill').toEqual([]);
  await expect(pill.locator('.shell-stop-elapsed')).toHaveText(
    motionOff ? ELAPSED_WHOLE : ELAPSED_TENTHS,
  );
}

for (const { width, height, locale, motionOff } of CASES) {
  test.describe(`at ${width}px (${locale}${motionOff ? ', MOTION off' : ''}) the stop pill`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width, height });
      if (motionOff) await freezeMotion(page);
    });

    test('floats opaque over the feed while thinking and streaming, scrolled up or at the end', async ({
      page,
    }) => {
      const chunked = await installChunkedAsk(page);
      await openShell(page, PATHS[locale]);
      await overflowFeed(page);
      const form = page.locator(SHELL_SELECTOR.form);
      const formTop = await form.evaluate((node) => node.getBoundingClientRect().top);

      await askShell(page, 'who is erik?');
      await expect.poll(chunked.requests).toBe(1);
      await expectOpaquePill(page, locale, motionOff);
      await page.locator(SHELL_SELECTOR.feed).evaluate((feed) => {
        feed.scrollTop = 0;
      });
      await settleFrames(page);
      await expectOpaquePill(page, locale, motionOff);

      await chunked.push('Erik builds agent platforms and evaluation harnesses. '.repeat(6));
      await expect(page.locator(SHELL_SELECTOR.caret)).toBeVisible();
      await page.locator(SHELL_SELECTOR.feed).evaluate((feed) => {
        feed.scrollTop = 0;
      });
      await settleFrames(page);
      await expectOpaquePill(page, locale, motionOff);

      await page.locator(SHELL_SELECTOR.feed).evaluate((feed) => {
        feed.scrollTop = feed.scrollHeight;
      });
      await settleFrames(page);
      const gap = await page.evaluate(() => {
        const pill = document.querySelector('.shell-stop-pill')?.getBoundingClientRect();
        const lines = document.querySelectorAll('[role="log"] .shell-line');
        const last = lines[lines.length - 1]?.getBoundingClientRect();
        return pill && last ? pill.top - last.bottom : Number.NaN;
      });
      expect(gap, 'the last line ends above the pill and its halo').toBeGreaterThanOrEqual(0);
      expect(await form.evaluate((node) => node.getBoundingClientRect().top)).toBeCloseTo(
        formTop,
        0,
      );

      await chunked.end();
      await expect(stopButton(page, locale)).toHaveCount(0);
      expect(await form.evaluate((node) => node.getBoundingClientRect().top)).toBeCloseTo(
        formTop,
        0,
      );
    });

    test('leaves after a stop click and gives focus back to the input', async ({ page }) => {
      await page.route('**/api/ask', () => new Promise(() => undefined));
      await openShell(page, PATHS[locale]);
      await askShell(page, 'who is erik?');
      await stopButton(page, locale).click();
      await expect(stopButton(page, locale)).toHaveCount(0);
      await expect(page.locator(SHELL_SELECTOR.input)).toBeFocused();
    });

    test('leaves when the request fails', async ({ page }) => {
      await page.route('**/api/ask', (route) => route.abort('failed'));
      await openShell(page, PATHS[locale]);
      await askShell(page, 'who is erik?');
      await expect(page.locator(SHELL_SELECTOR.error)).toBeVisible();
      await expect(stopButton(page, locale)).toHaveCount(0);
    });
  });
}

test.describe('the esc hint inside the pill', () => {
  test.use({ hasTouch: false, isMobile: false });

  test('shows on a fine pointer', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.route('**/api/ask', () => new Promise(() => undefined));
    await openShell(page);
    await askShell(page, 'who is erik?');
    await expect(stopButton(page).locator('kbd')).toHaveText(shellUi[SITE_LOCALE.en].escKey);
    await expect(stopButton(page).locator('kbd')).toBeVisible();
  });
});

test.describe('the esc hint on a touch phone', () => {
  test.use({ hasTouch: true, isMobile: true });

  test('is hidden and the pill keeps its 44px target', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 844 });
    await page.route('**/api/ask', () => new Promise(() => undefined));
    await openShell(page);
    await askShell(page, 'who is erik?');
    await expect(stopButton(page)).toBeVisible();
    await expect(stopButton(page).locator('kbd')).toBeHidden();
    const box = await stopButton(page).boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(TARGET_PX);
  });
});
