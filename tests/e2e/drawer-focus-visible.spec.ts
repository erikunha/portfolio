import { expect, test } from '@playwright/test';

const DRAWER = '.section-menu';
const HEAD = '.menu-head';
const TRIGGER = '.mobile-title-bar .menu-trigger, .desktop-topbar .menu-trigger';
const DRAWER_VIEWPORTS = [
  { width: 390, height: 640 },
  { width: 1280, height: 520 },
];
const FOCUS_SETTLE_MS = 100;

for (const viewport of DRAWER_VIEWPORTS) {
  test(`backward Tab through the long drawer never lands under the sticky head at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto('/design-system');
    await page.locator(TRIGGER).locator('visible=true').first().click();
    const drawer = page.locator(DRAWER);
    await expect(drawer).toHaveClass(/is-open/);
    const overflows = await drawer.evaluate((el) => el.scrollHeight > el.clientHeight);
    expect(overflows, 'the design-system drawer must be taller than the viewport').toBe(true);
    await page.waitForTimeout(FOCUS_SETTLE_MS);

    const controls = await drawer.locator('a[href], button').count();
    for (let step = 0; step < controls + 1; step++) {
      await page.keyboard.press('Shift+Tab');
      await page.waitForTimeout(FOCUS_SETTLE_MS);
      const { focusedTop, headBottom, inDrawer, inHead } = await page.evaluate(
        ([drawerSelector, headSelector]) => {
          const active = document.activeElement as HTMLElement | null;
          const head = document.querySelector(headSelector as string);
          const drawerEl = document.querySelector(drawerSelector as string);
          return {
            focusedTop: active?.getBoundingClientRect().top ?? 0,
            headBottom: head?.getBoundingClientRect().bottom ?? 0,
            inDrawer: Boolean(active && drawerEl?.contains(active)),
            inHead: Boolean(active && head?.contains(active)),
          };
        },
        [DRAWER, HEAD],
      );
      expect(inDrawer, 'focus stays inside the open drawer').toBe(true);
      if (inHead) continue;
      expect(
        focusedTop,
        `WCAG 2.4.11: step ${step} focused an item at ${focusedTop}px under a head that ends at ${headBottom}px`,
      ).toBeGreaterThanOrEqual(headBottom - 1);
    }
  });
}
