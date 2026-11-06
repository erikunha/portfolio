import { expect, test } from '@playwright/test';
import { errorsContent } from '../../content/errors';
import { SITE_LOCALE } from '../../content/site-locale';

const MISSING_ROUTE = '/this-route-does-not-exist';
const NOT_FOUND_STATUS = 404;
const SUGGESTION_COUNT = errorsContent[SITE_LOCALE.en].notFound.suggestions.length;

test.describe('404 route', () => {
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
    const links = page.getByRole('navigation', { name: 'Suggested pages' }).getByRole('link');
    await expect(links).toHaveCount(SUGGESTION_COUNT);
    for (const link of await links.all()) {
      const decoration = await link.evaluate((el) => getComputedStyle(el).textDecorationLine);
      expect(decoration, 'suggested link is underlined').toContain('underline');
    }
  });
});

test('the 404 heading takes focus for the announcement without painting a ring', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/route-that-does-not-exist');
  const heading = page.getByRole('heading', { level: 1 });
  await expect(heading).toBeFocused();
  expect(
    await heading.evaluate((element) => getComputedStyle(element).outlineStyle),
    'a programmatic focus target with tabindex=-1 is not keyboard reachable, so no ring',
  ).toBe('none');
});

const CONTACT_CHUNK_MARKER = 'contact-send';
const CONTACT_SECTION = '#sec-contact';
const TAP_TARGET_PX = 44;

test.describe('crashed island', () => {
  test('keeps a dashed box, explains itself and offers a 44px reload', async ({ page }) => {
    await page.route('**/_next/static/chunks/**/*.js', async (route) => {
      const response = await route.fetch();
      const body = await response.text();
      if (body.includes(CONTACT_CHUNK_MARKER)) return route.abort();
      return route.fulfill({ response, body });
    });
    await page.goto('/');
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
