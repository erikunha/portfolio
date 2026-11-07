import type { Page } from '@playwright/test';

export const VIEWPORTS = {
  PHONE_NARROW: { width: 320, height: 640 },
  PHONE: { width: 390, height: 844 },
  TABLET: { width: 768, height: 1024 },
  DESKTOP: { width: 1280, height: 720 },
} as const;

export function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

export function heightOf(page: Page, selector: string): Promise<number> {
  return page
    .locator(selector)
    .first()
    .evaluate((node) => node.getBoundingClientRect().height);
}

export function settleFrames(page: Page): Promise<void> {
  return page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
}

const STABLE_FRAMES = 10;
const STABLE_TIMEOUT_MS = 20_000;

type Reading = 'top' | 'href';

function waitForStableReading(page: Page, selector: string, reading: Reading): Promise<void> {
  return page.evaluate(
    ([target, kind, frames, timeout]) =>
      new Promise<void>((resolve, reject) => {
        const deadline = performance.now() + Number(timeout);
        const read = () => {
          const node = [...document.querySelectorAll(String(target))].find(
            (candidate) => candidate.getClientRects().length > 0,
          );
          if (!node) return null;
          return kind === 'top'
            ? Math.round(node.getBoundingClientRect().top)
            : node.getAttribute('href');
        };
        let last = read();
        let steady = 0;
        const step = () => {
          const now = read();
          steady = now === last && now !== null ? steady + 1 : 0;
          last = now;
          if (steady >= Number(frames)) resolve();
          else if (performance.now() > deadline) reject(new Error(`${target} kept changing`));
          else requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }),
    [selector, reading, STABLE_FRAMES, STABLE_TIMEOUT_MS] as const,
  );
}

export function waitForStablePosition(page: Page, selector: string): Promise<void> {
  return waitForStableReading(page, selector, 'top');
}

export function waitForStableHref(page: Page, selector: string): Promise<void> {
  return waitForStableReading(page, selector, 'href');
}
