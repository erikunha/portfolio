import { expect, test } from '@playwright/test';
import { FOCUS_RING_TARGETS, focusByKeyboard } from './_helpers/focus-ring-targets';
import { installMockBackend } from './_helpers/mock-backend';

const NO_OUTLINE_STYLE = 'none';

for (const { name, route, selector } of FOCUS_RING_TARGETS) {
  test(`keyboard focus on the ${name} shows a focus ring`, async ({ page }) => {
    await installMockBackend(page, { log: 'accept', forget: 'happy' });
    await page.goto(route);
    const target = page.locator(`${selector}:visible`).first();
    await expect(target).toBeVisible();
    await focusByKeyboard(page, target);
    const ring = await target.evaluate((node) => {
      const style = getComputedStyle(node);
      return { style: style.outlineStyle, width: Number.parseFloat(style.outlineWidth) };
    });
    expect(
      ring.style,
      `${selector} lost its keyboard focus ring: an outline: none in @layer components beats the global :focus-visible rule in @layer base (WCAG 2.4.7)`,
    ).not.toBe(NO_OUTLINE_STYLE);
    expect(ring.width).toBeGreaterThan(0);
  });
}
