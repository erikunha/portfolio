import { expect, type Page, test } from '@playwright/test';
import { VIEWPORTS } from './_helpers/geometry';
import { MENU_TRIGGER, openSectionMenu } from './_helpers/hydration';
import { gotoSettled } from './_helpers/streamed';

const DRAWER = '#section-drawer';
const OPEN_MENU_TRIGGER = `${MENU_TRIGGER}:visible`;
const BACKDROP_X_OFFSET_PX = 40;
const BACKDROP_Y_PX = 300;
const FIXED_EXIT_WINDOW_MS = 600;
const EXIT_WINDOW_MULTIPLE = 8;
const EXIT_SAMPLE_CAP_MS = EXIT_WINDOW_MULTIPLE * FIXED_EXIT_WINDOW_MS;
const EXIT_TICK_MS = 8;
const EXIT_POLL_MS = 50;
const SLIDE_PROPERTY = 'transform';
const SLIDE_PROGRESS = [0.1, 0.25, 0.5, 0.75, 0.9];
const MIN_SLIDE_DURATION_MS = 100;
const MS_PER_SECOND = 1000;
const MIN_EXIT_SHARE = 0.75;
const MIN_EXIT_TRAVEL = 0.75;

type ExitFrame = { x: number; open: boolean; seeked: boolean };
type SlideEnd = { x: number; open: boolean };
type ExitMark = {
  at: number;
  line: number;
  open: boolean;
  exiting: boolean;
  released: boolean;
};
type ExitCapture = {
  frames: ExitFrame[];
  slideEnd?: SlideEnd;
  marks: ExitMark[];
  durationMs: number;
  panelWidth: number;
};
type SamplerWindow = Window & {
  exitCapture?: ExitCapture;
  exitDone?: boolean;
};

async function armExitSampler(page: Page, seek: boolean): Promise<void> {
  await page.evaluate(
    ({ capMs, tickMs, progress, property, msPerSecond, seek: stepSlide }) => {
      const sampler = window as SamplerWindow;
      const drawer = document.querySelector('#section-drawer') as HTMLDialogElement;
      const readX = () => new DOMMatrixReadOnly(getComputedStyle(drawer).transform).m41;
      const capture: ExitCapture = {
        frames: [],
        marks: [],
        durationMs: 0,
        panelWidth: drawer.offsetWidth,
      };
      sampler.exitCapture = capture;
      sampler.exitDone = false;
      document.addEventListener(
        'keydown',
        () => {
          const start = performance.now();
          const [firstDuration = ''] = getComputedStyle(drawer).transitionDuration.split(',');
          capture.durationMs = Number.parseFloat(firstDuration) * msPerSecond;
          new MutationObserver(() => {
            capture.marks.push({
              at: performance.now(),
              line: Number(document.timeline.currentTime),
              open: drawer.open,
              exiting: drawer.hasAttribute('data-exiting'),
              released: !drawer.classList.contains('is-open'),
            });
          }).observe(drawer, {
            attributes: true,
            attributeFilter: ['open', 'data-exiting', 'class'],
          });
          let stepped = false;
          const timer = setInterval(() => {
            const slide = drawer
              .getAnimations()
              .find(
                (animation) =>
                  animation instanceof CSSTransition && animation.transitionProperty === property,
              );
            if (stepSlide && slide && drawer.open && !stepped) {
              stepped = true;
              const duration = Number(slide.effect?.getComputedTiming().duration);
              const resumeAt = slide.currentTime;
              slide.pause();
              for (const fraction of progress) {
                slide.currentTime = duration * fraction;
                capture.frames.push({ x: readX(), open: drawer.open, seeked: true });
              }
              slide.currentTime = duration;
              capture.slideEnd = { x: readX(), open: drawer.open };
              slide.currentTime = resumeAt;
              slide.play();
            }
            capture.frames.push({ x: readX(), open: drawer.open, seeked: false });
            if (!drawer.open || performance.now() - start >= capMs) {
              clearInterval(timer);
              sampler.exitDone = true;
            }
          }, tickMs);
        },
        { capture: true, once: true },
      );
    },
    {
      capMs: EXIT_SAMPLE_CAP_MS,
      tickMs: EXIT_TICK_MS,
      progress: SLIDE_PROGRESS,
      property: SLIDE_PROPERTY,
      msPerSecond: MS_PER_SECOND,
      seek,
    },
  );
}

async function waitForPanelAtRest(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      new DOMMatrixReadOnly(
        getComputedStyle(document.querySelector('#section-drawer') as Element).transform,
      ).m41 === 0,
    undefined,
    { polling: EXIT_POLL_MS },
  );
}

async function sampleExit(page: Page, seek: boolean): Promise<ExitCapture> {
  await waitForPanelAtRest(page);
  await armExitSampler(page, seek);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => (window as SamplerWindow).exitDone === true, undefined, {
    polling: EXIT_POLL_MS,
  });
  return page.evaluate(
    () => (window as SamplerWindow).exitCapture ?? ({} as unknown as ExitCapture),
  );
}

