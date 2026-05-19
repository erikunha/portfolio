// tests/e2e/_helpers/mask-volatile.ts
//
// Returns Playwright Locators covering UI regions that change every render:
//   - CRT scan-beam, flicker, and noise overlays
//   - Shell loading indicator and text cursor
//   - Boot animation lines and cursor
//   - Timestamp + "now" displays
//   - Matrix rain canvas/overlay
//
// Pass the returned array as `mask:` to toHaveScreenshot() or to snapshot().
// Adding a new volatile region: append a locator below; no other file changes needed.

import type { Locator, Page } from '@playwright/test';

export function volatileMasks(page: Page): Locator[] {
  return [
    page.locator('.crt-scan-beam, .crt-flicker, .crt-noise'),
    page.locator('.shell__line--loading, .shell__cursor'),
    page.locator('.boot__line, .boot__cursor'),
    page.locator('[class*="timestamp"], [class*="now"]'),
    // MatrixRain renders <canvas aria-hidden> with no class name; use the attribute.
    page.locator('canvas[aria-hidden]'),
  ];
}
