import { expect, test } from '@playwright/test';
import { DS_ROUTES } from '@/app/(en)/design-system/_components/ds-nav';
import { VIEWPORTS } from './_helpers/geometry';
import { scrollThroughPage, translucentSurfaces } from './_helpers/surfaces';

const MAIN_SELECTOR = '#main-content';

const SURFACE_VIEWPORTS = [
  { name: 'desktop', size: VIEWPORTS.DESKTOP },
  { name: 'phone', size: VIEWPORTS.PHONE },
] as const;

const READING_AND_LINK_ROUTES = [
  '/cv',
  '/pt/cv',
  '/summary',
  '/pt/summary',
  '/links',
  '/links/en',
] as const;
const NOT_FOUND_ROUTES = ['/this-route-does-not-exist', '/pt/this-route-does-not-exist'] as const;
const HOME_ROUTES = ['/', '/pt'] as const;

const ROUTES = [
  ...HOME_ROUTES,
  ...READING_AND_LINK_ROUTES,
  ...NOT_FOUND_ROUTES,
  ...DS_ROUTES,
] as const;

test.describe('route surfaces are opaque', () => {
  for (const { name, size } of SURFACE_VIEWPORTS) {
    test.describe(`${name} viewport`, () => {
      for (const route of ROUTES) {
        test(`${route} panels, cards and chips sit on an opaque backing`, async ({ page }) => {
          await page.setViewportSize(size);
          await page.goto(route);
          await scrollThroughPage(page);
          const offenders = await translucentSurfaces(page, MAIN_SELECTOR);
          expect(offenders, `${route} has a main region`).not.toBeNull();
          expect(
            offenders,
            `Matrix Rain shows through ${route}: every bordered or tinted surface needs an opaque background on itself or an ancestor inside main`,
          ).toEqual([]);
        });
      }
    });
  }
});

test('a hovered /links playlist card stays opaque', async ({ page }) => {
  await page.setViewportSize(VIEWPORTS.DESKTOP);
  await page.goto('/links');
  await scrollThroughPage(page);
  const cards = page.locator('[data-col="playlists"] a');
  const count = await cards.count();
  expect(count, '/links renders playlist cards').toBeGreaterThan(0);
  for (let index = 0; index < count; index += 1) {
    await cards.nth(index).hover();
    const offenders = await translucentSurfaces(page, MAIN_SELECTOR);
    expect(
      offenders,
      'a hover tint that replaces the black background lets the Matrix Rain through the card',
    ).toEqual([]);
  }
});
