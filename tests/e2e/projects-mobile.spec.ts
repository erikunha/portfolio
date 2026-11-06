import { expect, test } from '@playwright/test';
import { horizontalOverflow, VIEWPORTS } from './_helpers/geometry';

const { PHONE: MOBILE, DESKTOP, PHONE_NARROW: PHONE_MIN } = VIEWPORTS;
const FACT_ROW = '#sec-projects .project-stats > div';
const ASK_BLOCK = '.measured-ask';
const PERF_BLOCK = '#sec-live-perf';
const PENDING_DATA = '#sec-live-metrics [aria-busy="true"], #sec-live-perf [aria-busy="true"]';
const PERF_TILE = '#sec-live-perf .measured-tile';
const PERF_LABEL = '#sec-live-perf .measured-label';
const RECEIPT_VALUE = '.project-receipts .receipt-value';
const EDGE_TOLERANCE_PX = 1;

async function wrappedTexts(
  page: import('@playwright/test').Page,
  selector: string,
): Promise<string[]> {
  const locator = page.locator(selector);
  await locator.first().scrollIntoViewIfNeeded();
  return locator.evaluateAll((nodes) =>
    nodes
      .map((node) => {
        const range = document.createRange();
        range.selectNodeContents(node);
        return { text: node.textContent?.trim() ?? '', lines: range.getClientRects().length };
      })
      .filter((entry) => entry.lines > 1)
      .map((entry) => entry.text),
  );
}

test.describe('projects section below 768px', () => {
  test('fact label and value share one left edge and the value is not clipped', async ({
    page,
  }) => {
    await page.setViewportSize(MOBILE);
    await page.goto('/');
    const rows = page.locator(FACT_ROW);
    await rows.first().scrollIntoViewIfNeeded();
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const row = rows.nth(i);
      const label = await row.locator('dt').boundingBox();
      const value = await row.locator('dd').boundingBox();
      if (!label || !value) throw new Error(`fact row ${i} has no layout box`);
      expect(Math.abs(label.x - value.x)).toBeLessThanOrEqual(EDGE_TOLERANCE_PX);
      expect(value.y).toBeGreaterThanOrEqual(label.y + label.height - EDGE_TOLERANCE_PX);
      const clipped = await row.locator('dd').evaluate((el) => el.scrollWidth > el.clientWidth);
      expect(clipped, `fact row ${i} value is clipped`).toBe(false);
    }
  });

  test('live-perf tiles stack 2x2', async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await page.goto('/');
    await expect(page.locator(PENDING_DATA)).toHaveCount(0);
    await expect(page.locator(ASK_BLOCK)).toHaveCount(1);
    const tiles = page.locator(PERF_TILE);
    await tiles.first().scrollIntoViewIfNeeded();
    await expect(tiles).toHaveCount(4);
    const boxes = await tiles.evaluateAll((nodes) =>
      nodes.map((node) => {
        const { x, y } = node.getBoundingClientRect();
        return { x, y };
      }),
    );
    expect(new Set(boxes.map((box) => Math.round(box.x))).size).toBe(2);
    expect(new Set(boxes.map((box) => Math.round(box.y))).size).toBe(2);
  });

  test('the measured section does not scroll horizontally at 320', async ({ page }) => {
    await page.setViewportSize(PHONE_MIN);
    await page.goto('/');
    await page.locator(PERF_TILE).first().scrollIntoViewIfNeeded();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });
});

test.describe('projects section at 1280px', () => {
  test('fact rows stay side by side', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/');
    const rows = page.locator(FACT_ROW);
    await rows.first().scrollIntoViewIfNeeded();
    const label = await rows.first().locator('dt').boundingBox();
    const value = await rows.first().locator('dd').boundingBox();
    if (!label || !value) throw new Error('fact row has no layout box');
    expect(value.x).toBeGreaterThan(label.x + label.width - EDGE_TOLERANCE_PX);
  });

  test('live-perf tiles sit four across, below the ask block', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/');
    const tiles = page.locator(PERF_TILE);
    await tiles.first().scrollIntoViewIfNeeded();
    await expect(tiles).toHaveCount(4);
    const rows = await tiles.evaluateAll((nodes) =>
      nodes.map((node) => Math.round(node.getBoundingClientRect().y)),
    );
    expect(new Set(rows).size).toBe(1);
    const ask = await page.locator(ASK_BLOCK).boundingBox();
    const perf = await page.locator(PERF_BLOCK).boundingBox();
    if (!ask || !perf) throw new Error('measured blocks have no layout box');
    expect(perf.y).toBeGreaterThanOrEqual(ask.y + ask.height - EDGE_TOLERANCE_PX);
  });
});

test.describe('live perf score labels', () => {
  for (const width of [1024, 1280]) {
    test(`at ${width} a score label stays on one line`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      const labels = page.locator(PERF_LABEL);
      await labels.first().scrollIntoViewIfNeeded();
      expect(await labels.count()).toBeGreaterThan(0);
      const wrapped = await wrappedTexts(page, PERF_LABEL);
      expect(wrapped, `score labels wrapped: ${wrapped.join(', ')}`).toEqual([]);
    });
  }
});

test.describe('perf receipt values', () => {
  for (const width of [768, 1280]) {
    test(`at ${width} a receipt value stays on one line`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      const values = page.locator(RECEIPT_VALUE);
      await values.first().scrollIntoViewIfNeeded();
      expect(await values.count()).toBeGreaterThan(0);
      const wrapped = await wrappedTexts(page, RECEIPT_VALUE);
      expect(wrapped, `receipt values wrapped: ${wrapped.join(', ')}`).toEqual([]);
      const clipped = await values.evaluateAll((nodes) =>
        nodes
          .filter((node) => node.scrollWidth > node.clientWidth + 1)
          .map((node) => node.textContent?.trim() ?? ''),
      );
      expect(clipped, `receipt values clipped: ${clipped.join(', ')}`).toEqual([]);
    });
  }
});
