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
  for (const { path, locale } of ROUTES) {
    const response = await request.get(path);
    const html = await response.text();
    expect(
      html.match(/<html[^>]*>/)?.[0],
      `${path} must send its lang in the first bytes of the document`,
    ).toContain(`lang="${SITE_HTML_LANG[locale]}"`);
  }
});

test('an unknown URL sends the 404 page itself, not an empty shell the browser fills in later', async ({
  request,
}) => {
  for (const { path } of ROUTES.filter((route) => route.status === NOT_FOUND_STATUS)) {
    const response = await request.get(path);
    const html = await response.text();
    expect(response.status()).toBe(NOT_FOUND_STATUS);
    expect(
      html,
      `${path} must carry its 404 heading in the first bytes, or a visitor without scripts, a link preview and a screen reader before hydration meet a blank page`,
    ).toMatch(/<h1[^>]*>404<\/h1>/);
    expect(html, `${path} must not ship Next's empty error shell`).not.toContain(
      '<html id="__next_error__"',
    );
    expect(
      html,
      `${path} must not point its canonical at a page it is not, and must say noindex`,
    ).not.toContain('rel="canonical"');
    expect(html).toContain('name="robots" content="noindex"');
    expect(html).not.toContain('content="index, follow"');
  }
});