function slideFrames({ frames, panelWidth }: ExitCapture, seeked = false): ExitFrame[] {
  return frames.filter(
    ({ x, open, seeked: tagged }) => tagged === seeked && open && x < 0 && x > -panelWidth,
  );
}

function exitWindow({ marks }: ExitCapture): {
  startAt: number;
  closeAt: number;
  elapsedMs: number;
} {
  const start = marks.find(({ released }) => released);
  const handover = marks.findIndex(({ exiting }) => exiting);
  const close = marks.find(({ open }, index) => index > handover && !open);
  if (!start || handover < 0 || !close) {
    return { startAt: Number.NaN, closeAt: Number.NaN, elapsedMs: Number.NaN };
  }
  return {
    startAt: start.at,
    closeAt: close.at,
    elapsedMs: Math.max(close.at - start.at, close.line - start.line),
  };
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
      await waitForPanelAtRest(page);
      const drawerBox = await page.locator(DRAWER).boundingBox();
      expect(drawerBox).not.toBeNull();
      const x = (drawerBox?.x ?? 0) + (drawerBox?.width ?? 0) + BACKDROP_X_OFFSET_PX;
      await page.mouse.click(x, BACKDROP_Y_PX);
      await expect(page.locator(DRAWER)).not.toHaveClass(/is-open/);
      await expect(page.locator(DRAWER)).toBeHidden();
      await expect(page.locator(OPEN_MENU_TRIGGER).first()).toBeFocused();
    });

    test('the dialog stays open for most of the exit transition on the clock @cross-browser', async ({
      page,
    }) => {
      await expect(page.locator('body')).not.toHaveAttribute('data-motion', 'reduce');
      const capture = await sampleExit(page, false);
      const { startAt, closeAt, elapsedMs } = exitWindow(capture);
      expect(
        capture.durationMs,
        'the exit transition is long enough to be seen',
      ).toBeGreaterThanOrEqual(MIN_SLIDE_DURATION_MS);
      expect(
        Number.isFinite(startAt) && Number.isFinite(closeAt),
        'the exit starts and the dialog is then closed for good',
      ).toBe(true);
      expect(
        elapsedMs,
        'the dialog stays open for at least three quarters of the transition duration on the clock that closed it',
      ).toBeGreaterThanOrEqual(capture.durationMs * MIN_EXIT_SHARE);
      expect(capture.frames.at(-1)?.open, 'the dialog closes once the slide is over').toBe(false);
      await expect(page.locator(OPEN_MENU_TRIGGER).first()).toBeFocused();
    });

    test('the exit transition carries the panel from the open to the closed position @cross-browser', async ({
      page,
    }) => {
      await expect(page.locator('body')).not.toHaveAttribute('data-motion', 'reduce');
      const capture = await sampleExit(page, true);
      expect(
        capture.durationMs,
        'the exit transition is long enough to be seen',
      ).toBeGreaterThanOrEqual(MIN_SLIDE_DURATION_MS);
      const seekedFrames = capture.frames.filter(({ seeked }) => seeked);
      expect(seekedFrames, 'one frame is read at every seeked progress').toHaveLength(
        SLIDE_PROGRESS.length,
      );
      expect(
        seekedFrames.every(({ open }) => open),
        'the dialog is still open at every seeked progress',
      ).toBe(true);
      const seeked = slideFrames(capture, true).map(({ x }) => x);
      expect(seeked, 'every seek lands inside the slide').toHaveLength(SLIDE_PROGRESS.length);
      expect(
        seeked.every(
          (x, index) => index === 0 || x < (seeked[index - 1] ?? Number.NEGATIVE_INFINITY),
        ),
        'the seeked positions move toward the closed position',
      ).toBe(true);
      expect(
        -(seeked.at(-1) ?? 0) / capture.panelWidth,
        'by the last seeked progress the panel has covered most of its travel while the dialog is still open',
      ).toBeGreaterThanOrEqual(MIN_EXIT_TRAVEL);
      expect(
        capture.slideEnd,
        'at the end of the transition the panel sits at the closed position',
      ).toEqual({ x: -capture.panelWidth, open: true });
      expect(capture.frames.at(-1)?.open, 'the dialog closes once the slide is over').toBe(false);
      await expect(page.locator(OPEN_MENU_TRIGGER).first()).toBeFocused();
    });

    test('with MOTION off the dialog closes at once @cross-browser', async ({ page }) => {
      await page.locator('#section-drawer .menu-motion').click();
      await expect(page.locator('body')).toHaveAttribute('data-motion', 'reduce');
      const capture = await sampleExit(page, true);
      expect(
        [...slideFrames(capture, true), ...slideFrames(capture)],
        'no intermediate slide frame is drawn',
      ).toHaveLength(0);
      expect(capture.frames.at(-1)?.open).toBe(false);
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
