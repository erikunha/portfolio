import { expect, type Page, test } from '@playwright/test';
import { waitForHydration } from './_helpers/hydration';

const GUTTER_AT_390 = 16;
const GUTTER_AT_1280 = 24;
const MEASURE_PAGE = 1200;
const PAGE_TOP_PHONE = 32;
const SPACE_SECTION_PHONE = 32;
const SPACE_SECTION_TABLET = 48;
const LEADING_TOKENS = ['1.1', '1.35', '1.6'];

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
  { path: '/summary', container: '#main-content' },
  { path: '/cv', container: '#main-content' },
  { path: '/links', container: '.page-container' },
  { path: '/design-system', container: '.page-container' },
  { path: '/this-route-does-not-exist', container: 'main.err-main' },
];

const tokenPx = (page: Page, expression: string) =>
  page.evaluate((value) => {
    const probe = document.createElement('div');
    probe.style.position = 'absolute';
    probe.style.visibility = 'hidden';
    probe.style.paddingTop = value;
    document.body.appendChild(probe);
    const resolved = Number.parseFloat(getComputedStyle(probe).paddingTop);
    probe.remove();
    return resolved;
  }, expression);

const HOME_TOP_EXPRESSION = 'calc(var(--topbar-height) + var(--space-page-top))';

test.describe('layout tokens', () => {
  for (const { path, container } of PAGES) {
    test(`${path} uses the shared gutter and page-top at 390 and 768`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(path);
      await waitForHydration(page, container);
      expect(await contentLeft(page, container)).toBeCloseTo(GUTTER_AT_390, 0);
      expect(await paddingTop(page, container)).toBe(PAGE_TOP_PHONE);

      await page.setViewportSize({ width: 768, height: 1024 });
      const expected = await tokenPx(page, HOME_TOP_EXPRESSION);
      expect(await paddingTop(page, container)).toBe(expected);
    });
  }

  test('the home page clears the fixed topbar by the spacing token', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    expect(await paddingTop(page, '#main-content')).toBe(await tokenPx(page, HOME_TOP_EXPRESSION));
  });

  test('design-system layout clears the fixed topbar by the spacing token at 768', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/design-system');
    expect(await paddingTop(page, '.ds-layout')).toBe(await tokenPx(page, HOME_TOP_EXPRESSION));
  });

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
      const parentBox = await page
        .locator(path === '/links' ? '.page-container' : 'main')
        .first()
        .evaluate((el) => {
          const parent = el.parentElement;
          if (!parent) throw new Error('page measure element has no parent');
          const box = parent.getBoundingClientRect();
          const style = getComputedStyle(parent);
          const padLeft = Number.parseFloat(style.paddingLeft);
          const padRight = Number.parseFloat(style.paddingRight);
          const root = document.documentElement.getBoundingClientRect();
          return {
            left: box.left + padLeft,
            width: box.width - padLeft - padRight,
            parentLeft: box.left,
            parentWidth: box.width,
            rootLeft: root.left,
            rootWidth: root.width,
          };
        });
      expect(parentBox.parentLeft).toBe(parentBox.rootLeft);
      expect(parentBox.parentWidth).toBe(parentBox.rootWidth);
      expect(left).toBeCloseTo(
        parentBox.left + (parentBox.width - MEASURE_PAGE) / 2 + GUTTER_AT_1280,
        0,
      );
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

  test('module margin steps from 32px below 768 to 48px from 768', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    const marginBottom = () =>
      page
        .locator('section:has(> header .module-name)')
        .first()
        .evaluate((el) => getComputedStyle(el).marginBottom);
    expect(await marginBottom()).toBe(`${SPACE_SECTION_PHONE}px`);
    await page.setViewportSize({ width: 768, height: 1024 });
    expect(await marginBottom()).toBe(`${SPACE_SECTION_TABLET}px`);
  });

  test('the root declares a dark colour scheme and a themed thin scrollbar', async ({ page }) => {
    await page.goto('/');
    const root = await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement);
      return {
        colorScheme: style.colorScheme,
        scrollbarColor: style.scrollbarColor,
        scrollbarWidth: style.scrollbarWidth,
      };
    });
    expect(root.colorScheme, 'the page renders its own dark form controls').toBe('dark');
    expect(root.scrollbarWidth, 'the scrollbar stays thin').toBe('thin');
    expect(root.scrollbarColor, 'the scrollbar carries the theme colours').not.toBe('auto');
  });

  test('line-height tokens resolve to the documented ratios', async ({ page }) => {
    await page.goto('/');
    const tokens = await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement);
      return ['--leading-page-tight', '--leading-page-snug', '--leading-body'].map((name) =>
        style.getPropertyValue(name).trim(),
      );
    });
    expect(tokens).toEqual(LEADING_TOKENS);
  });

  test('module headings step from 16px below 768 to 18px from 768, bold caps', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    const heading = page.locator('.module-heading').first();
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
