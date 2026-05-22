// tests/e2e/_helpers/snapshot.ts
//
// Thin wrappers around toHaveScreenshot() that enforce project-wide visual
// regression policy: 1% pixel-ratio threshold, volatile regions masked, all
// CSS animations frozen before capture.
//
// Use snapshot(page, ...) for full-page captures (above-the-fold drift checks).
// Use snapshotLocator(page, locator, ...) for clipped captures scoped to a
// specific element — preferred when the test asserts on a single section.
//
// Name must be unique within the spec file. Playwright namespaces baselines
// by browser project + platform automatically, so the same name produces
// separate baselines for chromium-darwin vs chromium-linux.

import { expect, type Locator, type Page } from '@playwright/test';
import { volatileMasks } from './mask-volatile';

// 30s covers WebKit's slower scroll-stability + content-visibility:auto
// reveal on cv-defer'd sections (e.g. #sec-contact), and chromium-mobile's
// post-hydration layout reflow when the matrix-rain canvas (full-viewport
// <canvas aria-hidden>) responds to bio-panel size changes. The default 5s
// is the snapshot stability wait, not the per-action wait, so this is
// independent from playwright.config's testTimeout.
const SNAPSHOT_TIMEOUT_MS = 30_000;

// content-visibility:auto sections (the .cv-defer modules) skip rendering
// their off-screen subtree. A full-element screenshot then captures that
// subtree as solid black, so reveal them before any snapshot. Forcing
// 'visible' only disables render-skipping; on-screen rendering is identical.
async function revealDeferredContent(page: Page): Promise<void> {
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('[data-cv-defer]')) {
      (el as HTMLElement).style.setProperty('content-visibility', 'visible');
    }
  });
}

export async function snapshot(page: Page, name: string): Promise<void> {
  await revealDeferredContent(page);
  await expect(page).toHaveScreenshot(name, {
    mask: volatileMasks(page),
    maxDiffPixelRatio: 0.01,
    animations: 'disabled',
    timeout: SNAPSHOT_TIMEOUT_MS,
  });
}

export async function snapshotLocator(page: Page, locator: Locator, name: string): Promise<void> {
  await revealDeferredContent(page);
  await expect(locator).toHaveScreenshot(name, {
    mask: volatileMasks(page),
    maxDiffPixelRatio: 0.01,
    animations: 'disabled',
    timeout: SNAPSHOT_TIMEOUT_MS,
  });
}
