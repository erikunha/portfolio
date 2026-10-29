import { expect, test } from '@playwright/test';

const MOBILE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 720 };
const FACT_ROW = '#sec-projects .project-stats > div';
const PERF_PANEL = '#sec-live-perf .measured-perf';
const EDGE_TOLERANCE_PX = 1;

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

  test('live-perf device panels share one left edge', async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await page.goto('/');
    const panels = page.locator(PERF_PANEL);
    await panels.first().scrollIntoViewIfNeeded();
    const count = await panels.count();
    expect(count).toBeGreaterThan(1);
    const first = await panels.first().boundingBox();
    for (let i = 1; i < count; i++) {
      const box = await panels.nth(i).boundingBox();
      if (!first || !box) throw new Error('perf panel has no layout box');
      expect(Math.abs(box.x - first.x)).toBeLessThanOrEqual(EDGE_TOLERANCE_PX);
    }
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

  test('live-perf device panels sit side by side', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/');
    const panels = page.locator(PERF_PANEL);
    await panels.first().scrollIntoViewIfNeeded();
    expect(await panels.count()).toBeGreaterThan(1);
    const first = await panels.nth(0).boundingBox();
    const second = await panels.nth(1).boundingBox();
    if (!first || !second) throw new Error('perf panel has no layout box');
    expect(second.x).toBeGreaterThan(first.x + first.width - EDGE_TOLERANCE_PX);
    expect(Math.abs(second.y - first.y)).toBeLessThanOrEqual(EDGE_TOLERANCE_PX);
  });
});
