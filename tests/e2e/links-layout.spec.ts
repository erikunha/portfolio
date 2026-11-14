import { expect, type Page, test } from '@playwright/test';
import { linksContent } from '../../content/links';
import { LINKS_LOCALE, type LinksLocale } from '../../content/links.constants';
import { horizontalOverflow } from './_helpers/geometry';
import { gotoSettled } from './_helpers/streamed';

const GOLDEN_RATIO = 1.618;
const RATIO_TOLERANCE = 0.1;
const EVEN_TOLERANCE_PX = 1;
const OVERFLOW_TOLERANCE_PX = 1;
const LINE_MIN_HEIGHT_PX = 44;
const COLUMN_FLOOR_PX = 280;

const VIEWPORT = {
  phone: { width: 390, height: 844 },
  narrow: { width: 320, height: 720 },
  tablet: { width: 820, height: 1000 },
  desktop: { width: 1280, height: 800 },
};

const FONT_FLOOR_PX = 13;

const MAIL_PROTOCOL = 'mailto:';

const ROUTE_COPY: Record<string, { qrLabel: RegExp; skipLabel: string; locale: LinksLocale }> = {
  '/links': {
    qrLabel: /^Código QR:/,
    skipLabel: 'Pular para o conteúdo',
    locale: LINKS_LOCALE.pt,
  },
  '/links/en': {
    qrLabel: /^QR code:/,
    skipLabel: 'Skip to main content',
    locale: LINKS_LOCALE.en,
  },
};

const PRIMARY = '[data-stack="primary"]';
const SECONDARY = '[data-stack="secondary"]';
const PROFILES = '[data-testid="links-profiles"]';
const LINES = '.links-line';

async function top(page: Page, selector: string): Promise<number> {
  const target = page.locator(selector).first();
  await expect(target, `${selector} must be on the page`).toBeVisible();
  const box = await target.boundingBox();
  return box?.y ?? 0;
}

