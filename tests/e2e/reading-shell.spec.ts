import { expect, type Page, test } from '@playwright/test';
import { READING_PATHS, readingViews } from '../../content/reading-views';
import { SITE_LOCALE } from '../../content/site-locale';

const DESKTOP = { width: 1280, height: 800 };
const PHONE = { width: 390, height: 844 };
const CENTER_TOLERANCE_PX = 1;
const MAX_PRINT_PAGES = {
  summary: { '': 1, '/pt': 1 },
  cv: { '': 7, '/pt': 7 },
} as const;
const PDF_PAGE_PATTERN = /\/Type\s*\/Page[^s]/g;
const MAIN = 'main#main-content';

const PAIRS = [
  { path: READING_PATHS.summary, home: '/', locale: SITE_LOCALE.en },
  { path: READING_PATHS.cv, home: '/', locale: SITE_LOCALE.en },
  { path: `/pt${READING_PATHS.summary}`, home: '/pt', locale: SITE_LOCALE.pt },
  { path: `/pt${READING_PATHS.cv}`, home: '/pt', locale: SITE_LOCALE.pt },
];

type Box = { name: string; x: number; y: number; width: number; height: number };

async function headerFingerprint(page: Page, selector: string) {
  return page.locator(selector).evaluate((bar) => {
    const strip = (node: Element) => {
      const clone = node.cloneNode(true) as Element;
      for (const marked of clone.querySelectorAll('[aria-current]')) {
        marked.removeAttribute('aria-current');
      }
      for (const link of clone.querySelectorAll('[data-lang-switch] a')) {
        link.setAttribute('href', link.getAttribute('hreflang') ?? '');
      }
      return clone.outerHTML.replace(/\s+/g, ' ');
    };
    const boxes: Box[] = Array.from(bar.querySelectorAll('a, button')).map((control) => {
      const rect = control.getBoundingClientRect();
      return {
        name: control.getAttribute('aria-label') ?? control.textContent?.trim() ?? '',
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      };
    });
    return { html: strip(bar), boxes };
  });
}

