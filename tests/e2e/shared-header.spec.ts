import { expect, type Page, test } from '@playwright/test';
import { SITE_LOCALE, type SiteLocale } from '../../content/site-locale';
import { horizontalOverflow, VIEWPORTS } from './_helpers/geometry';
import { waitForHydration } from './_helpers/hydration';

const { DESKTOP, PHONE } = VIEWPORTS;
const NOT_FOUND_STATUS = 404;
const BANNER = 'header';
const SKIP_LINK = 'a.skip-to-content';
const MAIN = 'main#main-content';
const DRAWER_NAV = '#section-nav a';
const OPEN_DRAWER_TIMEOUT_MS = 5000;
const STREAM_SETTLE_TIMEOUT_MS = 10_000;
const OVERFLOW_WIDTHS = [320, 390, 768, 1280];

type RouteSpec = { path: string; status?: number };

const GROUPS: ReadonlyArray<{ locale: SiteLocale; home: string; routes: RouteSpec[] }> = [
  {
    locale: SITE_LOCALE.en,
    home: '/',
    routes: [
      { path: '/cv' },
      { path: '/summary' },
      { path: '/links/en' },
      { path: '/design-system' },
      { path: '/design-system/tokens' },
      { path: '/this-route-does-not-exist', status: NOT_FOUND_STATUS },
    ],
  },
  {
    locale: SITE_LOCALE.pt,
    home: '/pt',
    routes: [
      { path: '/pt/cv' },
      { path: '/pt/summary' },
      { path: '/links' },
      { path: '/pt/rota-que-nao-existe', status: NOT_FOUND_STATUS },
    ],
  },
];

const VIEWPORT_CASES = [
  { name: 'desktop', size: DESKTOP },
  { name: 'phone', size: PHONE },
] as const;

type Control = { tag: string; name: string; href: string | null };

async function headerControls(page: Page): Promise<Control[]> {
  return page
    .getByRole('banner')
    .locator('a, button')
    .evaluateAll((nodes) =>
      nodes.map((node) => ({
        tag: node.tagName,
        name: (node.getAttribute('aria-label') ?? node.textContent ?? '').trim(),
        href: node.closest('[data-lang-switch]') ? null : node.getAttribute('href'),
      })),
    );
}

async function headerBox(page: Page) {
  const box = await page.getByRole('banner').boundingBox();
  if (!box) throw new Error('the banner renders no box');
  return { x: Math.round(box.x), y: Math.round(box.y), height: Math.round(box.height) };
}

async function drawerLinks(page: Page): Promise<Array<{ name: string; href: string | null }>> {
  await page
    .getByRole('banner')
    .getByRole('button', { name: /^(Open menu|Abrir menu)$/ })
    .click();
  await expect(page.locator('#section-drawer')).toHaveClass(/is-open/, {
    timeout: OPEN_DRAWER_TIMEOUT_MS,
  });
  return page.locator(DRAWER_NAV).evaluateAll((nodes) =>
    nodes.map((node) => ({
      name: (node.textContent ?? '').trim(),
      href: node.getAttribute('href'),
    })),
  );
}

for (const { locale, home, routes } of GROUPS) {
  for (const { name: viewportName, size } of VIEWPORT_CASES) {
    test.describe(`${locale} header at ${viewportName}`, () => {
      test.use({ viewport: size });

      for (const { path, status } of routes) {
        test(`${path} renders the same header as ${home}`, async ({ page }) => {
          await page.goto(home);
          await waitForHydration(page, `${BANNER} button`);
          const expectedControls = await headerControls(page);
          const expectedBox = await headerBox(page);
          expect(expectedControls.length, 'the home header lists its controls').toBeGreaterThan(2);

          const response = await page.goto(path);
          if (status) expect(response?.status()).toBe(status);
          await waitForHydration(page, `${BANNER} button`);

          await expect(page.getByRole('banner')).toHaveCount(1);
          await expect(
            page.locator(`${BANNER}.desktop-topbar, ${BANNER}.mobile-title-bar`),
          ).toHaveCount(2);
          await expect(page.locator(SKIP_LINK).first()).toBeAttached();
          await expect(page.locator(MAIN)).toHaveCount(1);
          await expect
            .poll(() => headerControls(page), {
              message: 'ordered controls match the home header',
              timeout: STREAM_SETTLE_TIMEOUT_MS,
            })
            .toEqual(expectedControls);
          expect(await headerBox(page), 'the bar sits where the home bar sits').toEqual(
            expectedBox,
          );
        });

        test(`${path} opens the same drawer as ${home}, linking the home sections`, async ({
          page,
        }) => {
          await page.goto(home);
          await waitForHydration(page, `${BANNER} button`);
          const expected = await drawerLinks(page);
          await page.goto(path);
          await waitForHydration(page, `${BANNER} button`);
          const actual = await drawerLinks(page);

          expect(actual).toEqual(expected);
          const sectionPrefix = locale === SITE_LOCALE.pt ? '/pt#' : '/#';
          expect(actual.some(({ href }) => href?.startsWith(sectionPrefix))).toBe(true);
        });
      }
    });
  }
}

test.describe('the error pages carry the shell', () => {
  for (const path of ['/this-route-does-not-exist', '/pt/rota-que-nao-existe']) {
    for (const width of OVERFLOW_WIDTHS) {
      test(`${path} has no sideways scroll at ${width}`, async ({ page }) => {
        await page.setViewportSize({ width, height: width < 768 ? PHONE.height : DESKTOP.height });
        await page.goto(path);
        expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
      });
    }
  }
});

test('the header is the one banner landmark and the dock menu claims no current location', async ({
  page,
}) => {
  await page.setViewportSize(PHONE);
  await page.goto('/');
  await expect(page.getByRole('banner')).toHaveCount(1);
  await page.locator('#sec-contact').scrollIntoViewIfNeeded();
  await expect(
    page.getByRole('navigation', { name: 'primary' }).getByRole('button', { name: 'MENU' }),
  ).not.toHaveAttribute('aria-current', /.*/);
});

test.describe('the header without JavaScript', () => {
  test.use({ javaScriptEnabled: false, viewport: DESKTOP });

  for (const path of ['/cv', '/pt/summary', '/links', '/links/en', '/design-system']) {
    test(`${path} ships the language switch and the menu trigger in the HTML`, async ({ page }) => {
      await page.goto(path);
      const banner = page.getByRole('banner');
      await expect(banner.locator('[data-lang-switch]:visible')).toHaveCount(1);
      await expect(banner.locator('[data-lang-switch] a')).toHaveCount(2);
      await expect(banner.locator('.menu-trigger')).toBeVisible();
    });
  }

  test('a 404 ships the switch pointing each language home', async ({ page }) => {
    await page.goto('/this-route-does-not-exist');
    const links = page.getByRole('banner').locator('[data-lang-switch] a');
    await expect(links).toHaveCount(2);
    await expect(links.nth(0)).toHaveAttribute('href', '/');
    await expect(links.nth(1)).toHaveAttribute('href', '/pt');
  });
});
