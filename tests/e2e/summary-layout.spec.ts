import { expect, type Page, test } from '@playwright/test';
import { readingViews } from '../../content/reading-views';
import { SITE_LOCALE } from '../../content/site-locale';

const SUMMARY_PATHS = ['/summary', '/pt/summary'];
const OVERFLOW_WIDTHS = [320, 390, 820, 1280];
const DESKTOP = { width: 1280, height: 800 };
const PHONE = { width: 390, height: 844 };
const GOLDEN_RATIO = 1.618;
const RATIO_TOLERANCE = 0.1;
const TARGET_MIN = 44;
const EN = readingViews[SITE_LOCALE.en].summary;

const top = async (page: Page, selector: string) => {
  const box = await page.locator(selector).first().boundingBox();
  if (!box) throw new Error(`${selector} has no box`);
  return box;
};

test.describe('/summary layout', () => {
  test('at 1280 the projects sit left of the stack at the golden ratio', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/summary');
    const projects = await top(page, '.reading-projects');
    const stack = await top(page, '.reading-chips');
    const contact = await page.getByRole('link', { name: /@/ }).first().boundingBox();
    expect(projects.x).toBeLessThan(stack.x);
    expect(contact?.x, 'contact shares the narrow column').toBeGreaterThan(projects.x);
    expect(contact?.x).toBeGreaterThanOrEqual(stack.x - 1);
    const section = await top(page, '.reading-split > section');
    const side = await top(page, '.reading-side');
    expect(section.width / side.width).toBeGreaterThan(GOLDEN_RATIO - RATIO_TOLERANCE);
    expect(section.width / side.width).toBeLessThan(GOLDEN_RATIO + RATIO_TOLERANCE);
  });

  test('at 1280 the stack shows a core row and an AI row with a lime border', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/summary');
    await expect(page.locator('.reading-chips:not(.reading-chips--ai) li')).toHaveCount(
      EN.stack.core.length,
    );
    await expect(page.locator('.reading-chips--ai li')).toHaveCount(EN.stack.ai.length);
    const border = await page
      .locator('.reading-chips--ai li')
      .first()
      .evaluate((node) => getComputedStyle(node).borderTopColor);
    const lime = await page.evaluate(() => {
      const probe = document.createElement('i');
      probe.style.color = 'var(--color-primary-500)';
      document.body.append(probe);
      const color = getComputedStyle(probe).color;
      probe.remove();
      return color;
    });
    expect(border).toBe(lime);
  });

  test('at 390 one column in the order stats, CTAs, projects, stack, contact', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto('/summary');
    const stats = await top(page, `[aria-label="${EN.statsLabel}"]`);
    const actions = await top(page, '.reading-actions');
    const projects = await top(page, '.reading-projects');
    const stack = await top(page, '.reading-chips');
    const contact = await page.getByRole('link', { name: /@/ }).first().boundingBox();
    expect(stats.y).toBeLessThan(actions.y);
    expect(actions.y).toBeLessThan(projects.y);
    expect(projects.y).toBeLessThan(stack.y);
    expect(stack.y).toBeLessThan(contact?.y ?? 0);
    expect(Math.abs(projects.x - stack.x), 'one column').toBeLessThan(1);
    const tiles = await page.locator('.reading-stats .stat-tile').evaluateAll((nodes) =>
      nodes.map((node) => {
        const box = node.getBoundingClientRect();
        return { x: Math.round(box.x), y: Math.round(box.y) };
      }),
    );
    expect(new Set(tiles.map((tile) => tile.x)).size, 'stats stay two columns').toBe(2);
    expect(new Set(tiles.map((tile) => tile.y)).size, 'stats stay two rows').toBe(2);
  });

  test('at 390 the call to action buttons are full width and tall enough', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto('/summary');
    const row = await top(page, '.reading-actions');
    const controls = page.locator('.reading-actions > *');
    const count = await controls.count();
    expect(count).toBe(3);
    for (let index = 0; index < count; index += 1) {
      const box = await controls.nth(index).boundingBox();
      expect(box?.width).toBeCloseTo(row.width, 0);
      expect(box?.height).toBeGreaterThanOrEqual(TARGET_MIN);
    }
  });

  for (const path of SUMMARY_PATHS) {
    for (const width of OVERFLOW_WIDTHS) {
      test(`${path} has no horizontal overflow at ${width}`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(path);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow).toBeLessThanOrEqual(0);
      });
    }
  }

  test('between 768 and 1023 the columns stack because the narrow one would drop under 260px', async ({
    page,
  }) => {
    for (const width of [768, 820, 1023]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/summary');
      const projects = await top(page, '.reading-split > section');
      const side = await top(page, '.reading-side');
      expect(side.y, `stacked at ${width}`).toBeGreaterThan(projects.y + projects.height - 1);
    }
  });

  test('at 1024 the grid is on and the narrow column holds at least 260px', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    await page.goto('/summary');
    const projects = await top(page, '.reading-split > section');
    const side = await top(page, '.reading-side');
    expect(side.x).toBeGreaterThan(projects.x + projects.width - 1);
    expect(side.width).toBeGreaterThanOrEqual(260);
  });
});
