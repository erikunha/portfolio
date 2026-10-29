import { expect, type Page, test } from '@playwright/test';
import { heroAuthorization, heroContent } from '@/content/hero';
import { profile } from '@/content/profile';

const viewports = [
  { width: 1280, height: 720 },
  { width: 375, height: 812 },
];

for (const viewport of viewports) {
  test.describe(`r106 Hero and About at ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport });

    test('shows identity and hiring actions in the first screen', async ({ page }) => {
      await page.goto('/');
      const hero = page.locator('.hero-frame:visible');
      await expect(
        hero.getByRole('heading', { level: 1, name: profile.displayName }),
      ).toBeVisible();
      await expect(hero.getByText(profile.title, { exact: false })).toBeVisible();
      await expect(hero.getByText(heroAuthorization)).toBeVisible();
      const hire = hero.getByRole('link', { name: heroContent.hire.accessibleLabel });
      await expect(hire).toBeVisible();
      await expect(hire).toHaveAttribute('href', heroContent.hire.href);
      for (const action of heroContent.actions) {
        const link = hero.getByRole('link', { name: action.accessibleLabel, exact: true });
        await expect(link).toHaveAttribute('href', action.href);
        if (viewport.width < 1024 || action.href !== '/cv') {
          await expect(link).toBeInViewport();
        }
      }
      if (viewport.width < 390) {
        await expect(hero.locator('.hero-boot-mobile')).toBeHidden();
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        viewport.width,
      );
    });

    test('keeps five bordered About panels and readable retry code', async ({ page }, testInfo) => {
      await page.goto('/');
      const about = page.locator('#sec-about');
      await expect(about.locator('.ab-panel')).toHaveCount(5);
      for (const panel of await about.locator('.ab-panel').all()) {
        await expect(panel.locator(':scope > header h3')).toHaveCount(1);
        await expect(panel).toHaveCSS('border-top-width', '1px');
        await expect(panel.locator(':scope > header')).toHaveCSS('border-bottom-width', '1px');
      }
      await expect(about.getByText("$ git tag --list 'community/*'")).toHaveCount(0);
      await expect(about.locator('#sec-community')).toHaveCount(0);
      const code = about.getByRole('region', { name: 'README code' });
      await expect(code).toHaveAttribute('tabindex', '0');
      await expect(code).toContainText('Math.random()');
      await page.screenshot({ path: testInfo.outputPath('hero-about.png'), fullPage: true });
    });
  });
}

const MOBILE_STACK = { width: 390, height: 844 };
const DESKTOP_ROW = { width: 1280, height: 720 };
const HERO_GROUPS = ['[data-testid="hero-stats"]', '[data-testid="hero-ctas"]'];

async function childBoxes(page: Page, group: string) {
  const children = page.locator(`.hero-frame:visible ${group} > :visible`);
  const count = await children.count();
  expect(count).toBeGreaterThan(1);
  const boxes = [];
  for (let index = 0; index < count; index++) {
    const box = await children.nth(index).boundingBox();
    expect(box).not.toBeNull();
    if (box) boxes.push(box);
  }
  return boxes;
}

test.describe('Hero groups reflow by viewport', () => {
  test('stack in one column below 768', async ({ page }) => {
    await page.setViewportSize(MOBILE_STACK);
    await page.goto('/');
    for (const group of HERO_GROUPS) {
      const boxes = await childBoxes(page, group);
      const lefts = new Set(boxes.map((box) => Math.round(box.x)));
      expect(lefts.size, `${group} children share one left edge`).toBe(1);
    }
  });

  test('stay side by side at 1280', async ({ page }) => {
    await page.setViewportSize(DESKTOP_ROW);
    await page.goto('/');
    for (const group of HERO_GROUPS) {
      const boxes = await childBoxes(page, group);
      const lefts = new Set(boxes.map((box) => Math.round(box.x)));
      expect(lefts.size, `${group} children sit in more than one column`).toBeGreaterThan(1);
    }
  });
});
