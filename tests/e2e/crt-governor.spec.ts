import { expect, type Page, test } from '@playwright/test';
import { waitForHydration } from './_helpers/hydration';

const GOVERNED_LEVEL = 2;
const FULL_RATE_LEVEL = 0;
const CRT_OVERLAY = '[data-testid="crt-noise"]';
const MOTION_TOGGLE = 'button[data-motion]';
const EFFECT_TEST_IDS = ['crt-noise', 'crt-flicker', 'crt-scan-beam'] as const;

const effectStylesAtLevel = (page: Page, level: number) =>
  page.evaluate(
    ([lvl, ids]) => {
      document.documentElement.dataset.crtLevel = String(lvl);
      return ids.map((id) => {
        const style = getComputedStyle(document.querySelector(`[data-testid="${id}"]`) as Element);
        return { name: style.animationName, playState: style.animationPlayState };
      });
    },
    [level, EFFECT_TEST_IDS] as const,
  );

test.describe('CRT frame governor', () => {
  test.use({ viewport: { width: 1280, height: 720 }, timezoneId: 'Europe/Berlin' });

  test('publishes its level on the document element once the page hydrates', async ({ page }) => {
    await page.goto('/');
    await waitForHydration(page, CRT_OVERLAY);
    await expect
      .poll(() => page.evaluate(() => document.documentElement.dataset.crtLevel), {
        message: 'the CRT overlay must start the frame governor, which publishes data-crt-level',
      })
      .toMatch(/^[0-5]$/);
  });

  test('full rate leaves the three animated layers running', async ({ page }) => {
    await page.goto('/');
    await waitForHydration(page, CRT_OVERLAY);
    const styles = await effectStylesAtLevel(page, FULL_RATE_LEVEL);
    expect(styles.map((s) => s.name)).toEqual(['crt-noise-shift', 'crt-flicker', 'crt-scan-beam']);
    expect(styles.map((s) => s.playState)).toEqual(['running', 'running', 'running']);
  });

  test('a degraded level pauses the layers for the stepper in the cascade the browser resolves', async ({
    page,
  }) => {
    await page.goto('/');
    await waitForHydration(page, CRT_OVERLAY);
    const styles = await effectStylesAtLevel(page, GOVERNED_LEVEL);
    expect(styles.map((s) => s.name)).toEqual(['crt-noise-shift', 'crt-flicker', 'crt-scan-beam']);
    expect(
      styles.map((s) => s.playState),
      'level above 0 must pause every layer so the stepper owns its frames',
    ).toEqual(['paused', 'paused', 'paused']);
  });

  test('a degraded level never revives an effect that reduced motion switched off', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await waitForHydration(page, CRT_OVERLAY);
    const styles = await effectStylesAtLevel(page, GOVERNED_LEVEL);
    expect(
      styles.map((s) => s.name),
      'the governed rule may only pause, so animation: none keeps winning',
    ).toEqual(['none', 'none', 'none']);
  });

  test('a degraded level never revives an effect that the MOTION toggle switched off', async ({
    page,
  }) => {
    await page.goto('/');
    await waitForHydration(page, CRT_OVERLAY);
    await waitForHydration(page, MOTION_TOGGLE);
    await page.locator('button[data-motion="on"]').first().click();
    await expect(page.locator('button[data-motion="off"]').first()).toBeVisible();
    const styles = await effectStylesAtLevel(page, GOVERNED_LEVEL);
    expect(styles.map((s) => s.name)).toEqual(['none', 'none', 'none']);
  });
});

test.describe('CRT frame governor on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, timezoneId: 'Europe/Berlin' });

  test('publishes its level on the document element once the page hydrates', async ({ page }) => {
    await page.goto('/');
    await waitForHydration(page, CRT_OVERLAY);
    await expect
      .poll(() => page.evaluate(() => document.documentElement.dataset.crtLevel))
      .toMatch(/^[0-5]$/);
  });
});
