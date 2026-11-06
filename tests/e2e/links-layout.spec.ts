import { expect, type Page, test } from '@playwright/test';
import { horizontalOverflow } from './_helpers/geometry';

const GOLDEN_RATIO = 1.618;
const RATIO_TOLERANCE = 0.1;
const EVEN_TOLERANCE_PX = 1;
const OVERFLOW_TOLERANCE_PX = 1;
const PILL_MIN_HEIGHT_PX = 44;
const COLUMN_FLOOR_PX = 280;

const VIEWPORT = {
  phone: { width: 390, height: 844 },
  narrow: { width: 320, height: 720 },
  tablet: { width: 820, height: 1000 },
  desktop: { width: 1280, height: 800 },
};

const FONT_FLOOR_PX = 12;

const ROUTE_COPY: Record<string, { qrLabel: RegExp; skipLabel: string }> = {
  '/links': { qrLabel: /^Código QR:/, skipLabel: 'Pular para o conteúdo' },
  '/links/en': { qrLabel: /^QR code:/, skipLabel: 'Skip to main content' },
};

const PRIMARY = '[data-stack="primary"]';
const SECONDARY = '[data-stack="secondary"]';
const PILLS = '[data-testid="links-pills"]';

async function top(page: Page, selector: string): Promise<number> {
  const box = await page.locator(selector).first().boundingBox();
  expect(box, `${selector} must be on the page`).not.toBeNull();
  return box?.y ?? 0;
}

async function width(page: Page, selector: string): Promise<number> {
  const box = await page.locator(selector).first().boundingBox();
  expect(box, `${selector} must be on the page`).not.toBeNull();
  return box?.width ?? 0;
}

async function columnCount(page: Page, selector: string): Promise<number> {
  return page
    .locator(selector)
    .first()
    .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
}

for (const path of ['/links', '/links/en']) {
  test.describe(`${path} layout`, () => {
    test('is one column at 390 in reading order: identity, pills, latest video, history, playlists', async ({
      page,
    }) => {
      await page.setViewportSize(VIEWPORT.phone);
      await page.goto(path);

      expect(await columnCount(page, '.links-grid')).toBe(1);

      const order = [
        '.links-identity',
        PILLS,
        '[data-col="channel"]',
        '[data-col="history"]',
        '[data-col="playlists"]',
        'footer',
      ];
      const tops: number[] = [];
      for (const selector of order) tops.push(await top(page, selector));
      expect(
        tops,
        `source order must read ${order.join(' < ')}; got tops ${tops.join(', ')}`,
      ).toEqual([...tops].sort((a, b) => a - b));
      expect(new Set(tops).size).toBe(order.length);
    });

    test('puts the pills in a 2-column grid of 48px rows on a phone', async ({ page }) => {
      await page.setViewportSize(VIEWPORT.phone);
      await page.goto(path);

      expect(await columnCount(page, PILLS)).toBe(2);
      const heights = await page
        .locator(`${PILLS} li > :is(a, button)`)
        .evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height));
      expect(heights.length).toBeGreaterThan(2);
      for (const height of heights) expect(height).toBeGreaterThanOrEqual(PILL_MIN_HEIGHT_PX);
    });

    test('splits 1fr to 1.618fr at 1280, identity and pills left, feed right', async ({ page }) => {
      await page.setViewportSize(VIEWPORT.desktop);
      await page.goto(path);

      expect(await columnCount(page, '.links-grid')).toBe(2);
      const left = await width(page, PRIMARY);
      const right = await width(page, SECONDARY);
      expect(Math.abs(right / left - GOLDEN_RATIO)).toBeLessThan(RATIO_TOLERANCE);

      const inLeft = (selector: string) => page.locator(`${PRIMARY} ${selector}`);
      const inRight = (selector: string) => page.locator(`${SECONDARY} ${selector}`);
      await expect(inLeft('.links-identity')).toHaveCount(1);
      await expect(inLeft(PILLS)).toHaveCount(1);
      await expect(inLeft('[data-col="qr"]')).toBeVisible();
      await expect(inRight('[data-col="channel"]')).toHaveCount(1);
      await expect(inRight('[data-col="history"]')).toHaveCount(1);
      await expect(inRight('[data-col="playlists"]')).toHaveCount(1);
    });

    test('keeps two even columns on a tablet, the left never under the readable floor', async ({
      page,
    }) => {
      await page.setViewportSize(VIEWPORT.tablet);
      await page.goto(path);

      expect(await columnCount(page, '.links-grid')).toBe(2);
      const left = await width(page, PRIMARY);
      const right = await width(page, SECONDARY);
      expect(Math.abs(right - left)).toBeLessThanOrEqual(EVEN_TOLERANCE_PX);
      expect(left).toBeGreaterThanOrEqual(COLUMN_FLOOR_PX);
    });

    for (const [name, viewport] of Object.entries(VIEWPORT)) {
      test(`has no horizontal overflow at ${viewport.width} (${name})`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await page.goto(path);

        const offenders = await page.evaluate(() => {
          const root = document.documentElement;
          return Array.from(document.querySelectorAll<HTMLElement>('main *'))
            .filter((el) => el.getBoundingClientRect().right > root.clientWidth + 1)
            .filter((el) => getComputedStyle(el).position !== 'fixed')
            .map((el) => `${el.tagName.toLowerCase()}.${el.className}`.slice(0, 80));
        });
        expect(await horizontalOverflow(page)).toBeLessThanOrEqual(OVERFLOW_TOLERANCE_PX);
        expect(offenders).toEqual([]);
      });
    }

    test('wraps the full stack line inside the identity box at 320', async ({ page }) => {
      await page.setViewportSize(VIEWPORT.narrow);
      await page.goto(path);

      const stack = page.locator('.links-identity-meta dd').nth(1);
      await expect(stack).toContainText('Guardrails');
      const fits = await stack.evaluate(
        (el) => el.scrollWidth <= el.clientWidth + 1 && el.getBoundingClientRect().height > 0,
      );
      expect(fits).toBe(true);
    });

    test('renders no text below the 12px floor', async ({ page }) => {
      await page.setViewportSize(VIEWPORT.desktop);
      await page.goto(path);

      const small = await page.evaluate((floor) => {
        const found: string[] = [];
        for (const el of document.querySelectorAll<HTMLElement>('.links-main *')) {
          const ownText = Array.from(el.childNodes).some(
            (node) => node.nodeType === Node.TEXT_NODE && (node.textContent ?? '').trim() !== '',
          );
          if (!ownText) continue;
          const size = Number.parseFloat(getComputedStyle(el).fontSize);
          if (size < floor) found.push(`${el.tagName.toLowerCase()}.${el.className}: ${size}px`);
        }
        return found;
      }, FONT_FLOOR_PX);
      expect(small).toEqual([]);
    });

    test('labels the QR code and the shell chrome in the page language', async ({ page }) => {
      await page.setViewportSize(VIEWPORT.desktop);
      await page.goto(path);

      const copy = ROUTE_COPY[path];
      if (!copy) throw new Error(`no expected copy for ${path}`);
      const qr = page.locator('[data-col="qr"] svg[role="img"]');
      await expect(qr).toHaveAttribute('aria-label', copy.qrLabel);
      await expect(page.locator('.skip-to-content')).toHaveText(copy.skipLabel);
    });
  });
}
