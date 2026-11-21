import { expect, type Page, test } from '@playwright/test';
import {
  CRASH_SURFACE,
  type CrashSurface,
  crashOnce,
} from '../../tests/e2e/_helpers/injected-crash';
import { installMockBackend } from '../../tests/e2e/_helpers/mock-backend';
import { freezeMotion } from '../../tests/e2e/_helpers/motion';

const HOME_ACTION = '.err-actions .btn[data-variant="secondary"]';
const ACCENT_PROBE = 'var(--color-accent)';
const SETTLED_ERROR_BODY = '.err-log-boot';
const CRASH_PATH = '/';

const SURFACES = [
  { name: 'the route error page', crash: CRASH_SURFACE.route },
  { name: 'the global error page', crash: CRASH_SURFACE.global },
] as const;

async function open(page: Page, crash: CrashSurface) {
  await installMockBackend(page, { log: 'accept' });
  await freezeMotion(page);
  await crashOnce(page, crash);
  await page.goto(CRASH_PATH);
  await expect(page.locator(SETTLED_ERROR_BODY)).toBeVisible();
}

for (const { name, crash } of SURFACES) {
  test(`${name} draws the home action border in the accent color`, async ({ page }) => {
    await open(page, crash);
    const home = page.locator(HOME_ACTION);
    await expect(home).toBeVisible();
    const accent = await page.evaluate((probeColor) => {
      const probe = document.createElement('span');
      probe.style.color = probeColor;
      document.body.append(probe);
      const resolved = getComputedStyle(probe).color;
      probe.remove();
      return resolved;
    }, ACCENT_PROBE);
    const border = await home.evaluate((node) => getComputedStyle(node).borderTopColor);
    expect(
      border,
      'the home action border must be the accent color (3:1 on black); the shared secondary border is 2.92:1',
    ).toBe(accent);
  });
}
