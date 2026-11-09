import {
  type Browser,
  type BrowserContextOptions,
  expect,
  type Page,
  test,
} from '@playwright/test';
import { heightOf, settleFrames, VIEWPORTS } from './_helpers/geometry';
import { waitForHydration } from './_helpers/hydration';
import { freezeMotion } from './_helpers/motion';

const { PHONE, TABLET, DESKTOP } = VIEWPORTS;
const SUBPIXEL_PX = 1;
const SCROLL_MARGIN_PX = 100;
const PENDING_DATA = '#sec-live-metrics [aria-busy="true"]';
const ASK_REPLY = 'Short answer.';
const SHELL_INPUT = '[aria-label="shell command"]';
const SHELL_LOADING = '[data-testid="shell-line-loading"]';
const LOCALES = [
  { name: 'en', path: '/', locale: 'en-US', timezoneId: 'Europe/Berlin' },
  { name: 'pt', path: '/pt', locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' },
] as const;
const FIXED_NOW = new Date('2026-11-02T15:00:00Z');
const TIMEZONE_PANEL_VIEWPORTS = [
  VIEWPORTS.PHONE_NARROW,
  PHONE,
  TABLET,
  { width: 1120, height: DESKTOP.height },
  DESKTOP,
] as const;

function contextFor(browser: Browser, baseURL: string | undefined, options: BrowserContextOptions) {
  return browser.newContext({ ...options, ...(baseURL ? { baseURL } : {}) });
}

async function scrollToPanel(page: Page): Promise<void> {
  await page.evaluate(
    (margin) =>
      window.scrollTo(
        0,
        (document.querySelector('.contact-timezone') as HTMLElement).getBoundingClientRect().top +
          window.scrollY -
          margin,
      ),
    SCROLL_MARGIN_PX,
  );
}

test.describe('the interactive shell keeps its height while an answer is pending', () => {
  for (const viewport of [PHONE, TABLET, DESKTOP]) {
    test(`at ${viewport.width}px the section is the same height idle, thinking and answered`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await freezeMotion(page);
      let release: () => void = () => undefined;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      await page.route('**/api/ask', async (route) => {
        await gate;
        await route.fulfill({
          status: 200,
          contentType: 'text/plain; charset=utf-8',
          headers: { 'X-Request-Id': 'layout-stability' },
          body: ASK_REPLY,
        });
      });
      await page.goto('/');
      await page.getByTestId('shell-form').scrollIntoViewIfNeeded();
      await waitForHydration(page, '[data-testid="shell-form"]');
      await settleFrames(page);
      const idle = await heightOf(page, '#sec-shell');

      await page.locator(SHELL_INPUT).fill('who is erik?');
      await page.keyboard.press('Enter');
      await page.waitForSelector(SHELL_LOADING);
      const thinking = await heightOf(page, '#sec-shell');
      await expect(page.getByRole('button', { name: 'Stop answer' })).toBeVisible();

      release();
      await page.waitForSelector(SHELL_LOADING, { state: 'detached' });
      const answered = await heightOf(page, '#sec-shell');

      expect(Math.abs(thinking - idle), `idle ${idle}, thinking ${thinking}`).toBeLessThan(
        SUBPIXEL_PX,
      );
      expect(Math.abs(answered - idle), `idle ${idle}, answered ${answered}`).toBeLessThan(
        SUBPIXEL_PX,
      );
    });
  }
});

test.describe('the measured section keeps its height when its data resolves', () => {
  for (const viewport of [PHONE, TABLET, DESKTOP]) {
    test(`at ${viewport.width}px the loading fallback and the resolved blocks are as tall`, async ({
      browser,
      baseURL,
    }) => {
      const fallback = await contextFor(browser, baseURL, { viewport, javaScriptEnabled: false });
      const fallbackPage = await fallback.newPage();
      await fallbackPage.goto('/');
      const loading = await heightOf(fallbackPage, '#sec-live-metrics');
      await fallback.close();

      const live = await contextFor(browser, baseURL, { viewport });
      await freezeMotion(live);
      const livePage = await live.newPage();
      await livePage.goto('/');
      await expect(livePage.locator(PENDING_DATA)).toHaveCount(0);
      await settleFrames(livePage);
      const resolved = await heightOf(livePage, '#sec-live-metrics');
      await live.close();

      expect(Math.abs(resolved - loading), `loading ${loading}, resolved ${resolved}`).toBeLessThan(
        SUBPIXEL_PX,
      );
    });
  }
});

test.describe('the timezone panel keeps its height when the live panel mounts', () => {
  for (const { name, path, locale, timezoneId } of LOCALES) {
    for (const viewport of TIMEZONE_PANEL_VIEWPORTS) {
      test(`${name} at ${viewport.width}px: static and live panel are as tall`, async ({
        browser,
        baseURL,
      }) => {
        const fallback = await contextFor(browser, baseURL, {
          viewport,
          locale,
          timezoneId,
          javaScriptEnabled: false,
        });
        const fallbackPage = await fallback.newPage();
        await fallbackPage.goto(path);
        const before = await heightOf(fallbackPage, '.ctz-host');
        await fallback.close();

        const live = await contextFor(browser, baseURL, {
          viewport,
          locale,
          timezoneId,
        });
        await freezeMotion(live);
        const livePage = await live.newPage();
        await livePage.clock.setFixedTime(FIXED_NOW);
        await livePage.goto(path);
        await scrollToPanel(livePage);
        await expect(livePage.getByTestId('contact-timezone')).toBeVisible();
        await settleFrames(livePage);
        const after = await heightOf(livePage, '.ctz-host');
        await live.close();

        expect(Math.abs(after - before), `static ${before}, live ${after}`).toBeLessThan(
          SUBPIXEL_PX,
        );
      });
    }
  }
});
