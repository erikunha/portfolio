import { expect, type Page } from '@playwright/test';
import { settleFrames } from './geometry';

export const TO_TOP_NUDGE_PX = 16;
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
  await settleFrames(page);
  await page.evaluate((by) => window.scrollBy(0, -by), deltaPx);
  await expect(page.locator('.to-top-btn')).toHaveClass(/to-top-show/);
}
