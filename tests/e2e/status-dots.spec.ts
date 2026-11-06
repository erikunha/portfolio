import { expect, type Page, test } from '@playwright/test';

const dot = (page: Page) => page.locator('button[data-motion] > span[aria-hidden="true"]').first();
const animationName = (page: Page) =>
  dot(page).evaluate((node) => getComputedStyle(node).animationName);

test.describe('status dots blink while motion is on', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test('the MOTION dot blinks with motion on and stops when motion is turned off', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('button[data-motion="on"]').first()).toBeVisible();
    expect(await animationName(page)).toBe('live-blink');
    await page.locator('button[data-motion="on"]').first().click();
    await expect(page.locator('button[data-motion="off"]').first()).toBeVisible();
    expect(await animationName(page)).toBe('none');
  });

  test('the MOTION dot stays solid under prefers-reduced-motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(dot(page)).toBeVisible();
    expect(await animationName(page)).toBe('none');
  });
});
