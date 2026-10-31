import { expect, test } from '@playwright/test';

const MOBILE = { width: 390, height: 844 };
const MOBILE_HERO_MAX_PX = 600;

test.describe('hero mobile layout', () => {
  test('the mobile hero fits the 600px budget at 390', async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await page.goto('/');
    const hero = page.locator('[data-testid="hero-mobile"]');
    await expect(hero).toBeVisible();
    const height = await hero.evaluate((node) => node.getBoundingClientRect().height);
    expect(
      height,
      'the mobile hero grew past the budget: the boot log, the stats and the CTA rows are the levers',
    ).toBeLessThanOrEqual(MOBILE_HERO_MAX_PX);
  });

  test('the impact stats render as a 2x2 grid at 390', async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await page.goto('/');
    const stats = page.locator('[data-testid="hero-stats"]').filter({ visible: true }).first();
    await expect(stats).toBeVisible();
    const { columns, rows } = await stats.evaluate((node) => {
      const style = getComputedStyle(node);
      const tops = new Set(
        [...node.children].map((child) => Math.round(child.getBoundingClientRect().top)),
      );
      return {
        columns: style.gridTemplateColumns.split(' ').length,
        rows: tops.size,
      };
    });
    expect(columns, 'the stats grid must be two columns wide at 390').toBe(2);
    expect(rows, 'the stats grid must be two rows tall at 390').toBe(2);
  });
});
