import { expect, type Page, test } from '@playwright/test';
import { serverErrorCore } from '@/content/server-error-core';
import { SITE_HTML_LANG, SITE_LOCALE, type SiteLocale } from '@/content/site-locale';
import { horizontalOverflow, VIEWPORTS } from './_helpers/geometry';
import { CRASH_SURFACE, type CrashSurface, crashOnce } from './_helpers/injected-crash';
import { installMockBackend } from './_helpers/mock-backend';
import { freezeMotion } from './_helpers/motion';

const HOME_PATHS: Record<SiteLocale, string> = { en: '/', pt: '/pt' };
const SURFACES: readonly CrashSurface[] = Object.values(CRASH_SURFACE);
const WIDTHS = [VIEWPORTS.PHONE_NARROW, VIEWPORTS.PHONE] as const;
const RECOVERED_MARKER = '[data-testid="hero-name"]';
const SHELL_CHROME = '.app-content';

async function openCrashed(page: Page, surface: CrashSurface, path: string): Promise<void> {
  await installMockBackend(page, { log: 'accept' });
  await freezeMotion(page);
  await crashOnce(page, surface);
  await page.goto(path);
}

for (const surface of SURFACES) {
  for (const locale of Object.values(SITE_LOCALE)) {
    const core = serverErrorCore[locale];

    test.describe(`${surface} error boundary, ${locale}`, () => {
      test('names the failure, focuses the heading and offers both exits', async ({ page }) => {
        await openCrashed(page, surface, HOME_PATHS[locale]);

        const heading = page.getByRole('heading', { level: 1, name: core.code });
        await expect(heading).toBeVisible();
        await expect(heading).toBeFocused();
        await expect(page.getByRole('alert').filter({ hasText: core.message })).toBeVisible();
        await expect(page.getByRole('button', { name: core.retryLabel })).toBeVisible();
        await expect(page.getByRole('link', { name: core.home.label })).toHaveAttribute(
          'href',
          core.home.href,
        );
      });

      test(`renders inside ${surface === CRASH_SURFACE.route ? 'the page shell' : 'its own document'} in ${SITE_HTML_LANG[locale]}`, async ({
        page,
      }) => {
        await openCrashed(page, surface, HOME_PATHS[locale]);
        await expect(page.getByRole('heading', { level: 1, name: core.code })).toBeVisible();

        expect(await page.evaluate(() => document.documentElement.lang)).toBe(
          SITE_HTML_LANG[locale],
        );
        await expect(page.locator(SHELL_CHROME)).toHaveCount(
          surface === CRASH_SURFACE.route ? 1 : 0,
        );
      });

      test('the retry button recovers the page', async ({ page }) => {
        await openCrashed(page, surface, HOME_PATHS[locale]);
        await page.getByRole('button', { name: core.retryLabel }).click();

        await expect(page.getByRole('heading', { level: 1, name: core.code })).toHaveCount(0);
        await expect(page.locator(RECOVERED_MARKER).first()).toBeAttached();
        await expect(page.getByRole('alert').filter({ hasText: core.message })).toHaveCount(0);
      });

      for (const viewport of WIDTHS) {
        test(`does not scroll sideways at ${viewport.width}px`, async ({ page }) => {
          await page.setViewportSize(viewport);
          await openCrashed(page, surface, HOME_PATHS[locale]);
          await expect(page.getByRole('heading', { level: 1, name: core.code })).toBeVisible();

          expect(
            await horizontalOverflow(page),
            'the 500 panel must fit the narrowest phone without a sideways scroll',
          ).toBeLessThanOrEqual(0);
        });
      }
    });
  }
}
