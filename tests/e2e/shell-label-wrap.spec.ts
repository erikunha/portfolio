import { expect, type Page, test } from '@playwright/test';
import { SITE_LOCALE, type SiteLocale } from '../../content/site-locale';
import { installMockBackend } from './_helpers/mock-backend';
import { freezeMotion } from './_helpers/motion';
import { askShell, openShell, SHELL_SELECTOR, waitForConfirmArmed } from './_helpers/shell';

const WIDTHS = [320, 375, 390, 768, 1280] as const;
const VIEWPORT_HEIGHT = 844;
const TABLET_WIDTH = 768;
const PATHS: Record<SiteLocale, string> = { [SITE_LOCALE.en]: '/', [SITE_LOCALE.pt]: '/pt' };
const QUESTION = 'are you there?';
const SUBPIXEL_PX = 1;
const RECEIPT = '[data-testid="shell-receipt"]';

type LabelFit = { label: string; lines: number; overflow: number };

function labelFits(page: Page): Promise<LabelFit[]> {
  return page.evaluate((scope) => {
    const controls = [
      ...document.querySelectorAll(`${scope} button, .shell-stop-pill, .shell-line button`),
    ];
    return controls
      .filter((control) => control.getClientRects().length > 0)
      .map((control) => {
        const label = control.querySelector('[data-current]') ?? control;
        const walker = document.createTreeWalker(label, NodeFilter.SHOW_TEXT);
        const rects: DOMRect[] = [];
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          if (!(node.textContent ?? '').trim()) continue;
          const range = document.createRange();
          range.selectNodeContents(node);
          rects.push(...[...range.getClientRects()].filter((rect) => rect.width > 0));
        }
        const box = control.getBoundingClientRect();
        return {
          label: label.textContent?.trim() ?? '',
          lines: new Set(rects.map((rect) => Math.round(rect.top))).size,
          overflow: Math.max(0, ...rects.map((rect) => rect.right - box.right)),
        };
      });
  }, RECEIPT);
}

async function expectOneLineLabels(page: Page, state: string) {
  const fits = await labelFits(page);
  expect(fits.length, `${state}: no control was measured`).toBeGreaterThan(0);
  for (const fit of fits) {
    expect(fit.lines, `${state}: "${fit.label}" wraps`).toBe(1);
    expect(fit.overflow, `${state}: "${fit.label}" leaves its button`).toBeLessThanOrEqual(
      SUBPIXEL_PX,
    );
  }
  const sideways = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(sideways, `${state}: the page scrolls sideways`).toBeLessThanOrEqual(0);
}

for (const width of WIDTHS) {
  for (const locale of Object.values(SITE_LOCALE)) {
    test.describe(`shell control labels at ${width}px (${locale})`, () => {
      const touch = width < TABLET_WIDTH;
      test.use({
        viewport: { width, height: VIEWPORT_HEIGHT },
        isMobile: touch,
        hasTouch: touch,
      });

      test.beforeEach(async ({ page }) => {
        await freezeMotion(page);
      });

      test('the receipt buttons keep one line through idle, confirm, pending and retry', async ({
        page,
      }) => {
        await installMockBackend(page, { ask: 'happy', forget: 'storage-unavailable', locale });
        await openShell(page, PATHS[locale]);
        await askShell(page, QUESTION);
        const secondary = page.getByTestId('shell-receipt-secondary');
        await expect(secondary).toBeVisible();
        await expectOneLineLabels(page, 'idle');
        await secondary.click();
        await expect(page.getByTestId('shell-receipt')).toHaveAttribute('data-state', 'confirm');
        await expectOneLineLabels(page, 'confirm');
        await waitForConfirmArmed(page);
        await secondary.click();
        await expect(page.getByTestId('shell-receipt')).toHaveAttribute(
          'data-state',
          'unavailable',
        );
        await expectOneLineLabels(page, 'unavailable');
      });

      test('the receipt buttons keep one line while the forget wait counts down', async ({
        page,
      }) => {
        await installMockBackend(page, { ask: 'happy', forget: 'rate-limit', locale });
        await openShell(page, PATHS[locale]);
        await askShell(page, QUESTION);
        const secondary = page.getByTestId('shell-receipt-secondary');
        await secondary.click();
        await waitForConfirmArmed(page);
        await secondary.click();
        await expect(page.getByTestId('shell-receipt')).toHaveAttribute('data-state', 'waiting');
        await expectOneLineLabels(page, 'waiting');
      });

      test('the controls keep one line while an answer is pending', async ({ page }) => {
        await installMockBackend(page, { ask: 'happy', locale });
        await openShell(page, PATHS[locale]);
        await askShell(page, QUESTION);
        await expect(page.getByTestId('shell-receipt')).toBeVisible();
        await page.unroute('**/api/ask');
        await page.route('**/api/ask', () => new Promise(() => undefined));
        await askShell(page, 'and now?');
        await expect(page.locator(SHELL_SELECTOR.stopPill)).toBeVisible();
        await expectOneLineLabels(page, 'pending');
      });
    });
  }
}