test.describe('reading views share the home header', () => {
  for (const { path, home } of PAIRS) {
    test(`${path} renders the home topbar at 1280`, async ({ page }) => {
      await page.setViewportSize(DESKTOP);
      await page.goto(home);
      const expected = await headerFingerprint(page, '.desktop-topbar');
      await page.goto(path);
      await expect(page.locator('.desktop-topbar')).toBeVisible();
      const actual = await headerFingerprint(page, '.desktop-topbar');
      expect(actual.boxes.map((box) => box.name)).toEqual(expected.boxes.map((box) => box.name));
      expect(actual.boxes).toEqual(expected.boxes);
      expect(actual.html).toBe(expected.html);
      await expect(page.locator('.reading-bar')).toHaveCount(0);
    });

    test(`${path} renders the home title bar at 390 with the switch centered`, async ({ page }) => {
      await page.setViewportSize(PHONE);
      await page.goto(home);
      const expected = await headerFingerprint(page, '.mobile-title-bar');
      await page.goto(path);
      const bar = page.locator('.mobile-title-bar');
      await expect(bar).toBeVisible();
      const actual = await headerFingerprint(page, '.mobile-title-bar');
      expect(actual.boxes).toEqual(expected.boxes);
      expect(actual.html).toBe(expected.html);
      const toggle = bar.locator('[data-lang-switch]');
      const [barBox, switchBox] = await Promise.all([bar.boundingBox(), toggle.boundingBox()]);
      if (!barBox || !switchBox) throw new Error('the bar and the switch must both render a box');
      expect(
        Math.abs(switchBox.x + switchBox.width / 2 - (barBox.x + barBox.width / 2)),
      ).toBeLessThanOrEqual(CENTER_TOLERANCE_PX);
      await expect(page.getByRole('navigation', { name: /primary|principal/ })).toBeVisible();
    });

    test(`${path} header pixels match the home header`, async ({ page }) => {
      for (const viewport of [DESKTOP, PHONE]) {
        await page.setViewportSize(viewport);
        const selector = viewport === DESKTOP ? '.desktop-topbar' : '.mobile-title-bar';
        const capture = async (url: string) => {
          await page.goto(url);
          const bar = page.locator(selector);
          await expect(bar).toBeVisible();
          return bar.screenshot({ animations: 'disabled', caret: 'hide' });
        };
        const expected = await capture(home);
        const actual = await capture(path);
        expect(actual.equals(expected), `${selector} at ${viewport.width}`).toBe(true);
      }
    });

    test(`${path} has one h1, one main, one skip link and one banner`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      await expect(page.locator(MAIN)).toHaveCount(1);
      await expect(page.locator('a.skip-to-content')).toHaveCount(1);
      await expect(page.getByRole('banner')).toHaveCount(1);
    });
  }

  test('the skip link is the first tab stop and moves focus to the main landmark', async ({
    page,
  }) => {
    await page.goto(READING_PATHS.summary);
    await page.keyboard.press('Tab');
    const skip = page.locator('a.skip-to-content');
    await expect(skip).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator(MAIN)).toBeFocused();
  });

  test('the language switch in the header swaps between the two languages', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto(READING_PATHS.cv);
    const bar = page.locator('.desktop-topbar [data-lang-switch]');
    await expect(bar.locator('a[aria-current="page"]')).toHaveAttribute('href', READING_PATHS.cv);
    await bar.locator(`a[href="/pt${READING_PATHS.cv}"]`).click();
    await page.waitForURL(`**/pt${READING_PATHS.cv}`);
    await expect(
      page.locator('.desktop-topbar [data-lang-switch] a[aria-current="page"]'),
    ).toHaveAttribute('href', `/pt${READING_PATHS.cv}`);
  });

  for (const { path, locale } of PAIRS) {
    test(`${path} keeps the print action and the sibling reading link in the page body`, async ({
      page,
    }) => {
      await page.goto(path);
      const shared = readingViews[locale].shared;
      await expect(
        page.locator(MAIN).getByRole('button', { name: shared.printLabel }),
      ).toBeVisible();
      const sibling = path.endsWith(READING_PATHS.summary)
        ? readingViews[locale].cv.path
        : readingViews[locale].summary.path;
      await expect(page.locator(MAIN).locator(`a[href="${sibling}"]`).first()).toBeVisible();
    });
  }
});

test.describe('print hides the shell', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'page.pdf is Chromium only');

  for (const { path } of PAIRS) {
    test(`${path} prints without the shell chrome`, async ({ page }) => {
      await page.setViewportSize(DESKTOP);
      await page.goto(path);
      await expect(page.locator('body > canvas')).toHaveCount(1);
      await page.emulateMedia({ media: 'print' });
      const hidden = [
        '.desktop-topbar',
        '.mobile-title-bar',
        '.status-bar',
        '.dock',
        '.section-menu',
        '.menu-scrim',
        '.to-top-btn',
        '.pos-meter',
        '.crt-vignette',
        '.crt-scanlines',
        '.crt-mask',
        '.crt-noise',
        '.crt-flicker',
        '.crt-scan-beam',
        'a.skip-to-content',
        'body > canvas',
      ];
      for (const selector of hidden) {
        const nodes = await page.locator(selector).all();
        expect(nodes.length, `${selector} renders in the page`).toBeGreaterThan(0);
        for (const node of nodes) {
          await expect(node, selector).toBeHidden();
        }
      }
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    });
  }

  for (const [name, byPrefix] of Object.entries(MAX_PRINT_PAGES)) {
    for (const [prefix, expected] of Object.entries(byPrefix)) {
      test(`${prefix}/${name} prints on at most ${expected} A4 page${expected === 1 ? '' : 's'}`, async ({
        page,
      }) => {
        await page.setViewportSize(DESKTOP);
        await page.goto(`${prefix}/${name}`);
        await page.emulateMedia({ media: 'print' });
        const pdf = await page.pdf({ preferCSSPageSize: true });
        const pages = pdf.toString('latin1').match(PDF_PAGE_PATTERN) ?? [];
        expect(pages.length).toBeGreaterThan(0);
        expect(pages.length, 'linux and darwin metrics differ by a page').toBeLessThanOrEqual(
          expected,
        );
      });
    }
  }
});
