import type { Locator, Page } from '@playwright/test';

export function volatileMasks(page: Page): Locator[] {
  return [
    page.locator(
      '[data-testid="crt-scan-beam"], [data-testid="crt-flicker"], [data-testid="crt-noise"]',
    ),
    page.locator('[data-testid="shell-line-loading"], [data-testid="shell-cursor"]'),
    page.locator('[data-testid="boot-line"], [data-testid="boot-cursor"]'),
    page.locator('canvas[aria-hidden]'),
    page.locator('[data-volatile]'),
    page.locator('nextjs-portal'),
  ];
}

export async function stripVolatileChrome(page: Page): Promise<void> {
  await page.evaluate(() => {
    for (const c of document.querySelectorAll('canvas[aria-hidden]')) c.remove();
    for (const el of document.querySelectorAll('nextjs-portal')) el.remove();
    for (const el of document.querySelectorAll(
      '[data-testid="crt-vignette"],[data-testid="crt-overlay"],[data-testid="crt-mask"],[data-testid="crt-noise"],[data-testid="crt-flicker"],[data-testid="crt-scan-beam"]',
    )) {
      (el as HTMLElement).style.display = 'none';
    }
  });
}
