import { expect, type Page, test } from '@playwright/test';
import { VIEWPORTS } from './_helpers/geometry';
import { MENU_TRIGGER, openSectionMenu } from './_helpers/hydration';
import { gotoSettled } from './_helpers/streamed';

const DRAWER = '#section-drawer';
const OPEN_MENU_TRIGGER = `${MENU_TRIGGER}:visible`;
const BACKDROP_X_OFFSET_PX = 40;
const BACKDROP_Y_PX = 300;
const EXIT_SAMPLE_CAP_MS = 8 * 600;
const EXIT_TICK_MS = 8;
const EXIT_POLL_MS = 50;
const SLIDE_PROPERTY = 'transform';
const SLIDE_PROGRESS = [0.1, 0.2, 0.3, 0.4, 0.5];
const MIN_SLIDE_FRAMES = 3;
const MIN_SLIDE_DURATION_MS = 100;
const MS_PER_SECOND = 1000;
const MIN_EXIT_SHARE = 0.75;
const FRAME_MS = 17;
const STEADY_FRAME_GAP_MS = 2 * FRAME_MS;
const STEADY_MIN_TICKS = 2 * (MIN_SLIDE_FRAMES + 1);
const REST_SAMPLE_MS = 300;

type ExitFrame = { x: number; open: boolean; seeked: boolean };
type ExitMark = {
  at: number;
  line: number;
  open: boolean;
  exiting: boolean;
  released: boolean;
};
type ExitCapture = {
  frames: ExitFrame[];
  marks: ExitMark[];
  durationMs: number;
  panelWidth: number;
};
type RestFrames = { ticks: number; medianGapMs: number };
type SamplerWindow = Window & { exitCapture?: ExitCapture; exitDone?: boolean };

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

async function measureRestFrames(page: Page): Promise<RestFrames> {
  await waitForPanelAtRest(page);
  return page.evaluate(
    (sampleMs) =>
      new Promise<RestFrames>((resolve) => {
        const ticks: number[] = [];
        let sampling = true;
        const tick = (at: number) => {
          if (!sampling) return;
          ticks.push(at);
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        setTimeout(() => {
          sampling = false;
          const gaps = ticks.slice(1).map((time, index) => time - (ticks[index] ?? time));
          const median =
            [...gaps].sort((a, b) => a - b)[Math.floor(gaps.length / 2)] ??
            Number.POSITIVE_INFINITY;
          resolve({ ticks: ticks.length, medianGapMs: median });
        }, sampleMs);
      }),
    REST_SAMPLE_MS,
  );
}

function framesAreSteady({ ticks, medianGapMs }: RestFrames): boolean {
  return ticks >= STEADY_MIN_TICKS && medianGapMs <= STEADY_FRAME_GAP_MS;
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

    test('the panel slides out in real time and the dialog stays open through the slide @cross-browser', async ({
      page,
    }) => {
      await expect(page.locator('body')).not.toHaveAttribute('data-motion', 'reduce');
      const rest = await measureRestFrames(page);
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
      const steady = framesAreSteady(rest);
      test.info().annotations.push({
        type: 'frames',
        description: `rAF at rest: ${rest.ticks} ticks, median ${rest.medianGapMs} ms, live positions ${steady ? 'asserted' : 'not asserted'}`,
      });
      if (steady) {
        expect(
          new Set(slideFrames(capture).map(({ x }) => Math.round(x))).size,
          'rAF was steady at rest, so the panel is drawn at several live positions while the dialog is open',
        ).toBeGreaterThan(MIN_SLIDE_FRAMES);
      }
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
      const seeked = slideFrames(capture, true).map(({ x }) => x);
      expect(seeked, 'every seek lands inside the slide').toHaveLength(SLIDE_PROGRESS.length);
      expect(
        seeked.every(
          (x, index) => index === 0 || x < (seeked[index - 1] ?? Number.NEGATIVE_INFINITY),
        ),
        'the seeked positions move toward the closed position',
      ).toBe(true);
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
