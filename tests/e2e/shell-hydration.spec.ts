import { expect, test } from '@playwright/test';
import { waitForHydration } from './_helpers/hydration';

const SHELL_CHROME = '.shell-chrome';
const SHELL_FORM = '[data-testid="shell-form"]';
const OBSERVE_WINDOW_MS = 1500;
const MIN_FRAMES = 3;
const SUBPIXEL_PX = 1;

declare global {
  interface Window {
    __shellWatch: { gaps: number; heights: number[]; frames: number; hydrated: boolean };
  }
}

test.describe('the server-rendered shell survives hydration', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(
      ([chrome]) => {
        const watch = { gaps: 0, heights: [] as number[], frames: 0, hydrated: false };
        window.__shellWatch = watch;
        let tracked: Element | null = null;
        const sizes = new ResizeObserver(() => {
          if (!tracked) return;
          const { height } = tracked.getBoundingClientRect();
          if (height > 0) watch.heights.push(height);
        });
        const track = () => {
          const node = document.querySelector(chrome);
          if (node === tracked) return;
          if (tracked) sizes.unobserve(tracked);
          tracked = node;
          if (node) sizes.observe(node);
        };
        new MutationObserver((records) => {
          const previous = tracked;
          if (previous) {
            const removed = records.some((record) =>
              Array.from(record.removedNodes).some((node) => node.contains(previous)),
            );
            if (removed && (watch.hydrated || !document.querySelector(chrome))) watch.gaps += 1;
          }
          track();
        }).observe(document, { childList: true, subtree: true });
        const frame = () => {
          watch.frames += 1;
          requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      },
      [SHELL_CHROME] as const,
    );
    await page.goto('/');
    await page.waitForSelector(SHELL_FORM, { state: 'attached' });
    await waitForHydration(page, SHELL_FORM);
    const framesAtHydration = await page.evaluate(() => {
      window.__shellWatch.hydrated = true;
      return window.__shellWatch.frames;
    });
    await page.evaluate(
      ([windowMs, minFrames, framesBefore]) =>
        new Promise<void>((resolve) => {
          const deadline = performance.now() + windowMs;
          const check = () => {
            if (
              performance.now() >= deadline &&
              window.__shellWatch.frames >= framesBefore + minFrames
            )
              resolve();
            else requestAnimationFrame(check);
          };
          check();
        }),
      [OBSERVE_WINDOW_MS, MIN_FRAMES, framesAtHydration] as const,
    );
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
