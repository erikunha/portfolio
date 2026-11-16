import { expect, type Page } from '@playwright/test';
import { MOBILE_BREAKPOINT_PX } from '@/lib/breakpoint';

const PHONE_LARGE_FROM_PX = 400;
const PHONE_WIDE_PX = 480;
const LAPTOP_PX = 1024;
const LAST_PX_BELOW = 1;

export const WIDTH = {
  PHONE_NARROW: 320,
  PHONE_SMALL: 340,
  PHONE_ANDROID: 360,
  PHONE_COMPACT: 375,
  PHONE: 390,
  BELOW_PHONE_LARGE: PHONE_LARGE_FROM_PX - LAST_PX_BELOW,
  PHONE_ANDROID_LARGE: 412,
  PHONE_MAX: 430,
  BELOW_PHONE_WIDE: PHONE_WIDE_PX - LAST_PX_BELOW,
  PHONE_WIDE: PHONE_WIDE_PX,
  PHONE_LANDSCAPE: 540,
  TABLET_SMALL: 600,
  BELOW_TABLET: MOBILE_BREAKPOINT_PX - LAST_PX_BELOW,
  TABLET: MOBILE_BREAKPOINT_PX,
  TABLET_LARGE: 820,
  BELOW_LAPTOP: LAPTOP_PX - LAST_PX_BELOW,
  LAPTOP: LAPTOP_PX,
  DESKTOP: 1280,
  DESKTOP_WIDE: 1440,
  DESKTOP_LARGE: 1536,
  DESKTOP_FULL_HD: 1920,
} as const;

export const CORE_WIDTHS = [WIDTH.PHONE_NARROW, WIDTH.PHONE, WIDTH.TABLET, WIDTH.DESKTOP] as const;

export const CORE_COMPACT_WIDTHS = [
  WIDTH.PHONE_NARROW,
  WIDTH.PHONE_COMPACT,
  WIDTH.TABLET,
  WIDTH.DESKTOP,
] as const;

export const CORE_LAPTOP_WIDTHS = [
  WIDTH.PHONE_NARROW,
  WIDTH.PHONE,
  WIDTH.TABLET,
  WIDTH.LAPTOP,
  WIDTH.DESKTOP,
] as const;

export const FULL_SWEEP_WIDTHS = [
  WIDTH.PHONE_NARROW,
  WIDTH.PHONE_COMPACT,
  WIDTH.PHONE,
  WIDTH.TABLET,
  WIDTH.LAPTOP,
  WIDTH.DESKTOP,
] as const;

export const PHONE_TO_TABLET_WIDTHS = [
  WIDTH.PHONE_NARROW,
  WIDTH.PHONE_COMPACT,
  WIDTH.TABLET,
] as const;

export const PHONE_RANGE_WIDTHS = [
  WIDTH.PHONE_NARROW,
  WIDTH.PHONE_ANDROID,
  WIDTH.PHONE_COMPACT,
  WIDTH.PHONE,
  WIDTH.PHONE_MAX,
] as const;

export const NARROW_PHONE_WIDTHS = [WIDTH.PHONE_NARROW, WIDTH.PHONE_COMPACT] as const;

export const PHONE_PAIR_WIDTHS = [WIDTH.PHONE_NARROW, WIDTH.PHONE] as const;

export const VIEWPORTS = {
  PHONE_NARROW: { width: WIDTH.PHONE_NARROW, height: 640 },
  PHONE: { width: WIDTH.PHONE, height: 844 },
  TABLET: { width: WIDTH.TABLET, height: 1024 },
  DESKTOP: { width: WIDTH.DESKTOP, height: 720 },
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

const DEFAULT_SETTLE_FRAMES = 2;

export function settleFrames(page: Page, frames = DEFAULT_SETTLE_FRAMES): Promise<void> {
  return page.evaluate(
    (count) =>
      new Promise<void>((resolve) => {
        const tick = (remaining: number) =>
          requestAnimationFrame(() => (remaining <= 1 ? resolve() : tick(remaining - 1)));
        tick(count);
      }),
    frames,
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

const STABILITY_WINDOW_MS = 500;
const STABILITY_TIMEOUT_MS = 15_000;
const STABILITY_POLL_MS = 50;

export async function expectStableFor<T>(
  read: () => Promise<T>,
  windowMs = STABILITY_WINDOW_MS,
): Promise<void> {
  let last: T | undefined;
  let since = Date.now();
  await expect
    .poll(
      async () => {
        const now = await read();
        if (!Object.is(now, last) && JSON.stringify(now) !== JSON.stringify(last)) {
          last = now;
          since = Date.now();
        }
        return Date.now() - since >= windowMs;
      },
      { timeout: STABILITY_TIMEOUT_MS, intervals: [STABILITY_POLL_MS] },
    )
    .toBe(true);
}
