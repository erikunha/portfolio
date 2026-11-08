import { expect, type Page, test } from '@playwright/test';
import { SITE_LOCALE, type SiteLocale } from '../../content/site-locale';
import { horizontalOverflow, VIEWPORTS } from './_helpers/geometry';
import { waitForHydration } from './_helpers/hydration';
import { gotoSettled } from './_helpers/streamed';

const { DESKTOP, PHONE } = VIEWPORTS;
const NOT_FOUND_STATUS = 404;
const BANNER = 'header';
const SKIP_LINK = 'a.skip-to-content';
const MAIN = 'main#main-content';
const DRAWER_NAV = '#section-nav a';
const OPEN_DRAWER_TIMEOUT_MS = 5000;
const STREAM_SETTLE_TIMEOUT_MS = 10_000;
const OVERFLOW_WIDTHS = [320, 390, 768, 1280];
const MIN_GAP_BELOW_HEADER = { desktop: 48, phone: 32 } as const;
const CENTER_TOLERANCE_PX = 2;
const VERTICAL_CENTER_TOLERANCE_PX = 24;
const CONTENT_ROUTES = [
  '/',
  '/pt',
  '/cv',
  '/summary',
  '/links/en',
  '/links',
  '/design-system',
  '/design-system/tokens',
  '/this-route-does-not-exist',
  '/pt/rota-que-nao-existe',
];
const NOT_FOUND_ROUTES = ['/this-route-does-not-exist', '/pt/rota-que-nao-existe'];

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
          await gotoSettled(page, home);
          await waitForHydration(page, `${BANNER} button`);
          const expectedControls = await headerControls(page);
          const expectedBox = await headerBox(page);
          expect(expectedControls.length, 'the home header lists its controls').toBeGreaterThan(2);

          const response = await gotoSettled(page, path);
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
          await gotoSettled(page, home);
          await waitForHydration(page, `${BANNER} button`);
          const expected = await drawerLinks(page);
          await gotoSettled(page, path);
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
        await gotoSettled(page, path);
        expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
      });
    }
  }
});

test('the header is the one banner landmark and the dock menu claims no current location', async ({
  page,
}) => {
  await page.setViewportSize(PHONE);
  await gotoSettled(page, '/');
  await expect(page.getByRole('banner')).toHaveCount(1);
  await page.locator('#sec-contact').scrollIntoViewIfNeeded();
  await expect(
    page.getByRole('navigation', { name: 'primary' }).getByRole('button', { name: 'MENU' }),
  ).not.toHaveAttribute('aria-current', /.*/);
});

test.describe('the header without JavaScript', () => {
  test.use({ javaScriptEnabled: false, viewport: DESKTOP });

  const LANGUAGE_HREFS: ReadonlyArray<readonly [string, [string, string]]> = [
    ['/cv', ['/cv', '/pt/cv']],
    ['/pt/summary', ['/summary', '/pt/summary']],
    ['/links', ['/links/en', '/links']],
    ['/links/en', ['/links/en', '/links']],
    ['/design-system', ['/design-system', '/pt']],
  ];

  for (const [path, hrefs] of LANGUAGE_HREFS) {
    test(`${path} ships the language switch and the menu trigger in the HTML`, async ({ page }) => {
      await page.goto(path);
      const banner = page.getByRole('banner');
      await expect(banner.locator('[data-lang-switch]:visible')).toHaveCount(1);
      const links = banner.locator('[data-lang-switch]:visible a');
      await expect(links).toHaveCount(2);
      await expect(links.nth(0)).toHaveAttribute('href', hrefs[0]);
      await expect(links.nth(1)).toHaveAttribute('href', hrefs[1]);
      await expect(banner.locator('.menu-trigger')).toBeVisible();
    });
  }

  for (const path of ['/links', '/links/en']) {
    test(`${path} ships its own topbar link as the current one in the HTML`, async ({ page }) => {
      await page.goto(path);
      const current = page.locator('header a.topbar-link[aria-current="page"]');
      await expect(current).toHaveCount(1);
      await expect(current).toHaveAttribute('href', path);
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

test.describe('the first content block clears the header', () => {
  for (const { name, size } of VIEWPORT_CASES) {
    test.describe(`at ${name}`, () => {
      test.use({ viewport: size });

      for (const path of CONTENT_ROUTES) {
        test(`${path} starts at least the named gap below the header`, async ({ page }) => {
          await gotoSettled(page, path);
          await waitForHydration(page, `${BANNER} button`);
          const gap = await page.evaluate(() => {
            const bars = [
              ...document.querySelectorAll('header.desktop-topbar, header.mobile-title-bar'),
            ]
              .map((node) => node.getBoundingClientRect())
              .filter((box) => box.height > 0);
            const barBottom = Math.max(...bars.map((box) => box.bottom));
            const hero = document.querySelector(
              '[data-testid="hero-desktop"], [data-testid="hero-mobile"]',
            );
            const heading = [...document.querySelectorAll('main h1, main h2, main h3')].find(
              (node) => node.getBoundingClientRect().height > 2,
            );
            const first = [hero, heading].find(
              (node) => node && node.getBoundingClientRect().height > 2,
            );
            if (!first) throw new Error('no visible first content block');
            return first.getBoundingClientRect().top - barBottom;
          });
          expect(gap).toBeGreaterThanOrEqual(MIN_GAP_BELOW_HEADER[name]);
        });
      }
    });
  }
});

test.describe('the 404 content is centered', () => {
  for (const { name, size } of VIEWPORT_CASES) {
    for (const path of NOT_FOUND_ROUTES) {
      test(`${path} centers the heading, the button and the block at ${name}`, async ({ page }) => {
        await page.setViewportSize(size);
        await gotoSettled(page, path);
        await waitForHydration(page, `${BANNER} button`);
        const geometry = await page.evaluate(() => {
          const rect = (selector: string) => {
            const node = document.querySelector(selector);
            if (!node) throw new Error(`missing ${selector}`);
            return node.getBoundingClientRect();
          };
          const heading = rect('main h1');
          const action = rect('.err-actions a');
          const bars = [
            ...document.querySelectorAll('header.desktop-topbar, header.mobile-title-bar'),
          ]
            .map((node) => node.getBoundingClientRect())
            .filter((box) => box.height > 0);
          const dock = document.querySelector('.dock')?.getBoundingClientRect();
          const dockVisible = dock && dock.height > 0 ? dock.top : window.innerHeight;
          return {
            viewportCenter: (() => {
              const root = document.documentElement.getBoundingClientRect();
              return root.left + root.width / 2;
            })(),
            headingCenter: heading.left + heading.width / 2,
            actionCenter: action.left + action.width / 2,
            contentCenter: (heading.top + action.bottom) / 2,
            areaCenter: (Math.max(...bars.map((box) => box.bottom)) + dockVisible) / 2,
          };
        });
        expect(Math.abs(geometry.headingCenter - geometry.viewportCenter)).toBeLessThanOrEqual(
          CENTER_TOLERANCE_PX,
        );
        expect(Math.abs(geometry.actionCenter - geometry.viewportCenter)).toBeLessThanOrEqual(
          CENTER_TOLERANCE_PX,
        );
        expect(Math.abs(geometry.contentCenter - geometry.areaCenter)).toBeLessThanOrEqual(
          VERTICAL_CENTER_TOLERANCE_PX,
        );
      });
    }
  }
});
