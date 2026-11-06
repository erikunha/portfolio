import { expect, type Page, test } from '@playwright/test';

const A4_PX = { width: 794, height: 1123 };
const PATHS = ['/cv', '/pt/cv'] as const;
const SNAKE_CASE = /\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/;
const NEW_TAB_GLYPH = '↗';
const ALIGN_TOLERANCE_PX = 1;
const MIN_PDF_BYTES = 10_000;

async function openForPrint(page: Page, path: string) {
  await page.setViewportSize(A4_PX);
  await page.emulateMedia({ media: 'print' });
  await page.goto(path);
  await expect(page.locator('.reading-view')).toBeVisible();
}

for (const path of PATHS) {
  test.describe(`${path} in print`, () => {
    test('prints plain words: no snake_case tokens, no new-tab glyph', async ({ page }) => {
      await openForPrint(page, path);
      // biome-ignore lint/performance/useDomNodeTextContent: the text visible under print media is the property under test, textContent would count hidden nodes
      const text = await page.locator('.reading-view').innerText();

      expect(text).not.toMatch(SNAKE_CASE);
      expect(text).not.toContain(NEW_TAB_GLYPH);
    });

    test('hides every call-to-action button and keeps the email as text', async ({ page }) => {
      await openForPrint(page, path);

      await expect(page.locator('.reading-actions')).toBeHidden();
      await expect(
        page
          .locator('.reading-view a')
          .filter({ hasText: /HIRE|CONTRATE|LINKEDIN/ })
          .locator('visible=true'),
      ).toHaveCount(0);
      await expect(page.locator('.reading-actions-inline a[href^="mailto:"]')).toBeVisible();
    });

    test('lines certifications and education up on one value column', async ({ page }) => {
      await openForPrint(page, path);
      const lefts = await page.locator('.reading-rows li').evaluateAll((rows) =>
        rows.map((row) => {
          const value = row.querySelector('.reading-row-value') as HTMLElement;
          return Math.round(value.getBoundingClientRect().left * 100) / 100;
        }),
      );

      expect(lefts.length).toBeGreaterThanOrEqual(6);
      for (const left of lefts) {
        expect(Math.abs(left - (lefts[0] ?? 0)), `value columns ${lefts.join(', ')}`).toBeLessThan(
          ALIGN_TOLERANCE_PX,
        );
      }
    });

    test('renders to a PDF', async ({ page }) => {
      await openForPrint(page, path);
      const pdf = await page.pdf({ format: 'A4', preferCSSPageSize: true });

      expect(pdf.byteLength).toBeGreaterThan(MIN_PDF_BYTES);
    });
  });
}
