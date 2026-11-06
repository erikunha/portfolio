import { expect, test } from '@playwright/test';
import { SITE_HTML_LANG, SITE_LOCALE, type SiteLocale } from '@/content/site-locale';

const NOT_FOUND_STATUS = 404;

const ROUTES: ReadonlyArray<{ path: string; locale: SiteLocale; status: number }> = [
  { path: '/', locale: SITE_LOCALE.en, status: 200 },
  { path: '/cv', locale: SITE_LOCALE.en, status: 200 },
  { path: '/summary', locale: SITE_LOCALE.en, status: 200 },
  { path: '/design-system', locale: SITE_LOCALE.en, status: 200 },
  { path: '/design-system/primitives/button', locale: SITE_LOCALE.en, status: 200 },
  { path: '/links/en', locale: SITE_LOCALE.en, status: 200 },
  { path: '/page-that-does-not-exist', locale: SITE_LOCALE.en, status: NOT_FOUND_STATUS },
  { path: '/pt', locale: SITE_LOCALE.pt, status: 200 },
  { path: '/pt/cv', locale: SITE_LOCALE.pt, status: 200 },
  { path: '/pt/summary', locale: SITE_LOCALE.pt, status: 200 },
  { path: '/links', locale: SITE_LOCALE.pt, status: 200 },
  { path: '/pt/pagina-que-nao-existe', locale: SITE_LOCALE.pt, status: NOT_FOUND_STATUS },
];

for (const { path, locale, status } of ROUTES) {
  test(`${path} serves <html lang="${SITE_HTML_LANG[locale]}"> with status ${status}`, async ({
    page,
  }) => {
    const response = await page.goto(path);
    expect(response?.status()).toBe(status);
    expect(
      await page.evaluate(() => document.documentElement.lang),
      `the root <html lang> of ${path} must name the language the page is written in, or screen readers pick the wrong voice and browsers offer a wrong translation`,
    ).toBe(SITE_HTML_LANG[locale]);
  });
}

test('the server-sent document carries the locale lang before any script runs', async ({
  request,
}) => {
  for (const { path, locale } of ROUTES.filter((route) => route.status === 200)) {
    const response = await request.get(path);
    const html = await response.text();
    expect(
      html.match(/<html[^>]*>/)?.[0],
      `${path} must send its lang in the first bytes of the document`,
    ).toContain(`lang="${SITE_HTML_LANG[locale]}"`);
  }
});
