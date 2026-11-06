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
