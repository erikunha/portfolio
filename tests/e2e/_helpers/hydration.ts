import type { Page } from '@playwright/test';
import { gotoSettled } from './streamed';

const REACT_FIBER_KEY_PREFIX = '__reactFiber$';

export const MENU_TRIGGER = '.menu-trigger';
export const DOCK_MENU = '.dock button[aria-controls="section-drawer"]';
export const MOTION_TOPBAR_TOGGLE = '.desktop-topbar button[aria-pressed]';
export const MOBILE_BAR_CONTROL = '.mobile-title-bar button';
export const STATUS_BAR = '.status-bar';

export async function waitForHydration(page: Page, selector: string): Promise<void> {
  await page.waitForFunction(
    ([target, prefix]) => {
      const node = document.querySelector(target);
      return node !== null && Object.keys(node).some((key) => key.startsWith(prefix));
    },
    [selector, REACT_FIBER_KEY_PREFIX] as const,
  );
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
}

export async function gotoHydrated(
  page: Page,
  path: string,
  controlSelectors: string | readonly string[],
  options?: Parameters<Page['goto']>[1],
): Promise<Awaited<ReturnType<Page['goto']>>> {
  const response = await gotoSettled(page, path, options);
  for (const selector of [controlSelectors].flat()) {
    await waitForHydration(page, selector);
  }
  return response;
}
