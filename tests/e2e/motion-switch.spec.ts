import { expect, type Page, test } from '@playwright/test';
import { NAVIGATION } from '../../content/navigation';
import { SITE_LOCALE } from '../../content/site-locale';
import { MOTION_CHOICE, MOTION_STORAGE_KEY } from './_helpers/motion';

const { copy } = NAVIGATION[SITE_LOCALE.en];
const MOTION_ROW = '.menu-motion';
const EQ_BAR = '[data-testid="eq-spectrum"] .eq-bar';
const CRT_BEAM = '[data-testid="crt-scan-beam"]';
const BODY_FULL = 'full';
const BODY_REDUCE = 'reduce';
const NO_ANIMATION = 'none';

const animationName = (page: Page, selector: string) =>
  page
    .locator(selector)
    .first()
    .evaluate((node) => getComputedStyle(node).animationName);

const storedChoice = (page: Page) =>
  page.evaluate((key) => localStorage.getItem(key), MOTION_STORAGE_KEY);

async function openDrawer(page: Page) {
  await page
    .getByRole('button', { name: 'Open menu', exact: true })
    .locator('visible=true')
    .click();
  await expect(page.locator('#section-drawer')).toBeVisible();
}

async function reachEqStrip(page: Page) {
  const strip = page.locator('[data-testid="eq-spectrum"]');
  await strip.scrollIntoViewIfNeeded();
  await expect(strip).toBeVisible();
}

test.describe('the MOTION switch is the only motion control', () => {
  test.use({ reducedMotion: 'reduce' });

  test('a first visit starts with motion on even when the system asks for reduced motion', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('body')).toHaveAttribute('data-motion', BODY_FULL);
    expect(await storedChoice(page), 'a default is not a stored choice').toBeNull();
    await reachEqStrip(page);
    expect(await animationName(page, EQ_BAR), 'the EQ bars must be animating').not.toBe(
      NO_ANIMATION,
    );
    expect(await animationName(page, CRT_BEAM), 'the CRT beam must be animating').not.toBe(
      NO_ANIMATION,
    );
    await openDrawer(page);
    await expect(page.locator(MOTION_ROW)).toContainText(copy.motionOn);
    await expect(page.locator(MOTION_ROW)).toHaveAttribute('aria-pressed', 'true');
  });

  test('the no-script fallback stays out of the way when scripts run', async ({ page }) => {
    await page.goto('/');
    expect(
      await page.evaluate(() => matchMedia('(scripting: none)').matches),
      'a scripted page must never match the fallback media query',
    ).toBe(false);
    expect(
      await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches),
      'the emulated system setting is reduce',
    ).toBe(true);
    await reachEqStrip(page);
    expect(await animationName(page, EQ_BAR)).not.toBe(NO_ANIMATION);
    await expect(page.locator('body')).toHaveAttribute('data-motion', BODY_FULL);
  });

  test('switching it off reduces everything, persists, and survives a reload', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('body')).toHaveAttribute('data-motion', BODY_FULL);
    await openDrawer(page);
    await page.locator(MOTION_ROW).click();

    await expect(page.locator('body')).toHaveAttribute('data-motion', BODY_REDUCE);
    await expect(page.locator(MOTION_ROW)).toContainText(copy.motionOff);
    expect(await storedChoice(page)).toBe(MOTION_CHOICE.off);
    await reachEqStrip(page);
    expect(await animationName(page, EQ_BAR)).toBe(NO_ANIMATION);
    expect(await animationName(page, CRT_BEAM)).toBe(NO_ANIMATION);

    await page.reload();
    await expect(page.locator('body')).toHaveAttribute('data-motion', BODY_REDUCE);
    await reachEqStrip(page);
    expect(await animationName(page, EQ_BAR), 'the stored OFF must hold from first paint').toBe(
      NO_ANIMATION,
    );
    await openDrawer(page);
    await expect(page.locator(MOTION_ROW)).toContainText(copy.motionOff);
  });

  test('switching it back on restores the motion and stores ON', async ({ page }) => {
    await page.goto('/');
    await openDrawer(page);
    await page.locator(MOTION_ROW).click();
    await expect(page.locator('body')).toHaveAttribute('data-motion', BODY_REDUCE);
    await page.locator(MOTION_ROW).click();

    await expect(page.locator('body')).toHaveAttribute('data-motion', BODY_FULL);
    expect(await storedChoice(page)).toBe(MOTION_CHOICE.on);
    await reachEqStrip(page);
    expect(await animationName(page, EQ_BAR)).not.toBe(NO_ANIMATION);
  });
});
