import { fileURLToPath } from 'node:url';
import { expect, type Locator, type Page } from '@playwright/test';
import { volatileMasks } from './mask-volatile';

const SNAPSHOT_TIMEOUT_MS = 30_000;
const HIDE_DECORATIVE_CANVAS = fileURLToPath(
  new URL('./hide-decorative-canvas.css', import.meta.url),
);

export async function revealDeferredContent(page: Page): Promise<void> {
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('[data-cv-defer]')) {
      (el as HTMLElement).style.setProperty('content-visibility', 'visible');
    }
    for (const el of document.querySelectorAll('nextjs-portal')) el.remove();
  });
}

export async function snapshot(page: Page, name: string): Promise<void> {
  await revealDeferredContent(page);
  await expect(page).toHaveScreenshot(name, {
    mask: volatileMasks(page),
    stylePath: HIDE_DECORATIVE_CANVAS,
    maxDiffPixelRatio: 0.01,
    animations: 'disabled',
    timeout: SNAPSHOT_TIMEOUT_MS,
  });
}

export async function snapshotLocator(
  page: Page,
  locator: Locator,
  name: string,
  options?: { maxDiffPixelRatio?: number; maxDiffPixels?: number },
): Promise<void> {
  await revealDeferredContent(page);
  await expect(locator).toHaveScreenshot(name, {
    mask: volatileMasks(page),
    stylePath: HIDE_DECORATIVE_CANVAS,
    ...(options?.maxDiffPixels !== undefined
      ? { maxDiffPixels: options.maxDiffPixels, maxDiffPixelRatio: 1.0 }
      : { maxDiffPixelRatio: options?.maxDiffPixelRatio ?? 0.01 }),
    animations: 'disabled',
    timeout: SNAPSHOT_TIMEOUT_MS,
  });
}
