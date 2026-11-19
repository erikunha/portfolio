import { expect, type Page, test } from '@playwright/test';
import { VIEWPORTS } from './_helpers/geometry';
import { MENU_TRIGGER, openSectionMenu } from './_helpers/hydration';
import { gotoSettled } from './_helpers/streamed';

const DRAWER = '#section-drawer';
const OPEN_MENU_TRIGGER = `${MENU_TRIGGER}:visible`;
const BACKDROP_X_OFFSET_PX = 40;
const BACKDROP_Y_PX = 300;
const EXIT_SAMPLE_MS = 600;
const EXIT_TICK_MS = 8;
const SLIDE_PROPERTY = 'transform';
const SLIDE_PROGRESS = [0.1, 0.2, 0.3, 0.4, 0.5];
const EXIT_FULL_SLIDE_PX = 300;
const MIN_SLIDE_FRAMES = 3;

type ExitFrame = { x: number; open: boolean };
type SamplerWindow = Window & { exitFrames?: ExitFrame[]; exitDone?: boolean };

async function armExitSampler(page: Page): Promise<void> {
  await page.evaluate(
    ({ sampleMs, tickMs, progress, property }) => {
      const sampler = window as SamplerWindow;
      const drawer = document.querySelector('#section-drawer') as HTMLDialogElement;
      const readFrame = (): ExitFrame => ({
        x: new DOMMatrixReadOnly(getComputedStyle(drawer).transform).m41,
        open: drawer.open,
      });
      sampler.exitFrames = [];
      sampler.exitDone = false;
      document.addEventListener(
        'keydown',
        () => {
          const start = performance.now();
          let stepped = false;
          const timer = setInterval(() => {
            const slide = drawer
              .getAnimations()
              .find(
                (animation) =>
                  animation instanceof CSSTransition && animation.transitionProperty === property,
              );
            if (slide && drawer.open && !stepped) {
              stepped = true;
              const duration = Number(slide.effect?.getComputedTiming().duration);
              slide.pause();
              for (const fraction of progress) {
                slide.currentTime = duration * fraction;
                sampler.exitFrames?.push(readFrame());
              }
              slide.play();
            }
            sampler.exitFrames?.push(readFrame());
            if (performance.now() - start >= sampleMs) {
              clearInterval(timer);
              sampler.exitDone = true;
            }
          }, tickMs);
        },
        { capture: true, once: true },
      );
    },
    {
      sampleMs: EXIT_SAMPLE_MS,
      tickMs: EXIT_TICK_MS,
      progress: SLIDE_PROGRESS,
      property: SLIDE_PROPERTY,
    },
  );
}

async function sampleExit(page: Page): Promise<ExitFrame[]> {
  await page.waitForFunction(
    () =>
      new DOMMatrixReadOnly(
        getComputedStyle(document.querySelector('#section-drawer') as Element).transform,
      ).m41 === 0,
  );
  await armExitSampler(page);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => (window as SamplerWindow).exitDone === true);
  return page.evaluate(() => (window as SamplerWindow).exitFrames ?? []);
}

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

    test('the open drawer is a top-layer modal that takes every point outside its panel @cross-browser', async ({
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

    test('a click on the backdrop closes it and returns focus to the trigger @cross-browser', async ({
      page,
    }) => {
      const drawerBox = await page.locator(DRAWER).boundingBox();
      expect(drawerBox).not.toBeNull();
      const x = (drawerBox?.x ?? 0) + (drawerBox?.width ?? 0) + BACKDROP_X_OFFSET_PX;
      await page.mouse.click(x, BACKDROP_Y_PX);
      await expect(page.locator(DRAWER)).not.toHaveClass(/is-open/);
      await expect(page.locator(DRAWER)).toBeHidden();
      await expect(page.locator(OPEN_MENU_TRIGGER).first()).toBeFocused();
    });

    test('the panel slides out before the dialog closes @cross-browser', async ({ page }) => {
      await expect(page.locator('body')).not.toHaveAttribute('data-motion', 'reduce');
      const frames = await sampleExit(page);
      const sliding = frames.filter(({ x, open }) => open && x < 0 && x > -EXIT_FULL_SLIDE_PX);
      expect(
        new Set(sliding.map(({ x }) => Math.round(x))).size,
        'the panel moves through several positions while the dialog is still open',
      ).toBeGreaterThan(MIN_SLIDE_FRAMES);
      expect(frames.at(-1)?.open, 'the dialog closes once the slide is over').toBe(false);
      await expect(page.locator(OPEN_MENU_TRIGGER).first()).toBeFocused();
    });

    test('with MOTION off the dialog closes at once @cross-browser', async ({ page }) => {
      await page.locator('#section-drawer .menu-motion').click();
      await expect(page.locator('body')).toHaveAttribute('data-motion', 'reduce');
      const frames = await sampleExit(page);
      const sliding = frames.filter(({ x, open }) => open && x < 0 && x > -EXIT_FULL_SLIDE_PX);
      expect(sliding, 'no intermediate slide frame is drawn').toHaveLength(0);
      expect(frames.at(-1)?.open).toBe(false);
    });

    test('Escape twice in a row leaves the drawer closed and the page unlocked @cross-browser', async ({
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
