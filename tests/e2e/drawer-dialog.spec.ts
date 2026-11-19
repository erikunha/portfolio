import { expect, test } from '@playwright/test';
import { VIEWPORTS } from './_helpers/geometry';
import { MENU_TRIGGER, openSectionMenu } from './_helpers/hydration';
import { gotoSettled } from './_helpers/streamed';

const DRAWER = '#section-drawer';
const OPEN_MENU_TRIGGER = `${MENU_TRIGGER}:visible`;
const BACKDROP_X_OFFSET_PX = 40;
const BACKDROP_Y_PX = 300;

for (const { name, viewport } of [
  { name: 'desktop', viewport: VIEWPORTS.DESKTOP },
  { name: 'phone', viewport: VIEWPORTS.PHONE },
]) {
  test.describe(`the section drawer is a modal dialog on ${name}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize(viewport);
      await gotoSettled(page, '/');
      await openSectionMenu(page);
      await expect(page.locator(DRAWER)).toHaveClass(/is-open/);
    });

    test('the open drawer is a top-layer modal that takes every point outside its panel', async ({
      page,
    }) => {
      expect(
        await page.locator(DRAWER).evaluate((node) => node.matches('dialog:modal')),
        'the drawer must be opened through showModal',
      ).toBe(true);
      const behind = await page.evaluate(
        ({ y, offset }) => {
          const drawer = document.querySelector('#section-drawer') as HTMLElement;
          const hit = document.elementFromPoint(drawer.getBoundingClientRect().right + offset, y);
          return { hit: hit === drawer, focusable: drawer.contains(document.activeElement) };
        },
        { y: BACKDROP_Y_PX, offset: BACKDROP_X_OFFSET_PX },
      );
      expect(behind.hit, 'a point outside the panel lands on the dialog backdrop').toBe(true);
      expect(behind.focusable, 'focus starts inside the drawer').toBe(true);
    });

    test('a click on the backdrop closes it and returns focus to the trigger', async ({ page }) => {
      const drawerBox = await page.locator(DRAWER).boundingBox();
      expect(drawerBox).not.toBeNull();
      const x = (drawerBox?.x ?? 0) + (drawerBox?.width ?? 0) + BACKDROP_X_OFFSET_PX;
      await page.mouse.click(x, BACKDROP_Y_PX);
      await expect(page.locator(DRAWER)).not.toHaveClass(/is-open/);
      await expect(page.locator(DRAWER)).toBeHidden();
      await expect(page.locator(OPEN_MENU_TRIGGER).first()).toBeFocused();
    });

    test('Escape twice in a row leaves the drawer closed and the page unlocked', async ({
      page,
    }) => {
      await page.keyboard.press('Escape');
      await expect(page.locator(DRAWER)).toBeHidden();
      await expect(page.locator('html[data-scroll-locked]')).toHaveCount(0);
      await page.keyboard.press('Escape');
      await expect(page.locator(DRAWER)).toBeHidden();
    });
  });
}
