// tests/e2e/_helpers/snapshot.ts
//
// Thin wrapper around toHaveScreenshot() that enforces project-wide visual
// regression policy: 1% pixel-ratio threshold, volatile regions masked, all
// CSS animations frozen before capture.
//
// Usage:
//   await snapshot(page, 'hero-above-fold.png');
//
// Name must be unique within the spec file. Playwright namespaces baselines
// by browser project automatically, so the same name produces separate
// baselines for chromium-desktop vs webkit-mobile.

import { expect, type Page } from '@playwright/test';
import { volatileMasks } from './mask-volatile';

export async function snapshot(page: Page, name: string): Promise<void> {
  await expect(page).toHaveScreenshot(name, {
    mask: volatileMasks(page),
    maxDiffPixelRatio: 0.01,
    animations: 'disabled',
  });
}
