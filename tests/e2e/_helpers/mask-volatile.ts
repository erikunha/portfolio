// tests/e2e/_helpers/mask-volatile.ts
//
// Returns Playwright Locators covering UI regions that change every render:
//   - CRT scan-beam, flicker, and noise overlays
//   - Shell loading indicator and text cursor
//   - Boot animation lines and cursor
//   - Matrix rain canvas/overlay
//
// Pass the returned array as `mask:` to toHaveScreenshot() or to snapshot().
// Adding a new volatile region: append a locator below using a specific class
// selector — never substring matchers like [class*="now"] (they overmatched
// .unknowns previously). Use data-volatile="<reason>" for new ad-hoc regions
// without coupling tests to incidental class names.

import type { Locator, Page } from '@playwright/test';

export function volatileMasks(page: Page): Locator[] {
  return [
    page.locator(
      '[data-testid="crt-scan-beam"], [data-testid="crt-flicker"], [data-testid="crt-noise"]',
    ),
    page.locator('[data-testid="shell-line-loading"], [data-testid="shell-cursor"]'),
    page.locator('[data-testid="boot-line"], [data-testid="boot-cursor"]'),
    // MatrixRain renders <canvas aria-hidden> with no class name; use the attribute.
    page.locator('canvas[aria-hidden]'),
    // Escape-hatch hook for ad-hoc volatile regions added later (e.g. live
    // counters): mark the element with data-volatile="<reason>" in source.
    page.locator('[data-volatile]'),
  ];
}

/**
 * Strip volatile DOM chrome BEFORE a snapshot. Distinct from volatileMasks():
 * that returns locators for Playwright's `mask:` parameter (paints pink in
 * captured pixels); this mutates the DOM directly.
 *
 * Why DOM mutation is required (not just masking): the fixed-position CRT
 * overlays composite OVER a locator's clip box at the viewport's current
 * scrollY. Playwright's Locator.screenshot() calls scrollIntoViewIfNeeded()
 * before each capture; when the target exceeds viewport height (e.g.
 * chromium-mobile iPhone SE 320x568 -> hero 671px), the page lands at a
 * different scrollY per call and the 4px-stride scanline composites at a
 * different phase. Masking the overlay region inside the locator clip can't
 * fix this because the overlay renders at a DIFFERENT viewport position
 * than the masked element. The MatrixRain canvas similarly resizes during
 * post-hydration reflow producing huge masked-region bbox shifts.
 *
 * All stripped elements are decorative + aria-hidden + outside the
 * assertion surface, so removal does not change asserted behavior.
 */
export async function stripVolatileChrome(page: Page): Promise<void> {
  await page.evaluate(() => {
    for (const c of document.querySelectorAll('canvas[aria-hidden]')) c.remove();
    for (const el of document.querySelectorAll(
      '[data-testid="crt-vignette"],[data-testid="crt-overlay"],[data-testid="crt-mask"],[data-testid="crt-noise"],[data-testid="crt-flicker"],[data-testid="crt-scan-beam"]',
    )) {
      (el as HTMLElement).style.display = 'none';
    }
  });
}
