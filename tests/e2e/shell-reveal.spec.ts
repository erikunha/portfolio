import { expect, type Page, test } from '@playwright/test';
import { settleFrames } from './_helpers/geometry';
import { installMockBackend } from './_helpers/mock-backend';
import { freezeMotion } from './_helpers/motion';
import {
  askShell,
  openShell,
  SHELL_SELECTOR,
  shellCopy,
  waitForConfirmArmed,
} from './_helpers/shell';

const NARROW = { width: 320, height: 640 } as const;
const DESKTOP = { width: 1280, height: 900 } as const;
const SCROLL_LOG_KEY = '__shellScrollIntoView';
const HIDDEN_UNDER_BARS_PX = 60;
const DESKTOP_CLEARANCE_PX = 80;
const SUBPIXEL_PX = 1;
const SETTLE_FRAMES = 6;
const QUESTION = 'are you there?';
const BARS = '.mobile-title-bar';
const DOCK = '.dock';

type Frame = { feedTop: number; formBottom: number; barsBottom: number; dockTop: number };

async function recordScrollCalls(page: Page) {
  await page.addInitScript((key) => {
    const calls: unknown[] = [];
    Object.defineProperty(window, key, { value: calls });
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function scrollIntoView(
      arg?: boolean | ScrollIntoViewOptions,
    ) {
      calls.push(arg ?? null);
      return original.call(this, arg as ScrollIntoViewOptions);
    };
  }, SCROLL_LOG_KEY);
}

function scrollCalls(page: Page): Promise<unknown[]> {
  return page.evaluate(
    (key) => [...((window as unknown as Record<string, unknown[]>)[key] ?? [])],
    SCROLL_LOG_KEY,
  );
}

function frame(page: Page): Promise<Frame> {
  return page.evaluate(
    ([feed, form, bars, dock]) => {
      const edge = (selector: string, side: 'top' | 'bottom') =>
        document.querySelector(selector)?.getBoundingClientRect()[side] ?? Number.NaN;
      return {
        feedTop: edge(feed as string, 'top'),
        formBottom: edge(form as string, 'bottom'),
        barsBottom: edge(bars as string, 'bottom'),
        dockTop: edge(dock as string, 'top'),
      };
    },
    [SHELL_SELECTOR.feed, SHELL_SELECTOR.form, BARS, DOCK] as const,
  );
}

async function parkFeedUnderBars(page: Page) {
  await settleFrames(page, SETTLE_FRAMES);
  await page.evaluate(
    ([feed, bars, hidden]) => {
      const top = document.querySelector(feed as string)?.getBoundingClientRect().top ?? 0;
      const barsBottom =
        document.querySelector(bars as string)?.getBoundingClientRect().bottom ?? 0;
      window.scrollBy(0, top - (barsBottom - (hidden as number)));
    },
    [SHELL_SELECTOR.feed, BARS, HIDDEN_UNDER_BARS_PX] as const,
  );
  await settleFrames(page);
  const parked = await frame(page);
  expect(parked.feedTop, 'the feed starts under the sticky bars').toBeLessThan(parked.barsBottom);
}

async function expectShellClearOfChrome(page: Page) {
  await settleFrames(page, 4);
  const shown = await frame(page);
  expect(shown.feedTop, 'the newest output sits under the sticky header').toBeGreaterThanOrEqual(
    shown.barsBottom - SUBPIXEL_PX,
  );
  expect(shown.formBottom, 'the input sits under the bottom dock').toBeLessThanOrEqual(
    shown.dockTop + SUBPIXEL_PX,
  );
}

test.describe('new shell output at 320x640', () => {
  test.use({ viewport: NARROW, isMobile: true, hasTouch: true });
  const { ui } = shellCopy();

  test.beforeEach(async ({ page }) => {
    await freezeMotion(page);
    await recordScrollCalls(page);
  });

  test('a local command brings the feed and the input clear of the sticky header', async ({
    page,
  }) => {
    await openShell(page);
    await parkFeedUnderBars(page);
    await askShell(page, 'help');
    await expect(page.locator(SHELL_SELECTOR.output).last()).toBeVisible();
    await expectShellClearOfChrome(page);
    const calls = await scrollCalls(page);
    expect(calls.length, 'the shell scrolled itself into view').toBeGreaterThan(0);
    expect(JSON.stringify(calls), 'MOTION off never scrolls smoothly').not.toContain('smooth');
  });

  test('a refused question does the same for the error line', async ({ page }) => {
    await installMockBackend(page, { ask: 'kill-switch' });
    await openShell(page);
    await parkFeedUnderBars(page);
    await askShell(page, QUESTION);
    await expect(page.locator(SHELL_SELECTOR.error)).toContainText(ui.email);
    await expectShellClearOfChrome(page);
  });

  test('a receipt changing state keeps itself and the input in view', async ({ page }) => {
    await installMockBackend(page, { ask: 'happy', forget: 'storage-unavailable' });
    await openShell(page);
    await askShell(page, QUESTION);
    await expect(page.getByTestId('shell-receipt')).toBeVisible();
    await parkFeedUnderBars(page);
    const secondary = page.getByTestId('shell-receipt-secondary');
    await secondary.click();
    await expect(page.getByTestId('shell-receipt')).toHaveAttribute('data-state', 'confirm');
    await expectShellClearOfChrome(page);
    await parkFeedUnderBars(page);
    await waitForConfirmArmed(page);
    await secondary.click();
    await expect(page.getByTestId('shell-receipt-message')).toHaveText(ui.forgetUnavailable);
    await expectShellClearOfChrome(page);
  });
});

test.describe('new shell output on desktop', () => {
  test.use({ viewport: DESKTOP });

  test('does not move the page when the shell is already fully in view', async ({ page }) => {
    await freezeMotion(page);
    await openShell(page);
    await page.evaluate(
      ([feed, clearance]) => {
        const top = document.querySelector(feed as string)?.getBoundingClientRect().top ?? 0;
        window.scrollBy(0, top - (clearance as number));
      },
      [SHELL_SELECTOR.feed, DESKTOP_CLEARANCE_PX + 45] as const,
    );
    await settleFrames(page);
    const before = await page.evaluate(() => window.scrollY);
    await askShell(page, 'help');
    await expect(page.locator(SHELL_SELECTOR.output).last()).toBeVisible();
    await settleFrames(page, 4);
    expect(await page.evaluate(() => window.scrollY)).toBe(before);
  });
});
