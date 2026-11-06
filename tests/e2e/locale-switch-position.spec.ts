import { expect, type Page, test } from '@playwright/test';

const SECTION = 'sec-projects';
const VIEWPORTS = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'desktop', width: 1280, height: 720 },
] as const;
const TOP_BAND_PX = 260;
const LOAD_SCROLL_TIMEOUT_MS = 20_000;
const SWITCH = '[data-lang-switch]:visible';

const target = (page: Page, locale: 'en' | 'pt') =>
  page.locator(`${SWITCH} a[hreflang="${locale}"]`).first();

for (const viewport of VIEWPORTS) {
  test.describe(`language switch keeps the section at ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test('en to pt lands on the same section', async ({ page }) => {
      await page.goto(`/#${SECTION}`);
      await expect(target(page, 'pt')).toHaveAttribute('href', `/pt#${SECTION}`);

      await target(page, 'pt').click();

      await expect(page).toHaveURL(new RegExp(`/pt#${SECTION}$`));
      await expect
        .poll(
          () => page.locator(`#${SECTION}`).evaluate((node) => node.getBoundingClientRect().top),
          {
            message: 'the section lands near the top of the viewport, not at the page top',
            timeout: LOAD_SCROLL_TIMEOUT_MS,
          },
        )
        .toBeLessThan(TOP_BAND_PX);
      expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    });

    test('pt to en lands on the same section', async ({ page }) => {
      await page.goto(`/pt#${SECTION}`);
      await expect(target(page, 'en')).toHaveAttribute('href', `/#${SECTION}`);

      await target(page, 'en').click();

      await expect(page).toHaveURL(new RegExp(`/#${SECTION}$`));
      await expect
        .poll(() => page.evaluate(() => window.scrollY), { timeout: LOAD_SCROLL_TIMEOUT_MS })
        .toBeGreaterThan(0);
    });

    test('follows the section the reader scrolled to, not only the address', async ({ page }) => {
      await page.goto('/');
      await page.locator(`#${SECTION}`).scrollIntoViewIfNeeded();
      await page.evaluate(
        (id) =>
          window.scrollTo(
            0,
            (document.getElementById(id) as HTMLElement).getBoundingClientRect().top +
              window.scrollY -
              100,
          ),
        SECTION,
      );

      await expect(target(page, 'pt')).toHaveAttribute('href', `/pt#${SECTION}`);
    });

    test('at the top of the page the switch stays a plain page link', async ({ page }) => {
      await page.goto('/');

      await expect(target(page, 'pt')).toHaveAttribute('href', '/pt');
    });
  });
}

test.describe('language switch without JavaScript', () => {
  test.use({ javaScriptEnabled: false, viewport: { width: 1280, height: 720 } });

  test('stays a working link to the other home page', async ({ page }) => {
    await page.goto(`/#${SECTION}`);
    await expect(target(page, 'pt')).toHaveAttribute('href', '/pt');

    await target(page, 'pt').click();

    await expect(page).toHaveURL(/\/pt$/);
  });
});

test.describe('language switch on pages that own their switch', () => {
  test('the CV switch is never given a section hash', async ({ page }) => {
    await page.goto('/cv');

    await expect(page.locator('nav[aria-label="Language"] a[hreflang="pt"]')).toHaveAttribute(
      'href',
      '/pt/cv',
    );
  });
});