async function width(page: Page, selector: string): Promise<number> {
  const target = page.locator(selector).first();
  await expect(target, `${selector} must be on the page`).toBeVisible();
  const box = await target.boundingBox();
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
    test('is one column at 390 in reading order: identity, watch, history, playlists, profiles, contact', async ({
      page,
    }) => {
      await page.setViewportSize(VIEWPORT.phone);
      await gotoSettled(page, path);

      expect(await columnCount(page, '.links-grid')).toBe(1);

      const order = [
        '.links-identity',
        '[data-col="channel"]',
        '[data-col="history"]',
        '[data-col="playlists"]',
        '[data-col="profiles"]',
        '[data-col="contact"]',
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

    test('lays profiles and contact out as full-width rows of 44px or more on a phone', async ({
      page,
    }) => {
      await page.setViewportSize(VIEWPORT.phone);
      await gotoSettled(page, path);

      const rows = await page.locator(`${LINES}:visible`).evaluateAll((nodes) =>
        nodes.map((node) => ({
          height: node.getBoundingClientRect().height,
          width: node.getBoundingClientRect().width,
          list: node.closest('ul')?.getBoundingClientRect().width ?? 0,
        })),
      );
      expect(rows.length).toBeGreaterThan(4);
      for (const row of rows) {
        expect(row.height).toBeGreaterThanOrEqual(LINE_MIN_HEIGHT_PX);
        expect(row.width).toBeGreaterThanOrEqual(row.list - OVERFLOW_TOLERANCE_PX);
      }
    });

    test('lists a profile row for every profile with a destination and none without', async ({
      page,
    }) => {
      await page.setViewportSize(VIEWPORT.desktop);
      await gotoSettled(page, path);

      const copy = ROUTE_COPY[path];
      if (!copy) throw new Error(`no expected copy for ${path}`);
      const expected = linksContent.pills
        .filter((pill) => pill.href && !pill.href.startsWith(MAIL_PROTOCOL))
        .map((pill) => pill.label[copy.locale]);
      const rendered = await page.locator(`${PROFILES} .links-line-label`).allTextContents();
      expect(
        rendered,
        'a network without a confirmed destination must not render a row that links nowhere',
      ).toEqual(expected);
    });

    test('pushes each row host to the right edge, ahead of the arrow', async ({ page }) => {
      await page.setViewportSize(VIEWPORT.phone);
      await gotoSettled(page, path);

      const row = page.locator(`${PROFILES} .links-line`).first();
      const host = await row.locator('.links-line-host').boundingBox();
      const arrow = await row.locator('.links-line-arrow').boundingBox();
      expect(host && arrow && Math.abs(host.x + host.width + 12 - arrow.x)).toBeLessThanOrEqual(
        EVEN_TOLERANCE_PX + 1,
      );
    });

    test('splits 1fr to 1.618fr at 1280, identity and rows left, feed right', async ({ page }) => {
      await page.setViewportSize(VIEWPORT.desktop);
      await gotoSettled(page, path);

      expect(await columnCount(page, '.links-grid')).toBe(2);
      const left = await width(page, PRIMARY);
      const right = await width(page, SECONDARY);
      expect(Math.abs(right / left - GOLDEN_RATIO)).toBeLessThan(RATIO_TOLERANCE);

      const identity = await page.locator('.links-grid > .links-identity').boundingBox();
      const primary = await page.locator(PRIMARY).boundingBox();
      expect(Math.abs((identity?.x ?? 0) - (primary?.x ?? 1))).toBeLessThanOrEqual(
        OVERFLOW_TOLERANCE_PX,
      );
      expect(identity?.y ?? 0).toBeLessThan(primary?.y ?? 0);

      const inLeft = (selector: string) => page.locator(`${PRIMARY} ${selector}`);
      const inRight = (selector: string) => page.locator(`${SECONDARY} ${selector}`);
      await expect(inLeft('[data-col="profiles"]')).toHaveCount(1);
      await expect(inLeft('[data-col="contact"]')).toHaveCount(1);
      await expect(inLeft('[data-col="qr"]')).toBeVisible();
      await expect(inRight('[data-col="channel"]')).toHaveCount(1);
      await expect(inRight('[data-col="history"]')).toHaveCount(1);
      await expect(inRight('[data-col="playlists"]')).toHaveCount(1);
    });

    test('splits the featured card thumbnail to text at 1 to 1.618 once the column is 600px wide', async ({
      page,
    }) => {
      await page.setViewportSize(VIEWPORT.desktop);
      await gotoSettled(page, path);

      const media = await width(page, '.links-watch-media');
      const body = await width(page, '.links-watch-body');
      expect(Math.abs(body / media - GOLDEN_RATIO)).toBeLessThan(RATIO_TOLERANCE);
      expect(await columnCount(page, '.links-playlists')).toBe(2);

      await page.setViewportSize(VIEWPORT.phone);
      expect(await columnCount(page, '.links-watch')).toBe(1);
      expect(await columnCount(page, '.links-playlists')).toBe(1);
    });

    test('keeps two even columns on a tablet, the left never under the readable floor', async ({
      page,
    }) => {
      await page.setViewportSize(VIEWPORT.tablet);
      await gotoSettled(page, path);

      expect(await columnCount(page, '.links-grid')).toBe(2);
      const left = await width(page, PRIMARY);
      const right = await width(page, SECONDARY);
      expect(Math.abs(right - left)).toBeLessThanOrEqual(EVEN_TOLERANCE_PX);
      expect(left).toBeGreaterThanOrEqual(COLUMN_FLOOR_PX);
    });

    for (const [name, viewport] of Object.entries(VIEWPORT)) {
      test(`has no horizontal overflow at ${viewport.width} (${name})`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await gotoSettled(page, path);

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
      await gotoSettled(page, path);

      const stack = page.locator('.links-identity-meta dd').nth(1);
      await expect(stack).toContainText('Guardrails');
      const fits = await stack.evaluate(
        (el) => el.scrollWidth <= el.clientWidth + 1 && el.getBoundingClientRect().height > 0,
      );
      expect(fits).toBe(true);
    });

    test('renders no text below the 13px floor', async ({ page }) => {
      await page.setViewportSize(VIEWPORT.desktop);
      await gotoSettled(page, path);

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
      await gotoSettled(page, path);

      const copy = ROUTE_COPY[path];
      if (!copy) throw new Error(`no expected copy for ${path}`);
      const qr = page.locator('[data-col="qr"] svg[role="img"]');
      await expect(qr).toHaveAttribute('aria-label', copy.qrLabel);
      await expect(page.locator('.skip-to-content')).toHaveText(copy.skipLabel);
    });
  });
}
