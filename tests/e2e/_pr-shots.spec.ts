import { test } from '@playwright/test';

// One-off PR evidence captures (not part of a gate): both locales, desktop and
// phone, at deviceScaleFactor 2 per the owner screenshot rule.
const SHOTS = [
  { name: 'pt-home-1280', path: '/pt', width: 1280, height: 800 },
  { name: 'en-home-1280', path: '/', width: 1280, height: 800 },
  { name: 'pt-home-390', path: '/pt', width: 390, height: 844 },
  { name: 'pt-drawer-switch-1280', path: '/pt', width: 1280, height: 800, drawer: true },
  { name: 'en-drawer-switch-1280', path: '/', width: 1280, height: 800, drawer: true },
  { name: 'pt-cv-1280', path: '/pt/cv', width: 1280, height: 800 },
  { name: 'pt-summary-390', path: '/pt/summary', width: 390, height: 844 },
];

for (const shot of SHOTS) {
  test(`capture ${shot.name}`, async ({ page }) => {
    await page.setViewportSize({ width: shot.width, height: shot.height });
    if (shot.drawer) await page.goto(shot.path);
    else await page.goto(shot.path, { waitUntil: 'networkidle' }).catch(() => page.goto(shot.path));
    await page.evaluate(() => document.fonts.ready);
    if (shot.drawer) {
      await page.locator('.menu-trigger').first().click();
      await page.locator('#section-drawer').waitFor({ state: 'visible' });
    }
    await page.waitForTimeout(shot.drawer ? 300 : 800);
    await page.screenshot({
      path: `pr-shots/${shot.name}.png`,
      fullPage: false,
      type: 'png',
    });
  });
}
