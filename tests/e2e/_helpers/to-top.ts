import { expect, type Page } from '@playwright/test';
import { settleFrames } from './geometry';
import { waitForHydration } from './hydration';

export const TO_TOP_NUDGE_PX = 16;
const TO_TOP_SELECTOR = '.to-top-btn';
const WHEEL_UNSUPPORTED = /not supported/i;

export async function scrollByInput(page: Page, deltaPx: number): Promise<void> {
  await settleFrames(page);
  const size = page.viewportSize();
  await page.mouse.move((size?.width ?? 0) / 2, (size?.height ?? 0) / 2);
  try {
    await page.mouse.wheel(0, deltaPx);
  } catch (error) {
    if (!WHEEL_UNSUPPORTED.test(String(error))) throw error;
    await page.evaluate((by) => window.scrollBy(0, by), deltaPx);
  }
}

export async function revealToTop(page: Page, deltaPx = TO_TOP_NUDGE_PX): Promise<void> {
  await waitForHydration(page, TO_TOP_SELECTOR);
  await settleFrames(page);
  await page.evaluate((by) => window.scrollBy(0, -by), deltaPx);
  await expect(page.locator(TO_TOP_SELECTOR)).toHaveClass(/to-top-show/);
}
