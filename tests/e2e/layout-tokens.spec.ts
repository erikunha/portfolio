import { expect, type Page, test } from '@playwright/test';

const GUTTER_AT_390 = 16;
const GUTTER_AT_1280 = 24;
const MEASURE_PAGE = 1200;
const PAGE_TOP_PHONE = 24;
const PAGE_TOP_TABLET = 48;

const contentLeft = (page: Page, selector: string) =>
  page
    .locator(selector)
    .first()
    .evaluate((el) => {
      const style = getComputedStyle(el);
      return el.getBoundingClientRect().left + Number.parseFloat(style.paddingLeft);
    });

const paddingTop = (page: Page, selector: string) =>
  page
    .locator(selector)
    .first()
    .evaluate((el) => Number.parseFloat(getComputedStyle(el).paddingTop));

const PAGES = [
  { path: '/', container: '#main-content' },
  { path: '/summary', container: 'main.reading-doc' },
  { path: '/cv', container: 'main.reading-doc' },
  { path: '/links', container: '.page-container' },
  { path: '/this-route-does-not-exist', container: 'main.err-main' },
];

test.describe('layout tokens', () => {
  for (const { path, container } of PAGES) {
    test(`${path} uses the shared gutter and page-top at 390 and 768`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(path);
      expect(await contentLeft(page, container)).toBeCloseTo(GUTTER_AT_390, 0);
      expect(await paddingTop(page, container)).toBe(PAGE_TOP_PHONE);

      await page.setViewportSize({ width: 768, height: 1024 });
      expect(await paddingTop(page, container)).toBe(PAGE_TOP_TABLET);
    });
  }

  for (const path of ['/', '/summary', '/links']) {
    test(`${path} content spans the page measure at 1280`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(path);
      const width = await page
        .locator(path === '/links' ? '.page-container' : 'main')
        .first()
        .evaluate((el) => el.getBoundingClientRect().width);
      expect(width).toBe(MEASURE_PAGE);
      const left = await contentLeft(page, path === '/links' ? '.page-container' : 'main');
      expect(left).toBeCloseTo((1280 - MEASURE_PAGE) / 2 + GUTTER_AT_1280, 0);
    });
  }

  test('exactly 768 gets one rule set: desktop hero, one-column About until 1024', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    await expect(page.locator('.hero-desktop').first()).toBeVisible();
    await expect(page.locator('.hero-mobile').first()).toBeHidden();
    const columns = () =>
      page
        .locator('.about-grid')
        .first()
        .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
    expect(await columns()).toBe(1);
    await page.setViewportSize({ width: 1024, height: 800 });
    expect(await columns()).toBe(2);
  });

  test('module headings step from 16px below 768 to 18px from 768, bold caps', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    const heading = page.locator('section > header h2:has(.module-name)').first();
    const read = () =>
      heading.evaluate((el) => {
        const s = getComputedStyle(el);
        return { size: s.fontSize, weight: s.fontWeight, transform: s.textTransform };
      });
    expect(await read()).toEqual({ size: '16px', weight: '700', transform: 'uppercase' });
    await page.setViewportSize({ width: 768, height: 1024 });
    expect((await read()).size).toBe('18px');
  });
});
