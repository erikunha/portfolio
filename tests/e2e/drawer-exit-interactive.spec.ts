import { openSectionMenu } from './_helpers/hydration';
import { installMockBackend } from './_helpers/mock-backend';
import { expect, type Page, test } from './_helpers/test';

const DRAWER = '#section-drawer';
const SAMPLE_MS = 600;
const SAMPLE_CAP_MS = 8 * SAMPLE_MS;
const TICK_MS = 8;
const POLL_MS = 50;
const TYPED = 'Test Visitor';

type Frame = { open: boolean; exiting: boolean; modal: boolean };
type SamplerWindow = Window & { exitFrames?: Frame[]; exitDone?: boolean };

async function armSampler(page: Page): Promise<void> {
  await page.evaluate(
    ({ capMs, tickMs }) => {
      const sampler = window as SamplerWindow;
      const drawer = document.querySelector('#section-drawer') as HTMLDialogElement;
      sampler.exitFrames = [];
      sampler.exitDone = false;
      drawer.addEventListener(
        'click',
        () => {
          const start = performance.now();
          let sawSlide = false;
          const timer = setInterval(() => {
            const frame = {
              open: drawer.open,
              exiting: !drawer.classList.contains('is-open'),
              modal: drawer.matches(':modal'),
            };
            sampler.exitFrames?.push(frame);
            sawSlide = sawSlide || (frame.open && frame.exiting);
            if ((sawSlide && !frame.open) || performance.now() - start >= capMs) {
              clearInterval(timer);
              sampler.exitDone = true;
            }
          }, tickMs);
        },
        { capture: true, once: true },
      );
    },
    { capMs: SAMPLE_CAP_MS, tickMs: TICK_MS },
  );
}

test('the page takes input while the drawer slides out after a section is chosen @cross-browser', async ({
  page,
}) => {
  await installMockBackend(page, { log: 'accept', forget: 'happy' });
  await page.goto('/');
  await openSectionMenu(page);
  await expect(page.locator('body')).not.toHaveAttribute('data-motion', 'reduce');
  await armSampler(page);
  await page
    .locator(DRAWER)
    .getByRole('link', { name: /contact/i })
    .first()
    .click();
  const name = page.getByTestId('contact-form').getByLabel('$ name:');
  await name.fill(TYPED);
  await expect(name, 'typing during the slide-out reaches the field').toHaveValue(TYPED);
  await page.waitForFunction(() => (window as SamplerWindow).exitDone === true, undefined, {
    polling: POLL_MS,
  });
  const frames = await page.evaluate(() => (window as SamplerWindow).exitFrames ?? []);
  const sliding = frames.filter(({ open, exiting }) => open && exiting);
  expect(sliding.length, 'the sampler saw the slide-out').toBeGreaterThan(0);
  expect(
    sliding.filter(({ modal }) => modal),
    'a modal dialog keeps the page inert until the slide ends',
  ).toEqual([]);
  expect(frames.at(-1)?.open, 'the dialog closes once the slide is over').toBe(false);
});

type FocusWindow = Window & { drawerFocusIns?: string[]; focusSampleDone?: boolean };

test('focus never enters the exiting drawer and stays in the field after it closes @cross-browser', async ({
  page,
}) => {
  await installMockBackend(page, { log: 'accept', forget: 'happy' });
  await page.goto('/');
  await openSectionMenu(page);
  await expect(page.locator('body')).not.toHaveAttribute('data-motion', 'reduce');
  await page.evaluate((sampleMs) => {
    const sampler = window as FocusWindow;
    const drawer = document.querySelector('#section-drawer') as HTMLDialogElement;
    sampler.drawerFocusIns = [];
    sampler.focusSampleDone = false;
    drawer.addEventListener(
      'click',
      () => {
        document.addEventListener('focusin', (event) => {
          if (event.target instanceof Node && drawer.contains(event.target)) {
            sampler.drawerFocusIns?.push((event.target as Element).tagName);
          }
        });
        setTimeout(() => {
          sampler.focusSampleDone = true;
        }, sampleMs);
      },
      { capture: true, once: true },
    );
  }, SAMPLE_MS);
  await page
    .locator(DRAWER)
    .getByRole('link', { name: /contact/i })
    .first()
    .click();
  const name = page.getByTestId('contact-form').getByLabel('$ name:');
  await name.fill(TYPED);
  await page.waitForFunction(() => (window as FocusWindow).focusSampleDone === true, undefined, {
    polling: POLL_MS,
  });
  const entered = await page.evaluate(() => (window as FocusWindow).drawerFocusIns ?? []);
  expect(entered, 'no focus event reaches the exiting drawer').toEqual([]);
  await expect(page.locator(DRAWER)).not.toHaveJSProperty('open', true);
  await expect(name, 'the field keeps focus after the final close').toBeFocused();
});
