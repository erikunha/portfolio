import { expect, test } from '@playwright/test';
import { waitForHydration } from './_helpers/hydration';

const SHELL_CHROME = '.shell-chrome';
const SHELL_FORM = '[data-testid="shell-form"]';
const SETTLE_FRAMES = 40;
const SUBPIXEL_PX = 1;

declare global {
  interface Window {
    __shellWatch: { gaps: number; heights: number[] };
  }
}

test.describe('the server-rendered shell survives hydration', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(
      ([chrome]) => {
        window.__shellWatch = { gaps: 0, heights: [] };
        let painted = false;
        const watch = () => {
          const node = document.querySelector(chrome);
          if (node) {
            painted = true;
            const { height } = node.getBoundingClientRect();
            if (height > 0) window.__shellWatch.heights.push(height);
          } else if (painted) window.__shellWatch.gaps += 1;
          requestAnimationFrame(watch);
        };
        requestAnimationFrame(watch);
      },
      [SHELL_CHROME] as const,
    );
    await page.goto('/');
    await page.waitForSelector(SHELL_FORM, { state: 'attached' });
    await waitForHydration(page, SHELL_FORM);
    const framesAtHydration = await page.evaluate(() => window.__shellWatch.heights.length);
    await expect
      .poll(() => page.evaluate(() => window.__shellWatch.heights.length), {
        message: 'the shell watcher stopped sampling frames after hydration',
      })
      .toBeGreaterThanOrEqual(framesAtHydration + SETTLE_FRAMES);
  });

  test('once the shell is painted it stays in the document through hydration', async ({ page }) => {
    const { gaps } = await page.evaluate(() => window.__shellWatch);
    expect(
      gaps,
      'the shell was swapped for its loading fallback while hydrating: a context value that changes after hydration forces a dehydrated Suspense boundary to client-render, and the section collapses then regrows',
    ).toBe(0);
  });

  test('the window bar keeps its height from first paint to hydrated', async ({ page }) => {
    const { heights } = await page.evaluate(() => window.__shellWatch);
    expect(heights.length, 'the window bar was never painted').toBeGreaterThan(0);
    expect(
      Math.max(...heights) - Math.min(...heights),
      `the window bar changed height across hydration (${[...new Set(heights.map(Math.round))].join(', ')}px): its label variant must be chosen by CSS, not by a client-only viewport read`,
    ).toBeLessThan(SUBPIXEL_PX);
  });
});
