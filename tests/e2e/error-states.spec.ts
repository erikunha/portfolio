import { errorsContent } from '../../content/errors';
import { SITE_LOCALE } from '../../content/site-locale';
import { WIDTH } from './_helpers/geometry';
import { waitForHydration } from './_helpers/hydration';
import { drainRoutes } from './_helpers/routes';
import { expect, test } from './_helpers/test';

const MISSING_ROUTE = '/this-route-does-not-exist';
const NOT_FOUND_STATUS = 404;
const SUGGESTION_COUNT = errorsContent[SITE_LOCALE.en].notFound.suggestions.length;

test.describe('404 route', { tag: '@cross-browser' }, () => {
  test('answers with status 404 and the r106 content', async ({ page }) => {
    const response = await page.goto(MISSING_ROUTE);
    expect(response?.status()).toBe(NOT_FOUND_STATUS);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('404');
    await expect(page.getByText('[ NOT FOUND ]')).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Suggested pages' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Go home' })).toHaveAttribute('href', '/');
  });

  test('Go home returns to the portfolio', async ({ page }) => {
    await page.goto(MISSING_ROUTE);
    await waitForHydration(page, 'h1');
    await page.getByRole('link', { name: 'Go home' }).click();
    await page.waitForURL('**/');
    await expect(page.locator('[data-testid="hero-name"]').first()).toBeAttached();
  });

  test('puts keyboard focus on the heading', async ({ page }) => {
    await page.goto(MISSING_ROUTE);
    await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  });
  test('suggested pages read as links, not plain text', async ({ page }) => {
    await page.goto(MISSING_ROUTE);
    await waitForHydration(page, 'h1');
    const links = page.getByRole('navigation', { name: 'Suggested pages' }).getByRole('link');
    await expect(links).toHaveCount(SUGGESTION_COUNT);
    for (const link of await links.all()) {
      const decoration = await link.evaluate((el) => getComputedStyle(el).textDecorationLine);
      expect(decoration, 'suggested link is underlined').toContain('underline');
    }
  });
});

test('the 404 heading takes focus for the announcement without painting a ring', {
  tag: '@cross-browser',
}, async ({ page }) => {
  await page.setViewportSize({ width: WIDTH.PHONE_COMPACT, height: 812 });
  await page.goto('/route-that-does-not-exist');
  const heading = page.getByRole('heading', { level: 1 });
  await expect(heading).toBeFocused();
  expect(
    await heading.evaluate((element) => getComputedStyle(element).outlineStyle),
    'a programmatic focus target with tabindex=-1 is not keyboard reachable, so no ring',
  ).toBe('none');
});

const SCROLL_TOLERANCE_PX = 0;
const NARROW_ERROR_VIEWPORTS = [
  { width: WIDTH.PHONE_NARROW, height: 700 },
  { width: WIDTH.PHONE, height: 844 },
  { width: WIDTH.TABLET, height: 1024 },
  { width: WIDTH.DESKTOP, height: 720 },
];

for (const { width, height } of NARROW_ERROR_VIEWPORTS) {
  test(`the 404 page does not scroll when its content fits at ${width}x${height}`, {
    tag: '@cross-browser',
  }, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto(MISSING_ROUTE);
    await waitForHydration(page, 'h1');
    const overflow = await page.evaluate(() => {
      const root = document.scrollingElement ?? document.documentElement;
      return root.scrollHeight - root.clientHeight;
    });
    expect(
      overflow,
      'a min-height that adds chrome the page already reserves makes a short 404 scroll by a pixel or more',
    ).toBeLessThanOrEqual(SCROLL_TOLERANCE_PX);
  });
}

const CONTACT_CHUNK_MARKER = 'contact-send';
const CONTACT_SECTION = '#sec-contact';
const TAP_TARGET_PX = 44;
const DOCUMENT_LOADS_WITH_ONE_RECOVERY = 2;

test.describe('crashed island', { tag: '@cross-browser' }, () => {
  test.afterEach(({ page }) => drainRoutes(page));

  test('reloads once, then keeps a dashed box, explains itself and offers a 44px reload', async ({
    page,
  }) => {
    await page.route('**/_next/static/chunks/**/*.js', async (route) => {
      const response = await route.fetch();
      const body = await response.text();
      if (body.includes(CONTACT_CHUNK_MARKER)) return route.abort();
      return route.fulfill({ response, body });
    });
    let documentLoads = 0;
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) documentLoads += 1;
    });
    await page.goto('/');
    await expect
      .poll(() => documentLoads, {
        message: 'a chunk that fails to load reloads the page once before the fallback stays',
      })
      .toBe(DOCUMENT_LOADS_WITH_ONE_RECOVERY);
    await page.waitForLoadState('load');
    await page.locator(CONTACT_SECTION).scrollIntoViewIfNeeded();
    const fallback = page.locator('.eb-fallback');
    await expect(fallback).toBeVisible();
    await expect(fallback).toHaveAttribute('role', 'alert');
    await expect(fallback).toContainText('! component unavailable');
    expect(await fallback.evaluate((el) => getComputedStyle(el).borderTopStyle)).toBe('dashed');
    const reload = fallback.getByRole('button', { name: '[ RELOAD ]' });
    expect((await reload.boundingBox())?.height).toBeGreaterThanOrEqual(TAP_TARGET_PX);
  });
});
