import { expect, test } from '@playwright/test';
import { installMockBackend } from './_helpers/mock-backend';
import { gotoSettled } from './_helpers/streamed';

const ROUTES = ['/', '/links', '/design-system'];
const DESKTOP = { width: 1280, height: 720 };
const PAPER_RGB = 'rgb(255, 255, 255)';
const MIN_TEXT_CONTRAST = 4.5;
const MIN_OPAQUE_ALPHA = 0.5;
const MIN_TEXT_BOX_PX = 2;
const CHROME = [
  '.desktop-topbar',
  '.mobile-title-bar',
  '.status-bar',
  '.dock',
  '.section-menu',
  '.menu-scrim',
  '.to-top-btn',
  '.pos-meter',
  '.pos-line',
  '.offline-notice',
  '.crt-vignette',
  '.crt-scanlines',
  '.crt-mask',
  '.crt-noise',
  '.crt-flicker',
  '.crt-scan-beam',
  'a.skip-to-content',
  'body > canvas',
];

for (const route of ROUTES) {
  test.describe(`${route} on paper`, () => {
    test.beforeEach(async ({ page }) => {
      await installMockBackend(page, { log: 'accept', forget: 'happy' });
      await page.setViewportSize(DESKTOP);
      await gotoSettled(page, route);
      await page.emulateMedia({ media: 'print' });
    });

    test('prints without the shell chrome, the CRT layers or the rain', async ({ page }) => {
      for (const selector of CHROME) {
        for (const node of await page.locator(selector).all()) {
          await expect(node, `${selector} must not print`).toBeHidden();
        }
      }
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    });

    test('puts readable ink on paper, never the signal green on white', async ({ page }) => {
      expect(
        await page.evaluate(() => getComputedStyle(document.body).backgroundColor),
        'the page background must print white',
      ).toBe(PAPER_RGB);

      const offenders = await page.evaluate(
        ([minContrast, minAlpha, minTextBox]) => {
          const swatch = document.createElement('canvas').getContext('2d', {
            willReadFrequently: true,
          });
          const parse = (value: string) => {
            if (!swatch) return { r: 0, g: 0, b: 0, a: 1 };
            swatch.clearRect(0, 0, 1, 1);
            swatch.fillStyle = '#000000';
            swatch.fillStyle = value;
            swatch.fillRect(0, 0, 1, 1);
            const [r = 0, g = 0, b = 0, a = 255] = swatch.getImageData(0, 0, 1, 1).data;
            return { r, g, b, a: a / 255 };
          };
          const luminance = ({ r, g, b }: { r: number; g: number; b: number }) => {
            const lin = (c: number) => {
              const s = c / 255;
              return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
            };
            return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
          };
          const paper = { r: 255, g: 255, b: 255, a: 1 };
          const surfaceBehind = (start: HTMLElement) => {
            for (let el: HTMLElement | null = start; el; el = el.parentElement) {
              const fill = parse(getComputedStyle(el).backgroundColor);
              if (fill.a >= minAlpha) return fill;
            }
            return paper;
          };
          const found: string[] = [];
          for (const el of document.querySelectorAll<HTMLElement>('body *')) {
            const style = getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden') continue;
            const box = el.getBoundingClientRect();
            if (box.width < minTextBox || box.height < minTextBox) continue;
            const hasText = [...el.childNodes].some(
              (n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim() !== '',
            );
            if (!hasText) continue;
            const text = luminance(parse(style.color));
            const surface = luminance(surfaceBehind(el));
            const contrast = (Math.max(text, surface) + 0.05) / (Math.min(text, surface) + 0.05);
            if (contrast < minContrast) {
              found.push(
                `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)} ${style.color} on ${style.backgroundColor} contrast ${contrast.toFixed(2)}`,
              );
            }
          }
          return found;
        },
        [MIN_TEXT_CONTRAST, MIN_OPAQUE_ALPHA, MIN_TEXT_BOX_PX] as const,
      );
      expect(
        offenders,
        'printed text below 4.5:1 against the surface it prints on cannot be read',
      ).toEqual([]);
    });
  });
}
